"use client";

import type { EvaluationResult } from "@/lib/types/agent";
import { Shield, Warning } from "@phosphor-icons/react";

interface EvaluationReportProps {
  report: EvaluationResult;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#16A34A";
  if (score >= 60) return "#FF3A00";
  return "#DC2626";
}

const dimensionLabels: Record<string, string> = {
  consistency: "Recorded consistency (context only)",
  project_quality: "Portfolio Evidence",
  tech_breadth: "Listed technologies (context only)",
  activity_recency: "Recorded activity (context only)",
  reputation: "Community score (context only)",
};

export function EvaluationReport({ report }: EvaluationReportProps) {
  const scoreColor = getScoreColor(report.overall_score);
  const visibleDimensions = {
    project_quality: report.dimensions.project_quality,
    tech_breadth: report.dimensions.tech_breadth,
    consistency: report.dimensions.consistency,
    activity_recency: report.dimensions.activity_recency,
    reputation: report.dimensions.reputation,
  };

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div
        className="p-6 text-center rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <div className="text-xs font-medium text-[var(--text-muted)] mb-2">
          Portfolio evidence score
        </div>
        <div
          className="text-6xl font-extrabold font-mono"
          style={{ color: scoreColor }}
        >
          {report.overall_score}
        </div>
        <div className="text-xs font-medium text-[var(--text-muted)] mt-1">
          / 100
        </div>
      </div>

      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        Based on the strongest public project with verified GitHub ownership: ownership 40 points, README 15, test-related files/configuration 15, CI/container configuration 10, and a reachable live URL 20. Configuration detection does not verify executable tests or successful CI. Activity and community metrics below add no points. This score is not a probability of successful delivery.
      </p>

      {/* Dimension Scores */}
      <div
        className="p-6 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Evidence and activity context
        </h3>
        <div className="space-y-3">
          {Object.entries(visibleDimensions).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-[var(--foreground)]">
                  {dimensionLabels[key] || key}
                </span>
                <span
                  className="font-bold font-mono"
                  style={{ color: getScoreColor(value) }}
                >
                  {value}
                </span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--border-subtle)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
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
        className="p-6 rounded-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-brutal)",
        }}
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
          What this evidence means
        </h3>
        <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
          {report.summary}
        </p>
      </div>

      {/* Strengths & Risks */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div
          className="p-5 rounded-2xl"
          style={{
            backgroundColor: "var(--status-success-bg)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <h4 className="text-sm font-bold text-[var(--status-success-text)] flex items-center gap-2 mb-3">
            <Shield weight="fill" size={16} />
            Observed evidence
          </h4>
          <ul className="space-y-2">
            {report.strengths.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm font-medium text-[var(--status-success-text)]"
              >
                <span
                  className="mt-1 w-2 h-2 shrink-0 rounded-full"
                  style={{ backgroundColor: "#16A34A" }}
                />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="p-5 rounded-2xl"
          style={{
            backgroundColor: "var(--status-error-bg)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-brutal-sm)",
          }}
        >
          <h4 className="text-sm font-bold text-[var(--status-error-text)] flex items-center gap-2 mb-3">
            <Warning weight="fill" size={16} />
            Before hiring
          </h4>
          <ul className="space-y-2">
            {report.risks.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm font-medium text-[var(--status-error-text)]"
              >
                <span
                  className="mt-1 w-2 h-2 shrink-0 rounded-full"
                  style={{ backgroundColor: "#DC2626" }}
                />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
