import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Agent | VibeTalent",
  description:
    "Use AI to find the perfect vibe coder for your project. Describe what you need and get matched with builders who have the right skills and track record.",
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
