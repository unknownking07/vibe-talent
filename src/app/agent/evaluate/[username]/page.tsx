"use client";

import { use, useState, useCallback, useEffect } from "react";
import { fetchUserByUsername } from "@/lib/supabase/queries";
import { evaluateUser } from "@/lib/agent-scoring";
import type { UserWithSocials } from "@/lib/types/database";
import { AgentThinking } from "@/components/agent/agent-thinking";
import { EvaluationReport } from "@/components/agent/evaluation-report";
import { Bot, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { EvaluationResult, AgentStep } from "@/lib/types/agent";

const evaluationSteps: AgentStep[] = [
  { label: "Connecting to VibeTalent data layer...", duration: 800 },
  { label: "Scanning coding activity and streak history...", duration: 1200 },
  { label: "Analyzing project portfolio and deployments...", duration: 1000 },
  { label: "Evaluating tech stack diversity...", duration: 900 },
  { label: "Computing reputation and badge metrics...", duration: 700 },
  { label: "Generating AI evaluation report...", duration: 1100 },
];

export default function EvaluatePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [user, setUser] = useState<UserWithSocials | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<EvaluationResult | null>(null);
  const [thinking, setThinking] = useState(true);

  useEffect(() => {
    fetchUserByUsername(username).then((data) => {
      setUser(data);
      setLoading(false);
    });
  }, [username]);

  const handleComplete = useCallback(() => {
    if (user) {
      setReport(evaluateUser(user));
    }
    setThinking(false);
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="skeleton h-12 mb-8" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-[#0F0F0F]">Builder not found</h1>
        <p className="mt-2 text-[#52525B] font-medium">@{username} does not exist on VibeTalent.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <Link
        href={`/profile/${username}`}
        className="inline-flex items-center gap-2 text-sm font-bold uppercase text-[#71717A] hover:text-[var(--accent)] mb-6"
      >
        <ArrowLeft size={14} />
        Back to Profile
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            backgroundColor: "#0F0F0F",
            border: "2px solid #0F0F0F",
          }}
        >
          <Bot size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-[#0F0F0F]">
            AI Evaluation: @{username}
          </h1>
          <p className="text-sm text-[#52525B] font-medium">
            Deep analysis of coding activity, project quality, and reputation
          </p>
        </div>
      </div>

      {thinking && (
        <AgentThinking steps={evaluationSteps} onComplete={handleComplete} />
      )}

      {report && (
        <div className="mt-6">
          <EvaluationReport report={report} />

          <div className="mt-6 flex gap-3">
            <Link
              href={`/agent/contact/${username}`}
              className="btn-brutal btn-brutal-primary text-sm flex items-center gap-2"
            >
              <Bot size={14} />
              Contact via Agent
            </Link>
            <Link
              href={`/profile/${username}`}
              className="btn-brutal btn-brutal-secondary text-sm"
            >
              View Full Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
