import { AgentChatPanel } from "@/components/agent/agent-chat-panel";

export default function SupportPage() {
  return (
    <AgentChatPanel
      title="Support"
      subtitle="VibeFinder — AI support & talent scout"
      greeting={
        "Hi! I'm VibeFinder. Ask me anything about VibeTalent — vibe scores, streaks, adding projects, hiring, badges, or your account. I can also search real builders if you're here to find talent."
      }
      suggestions={[
        "How does my vibe score work?",
        "Why hasn't my streak updated?",
        "How do I add a project?",
        "Find me a builder to hire",
      ]}
      placeholder="Ask a support question..."
    />
  );
}
