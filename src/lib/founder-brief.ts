import type { TaskRequest } from "@/lib/types/agent";
import { validateEmail, validateName } from "@/lib/validation";

export type FounderBriefInsert = TaskRequest & {
  name: string;
  email: string;
  source: "agent_find";
  consent_at: string;
  status: "new";
};

type ParsedBrief =
  | { ok: true; value: FounderBriefInsert }
  | { ok: false; error: string };

const PROJECT_TYPES = new Set<TaskRequest["project_type"]>([
  "mvp", "full_product", "bug_fix", "consultation",
]);
const TIMELINES = new Set<TaskRequest["timeline"]>([
  "asap", "1_week", "1_month", "flexible",
]);
const BUDGETS = new Set<TaskRequest["budget"]>([
  "under_500", "500_2k", "2k_5k", "5k_plus",
]);

export function parseFounderBrief(raw: unknown): ParsedBrief {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Enter your project and contact details." };
  }
  const input = raw as Record<string, unknown>;
  if (input.consent !== true) {
    return { ok: false, error: "Please agree to be contacted about this request." };
  }
  if (typeof input.name !== "string" || input.name.length > 100) {
    return { ok: false, error: "Enter your name (100 characters or fewer)." };
  }
  const name = validateName(input.name);
  if (!name.valid) return { ok: false, error: name.error || "Enter a valid name." };

  if (typeof input.email !== "string" || input.email.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const email = validateEmail(input.email);
  if (!email.valid) return { ok: false, error: email.error || "Enter a valid email address." };

  if (typeof input.description !== "string") {
    return { ok: false, error: "Describe what you need built." };
  }
  const description = input.description.trim();
  if (description.length < 20 || description.length > 3000) {
    return { ok: false, error: "Describe your project in 20 to 3000 characters." };
  }

  if (
    !Array.isArray(input.tech_stack) || input.tech_stack.length > 10 ||
    input.tech_stack.some((tech) => typeof tech !== "string" || tech.trim().length > 50)
  ) {
    return { ok: false, error: "Add up to 10 technologies (50 characters each)." };
  }
  const seen = new Set<string>();
  const techStack: string[] = [];
  for (const rawTech of input.tech_stack as string[]) {
    const tech = rawTech.trim();
    if (tech && !seen.has(tech.toLowerCase())) {
      seen.add(tech.toLowerCase());
      techStack.push(tech);
    }
  }

  if (!PROJECT_TYPES.has(input.project_type as TaskRequest["project_type"])) {
    return { ok: false, error: "Choose a valid project type." };
  }
  if (!TIMELINES.has(input.timeline as TaskRequest["timeline"])) {
    return { ok: false, error: "Choose a valid timeline." };
  }
  if (!BUDGETS.has(input.budget as TaskRequest["budget"])) {
    return { ok: false, error: "Choose a valid budget range." };
  }

  return {
    ok: true,
    value: {
      name: name.cleaned,
      email: email.cleaned,
      description,
      tech_stack: techStack,
      project_type: input.project_type as TaskRequest["project_type"],
      timeline: input.timeline as TaskRequest["timeline"],
      budget: input.budget as TaskRequest["budget"],
      source: "agent_find",
      consent_at: new Date().toISOString(),
      status: "new",
    },
  };
}
