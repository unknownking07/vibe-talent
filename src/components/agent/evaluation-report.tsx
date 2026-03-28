"use client";

import type { EvaluationResult } from "@/lib/types/agent";
import { Shield, AlertTriangle } from "lucide-react";

interface EvaluationReportProps {
  report: EvaluationResult;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#16A34A";
  if (score >= 60) return "#FF3A00";
  return "#DC2626";
}

const dimensionLabels: Record<string, string> = {
  consistency: "Consistency",
  project_quality: "Project Quality",
  tech_breadth: "Tech Breadth",
  activity_recency: "Activity Recency",
  reputation: "Reputation",
};

export function EvaluationReport({ report }: EvaluationReportProps) {
  const scoreColor = getScoreColor(report.overall_score);

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div
        className="p-6 text-center"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Agent Score
        </div>
        <div
          className="text-6xl font-extrabold font-mono"
          style={{ color: scoreColor }}
        >
          {report.overall_score}
        </div>
        <div className="text-xs font-bold uppercase text-[var(--text-muted)] mt-1">/ 100</div>
      </div>

      {/* Dimension Scores */}
      <div
        className="p-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)] mb-4">
          Dimension Analysis
        </h3>
        <div className="space-y-3">
          {Object.entries(report.dimensions).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold uppercase text-[var(--foreground)]">
                  {dimensionLabels[key] || key}
                </span>
                <span className="font-extrabold font-mono" style={{ color: getScoreColor(value) }}>
                  {value}
                </span>
              </div>
              <div
                className="h-3"
                style={{ backgroundColor: "var(--border-subtle)", border: "2px solid var(--border-hard)" }}
              >
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${value}%`,
                    backgroundColor: getScoreColor(value),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div
        className="p-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "2px solid var(--border-hard)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--foreground)] mb-3">
          AI Summary
        </h3>
        <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          {report.summary}
        </p>
      </div>

      {/* Strengths & Risks */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div
          className="p-5"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <h4 className="text-sm font-extrabold uppercase text-[var(--status-success-text)] flex items-center gap-2 mb-3">
            <Shield size={16} />
            Strengths
          </h4>
          <ul className="space-y-2">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-medium text-[var(--status-success-text)]">
                <span className="mt-1 w-2 h-2 shrink-0" style={{ backgroundColor: "#16A34A" }} />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="p-5"
          style={{
            backgroundColor: "var(--status-error-bg)",
            border: "2px solid var(--border-hard)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <h4 className="text-sm font-extrabold uppercase text-[var(--status-error-text)] flex items-center gap-2 mb-3">
            <AlertTriangle size={16} />
            Risks
          </h4>
          <ul className="space-y-2">
            {report.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-medium text-[var(--status-error-text)]">
                <span className="mt-1 w-2 h-2 shrink-0" style={{ backgroundColor: "#DC2626" }} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
