import { AgentChatPanel } from "@/components/agent/agent-chat-panel";

export default function AgentChatPage() {
  return (
    <AgentChatPanel
      title="VibeFinder"
      subtitle="AI talent scout: live platform data"
      greeting={
        "Hey! I'm VibeFinder. I can find builders using public project evidence and listed skills, explain what is verified, draft hire messages, and answer platform questions. Streaks and vibe score do not increase hiring matches. What do you need?"
      }
      suggestions={[
        "Find me a Next.js builder for an MVP",
        "Who are the top builders right now?",
        "Help me hire someone",
        "How does the vibe score work?",
      ]}
      placeholder="Describe what you're looking for..."
    />
  );
}
