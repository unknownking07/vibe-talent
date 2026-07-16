"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "Type your message..." }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Ready to type the moment the chat opens — but only where a keyboard is
  // already at hand. On touch devices autofocus would pop the keyboard over
  // half the conversation.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      {/* The input itself is never disabled: disabling blurs it, which forced
          a click back into the box after every send. You can type your next
          message while the bot replies — only submission is gated. */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="input-brutal flex-1"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="btn-brutal btn-brutal-primary px-5 disabled:opacity-50"
      >
        <Send size={16} />
      </button>
    </form>
  );
}
