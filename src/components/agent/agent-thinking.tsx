"use client";

import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";
import type { AgentStep } from "@/lib/types/agent";

interface AgentThinkingProps {
  steps: AgentStep[];
  onComplete: () => void;
}

export function AgentThinking({ steps, onComplete }: AgentThinkingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(prev => prev + 1);
    }, steps[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep, steps, onComplete]);

  return (
    <div
      className="p-6 font-mono text-sm"
      style={{
        backgroundColor: "#0F0F0F",
        border: "2px solid #0F0F0F",
        boxShadow: "var(--shadow-brutal)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-3 h-3"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <span className="text-xs font-extrabold uppercase tracking-wider text-white">
          AI Agent Processing
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.includes(i);
          const isActive = currentStep === i && !isCompleted;
          const isPending = i > currentStep;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 transition-opacity ${
                isPending ? "opacity-30" : "opacity-100"
              }`}
            >
              {isCompleted ? (
                <Check size={16} className="text-green-400 shrink-0" />
              ) : isActive ? (
                <Loader2 size={16} className="text-[var(--accent)] animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 shrink-0" />
              )}
              <span
                className={`${
                  isActive
                    ? "text-[var(--accent)]"
                    : isCompleted
                    ? "text-green-400"
                    : "text-zinc-600"
                }`}
              >
                {step.label}
                {isActive && <span className="animate-pulse">_</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
