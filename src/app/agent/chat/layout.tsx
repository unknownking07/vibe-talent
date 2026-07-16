import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VibeFinder Bot Chat | VibeTalent",
  description:
    "Chat with VibeFinder, the AI assistant that searches live builder data to find the perfect vibe coder for your project — and answers anything about VibeTalent.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="chat-page-wrapper">
      {children}
    </div>
  );
}
