import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VibeFinder Bot Chat | VibeTalent",
  description:
    "Chat with VibeFinder Bot to find the perfect vibe coder for your project. Describe what you need and get matched instantly.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="chat-page-wrapper">
      {children}
    </div>
  );
}
