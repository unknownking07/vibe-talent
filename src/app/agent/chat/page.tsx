import { AgentChatPanel } from "@/components/agent/agent-chat-panel";

export default function AgentChatPage() {
  return (
    <AgentChatPanel
      title="VibeFinder"
      subtitle="AI talent scout — live platform data"
      greeting={
        "Hey! I'm VibeFinder. I can search every builder on VibeTalent by real shipping data — vibe scores, streaks, verified projects — evaluate specific builders, draft hire messages, and answer any question about the platform. What do you need?"
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
