"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { fetchUsers } from "@/lib/supabase/queries";
import { matchUsers } from "@/lib/agent-scoring";
import type { UserWithSocials } from "@/lib/types/database";
import { ChatMessage } from "@/components/agent/chat-message";
import { ChatInput } from "@/components/agent/chat-input";
import { MatchCard } from "@/components/agent/match-card";
import { Bot } from "lucide-react";
import type { MatchResult, TaskRequest } from "@/lib/types/agent";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  matches?: MatchResult[];
}

type ConversationStage = "greeting" | "description" | "tech" | "timeline" | "results";

const GREETING = "Hey! I'm the VibeTalent AI agent. I can help you find vibe coders, evaluate builders, or draft hire requests. What are you looking for?";

export default function AgentChatPage() {
  const [allUsers, setAllUsers] = useState<UserWithSocials[]>([]);

  useEffect(() => {
    fetchUsers().then(setAllUsers);
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "agent", content: GREETING },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [stage, setStage] = useState<ConversationStage>("greeting");
  const [taskData, setTaskData] = useState<Partial<TaskRequest>>({
    project_type: "mvp",
    budget: "500_2k",
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  const addMessage = useCallback((role: "user" | "agent", content: string, matches?: MatchResult[]) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role, content, matches },
    ]);
  }, []);

  const simulateThinking = useCallback((callback: () => void, delay = 1500) => {
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      callback();
    }, delay);
  }, []);

  const handleSend = useCallback((text: string) => {
    addMessage("user", text);

    switch (stage) {
      case "greeting":
        simulateThinking(() => {
          setTaskData((prev) => ({ ...prev, description: text }));
          addMessage("agent", "Great! What tech stack does your project require? (e.g., Next.js, TypeScript, Python, React Native...)");
          setStage("description");
        });
        break;

      case "description":
        simulateThinking(() => {
          const tech = text.split(",").map((t) => t.trim()).filter(Boolean);
          setTaskData((prev) => ({ ...prev, tech_stack: tech }));
          addMessage("agent", "Got it. What's your timeline looking like?\n\n• ASAP\n• 1 week\n• 1 month\n• Flexible");
          setStage("tech");
        });
        break;

      case "tech": {
        simulateThinking(() => {
          const timelineMap: Record<string, TaskRequest["timeline"]> = {
            asap: "asap",
            "1 week": "1_week",
            "1 month": "1_month",
            flexible: "flexible",
          };
          const timeline = timelineMap[text.toLowerCase()] || "flexible";
          const finalTask: TaskRequest = {
            description: taskData.description || text,
            tech_stack: taskData.tech_stack || [],
            project_type: taskData.project_type || "mvp",
            timeline,
            budget: taskData.budget || "500_2k",
          };

          const results = matchUsers(allUsers, finalTask);
          addMessage(
            "agent",
            `I found ${results.length} matching vibe coders for your project. Here are the top matches ranked by skill overlap, consistency, and reputation:`,
            results
          );
          setStage("results");
        }, 2500);
        break;
      }

      case "results":
        simulateThinking(() => {
          addMessage("agent", "Want me to help with anything else? I can:\n\n• Search for different skills\n• Evaluate a specific builder\n• Draft a hire message\n\nJust let me know!");
          setStage("greeting");
          setTaskData({ project_type: "mvp", budget: "500_2k" });
        });
        break;
    }
  }, [stage, taskData, allUsers, addMessage, simulateThinking]);

  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case "find":
        addMessage("user", "I need to find talent for my project");
        simulateThinking(() => {
          addMessage("agent", "I'd love to help you find the perfect vibe coder! Tell me about your project — what are you building?");
          setStage("greeting");
        });
        break;
      case "evaluate":
        addMessage("user", "I want to evaluate a builder");
        simulateThinking(() => {
          addMessage(
            "agent",
            "Sure! You can evaluate any builder on the platform. Head to their profile and click the \"AI Evaluate\" button, or visit /agent/evaluate/[username].\n\nWho would you like to evaluate? Here are some popular builders:\n\n• @indie_hacker (Diamond, 380-day streak)\n• @web3_builder (Gold, 210-day streak)\n• @vibemaster (Silver, 127-day streak)"
          );
          setStage("results");
        });
        break;
      case "hire":
        addMessage("user", "Help me hire someone");
        simulateThinking(() => {
          addMessage("agent", "Let's find the right person first! Describe the project you need help with and I'll match you with the best builders.");
          setStage("greeting");
        });
        break;
    }
  }, [addMessage, simulateThinking]);

  const showQuickActions = messages.length === 1 && stage === "greeting";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#0F0F0F",
            border: "2px solid #0F0F0F",
            boxShadow: "3px 3px 0 var(--accent)",
          }}
        >
          <Bot size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold uppercase text-[#0F0F0F]">AI Agent Chat</h1>
          <p className="text-xs text-[#71717A] font-bold uppercase">Powered by VibeTalent</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pb-4"
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatMessage role={msg.role} content={msg.content} />
            {msg.matches && msg.matches.length > 0 && (
              <div className="ml-11 mt-3 space-y-3">
                {msg.matches.map((match, i) => (
                  <MatchCard key={match.user.id} match={match} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <ChatMessage role="agent" content="" isThinking />
        )}

        {showQuickActions && (
          <div className="flex flex-wrap gap-2 ml-11 mt-2">
            {[
              { key: "find", label: "Find talent for my project" },
              { key: "evaluate", label: "Evaluate a builder" },
              { key: "hire", label: "Help me hire someone" },
            ].map((action) => (
              <button
                key={action.key}
                onClick={() => handleQuickAction(action.key)}
                className="btn-brutal text-xs py-2 px-4"
                style={{
                  backgroundColor: "#FFFFFF",
                  boxShadow: "var(--shadow-brutal-sm)",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 pt-4" style={{ borderTop: "2px solid #0F0F0F" }}>
        <ChatInput
          onSend={handleSend}
          disabled={isThinking}
          placeholder={
            stage === "greeting"
              ? "Describe what you're looking for..."
              : stage === "description"
              ? "e.g., Next.js, TypeScript, Tailwind..."
              : stage === "tech"
              ? "e.g., ASAP, 1 week, flexible..."
              : "Ask me anything..."
          }
        />
      </div>
    </div>
  );
}
