// Orchestrates one VibeFinder turn: stream model output, execute any tool
// calls against live data, feed results back, repeat — all piped to the
// client as NDJSON events.

import { streamDeepSeekCompletion, type ChatMessage } from "@/lib/deepseek";
import { AGENT_TOOLS, executeAgentTool } from "./tools";
import { buildAgentSystemPrompt, type ViewerContext } from "./prompt";
import { encodeAgentEvent, type AgentStreamEvent } from "./events";

// Cost ceiling: at most 3 tool rounds, then one forced plain-text answer —
// so a single user message can never spend more than 4 completions.
const MAX_TOOL_ROUNDS = 3;
// A single completion can request many parallel tool calls; each one hits the
// database. Execute only this many per round — the rest get an error payload
// (every tool_call_id still needs a response or the next completion is
// rejected upstream).
const MAX_CALLS_PER_ROUND = 3;

const TOOL_STATUS: Record<string, string> = {
  search_builders: "Searching builders…",
  get_builder: "Pulling up the profile…",
  get_platform_stats: "Checking platform stats…",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export function runAgentTurn(opts: {
  supabase: AnyClient;
  history: ChatMessage[];
  viewer: ViewerContext | null;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentStreamEvent) =>
        controller.enqueue(encoder.encode(encodeAgentEvent(event)));

      try {
        const messages: ChatMessage[] = [
          { role: "system", content: buildAgentSystemPrompt(opts.viewer) },
          ...opts.history,
        ];

        let emittedText = false;
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          let emittedThisRound = false;
          const result = await streamDeepSeekCompletion({
            messages,
            tools: AGENT_TOOLS,
            // Last round: force a text answer so a tool-happy model can't loop.
            toolChoice: round === MAX_TOOL_ROUNDS ? "none" : "auto",
            onToken: (token) => {
              // Blank line between narration from a previous round and this one.
              if (!emittedThisRound && emittedText) emit({ type: "token", text: "\n\n" });
              emittedThisRound = true;
              emittedText = true;
              emit({ type: "token", text: token });
            },
          });

          if (result.toolCalls.length === 0) break; // final answer fully streamed

          messages.push({
            role: "assistant",
            content: result.content,
            tool_calls: result.toolCalls,
          });

          for (const [index, call] of result.toolCalls.entries()) {
            if (index >= MAX_CALLS_PER_ROUND) {
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({
                  error: "Tool call limit reached for this round — answer with what you already have.",
                }),
              });
              continue;
            }
            emit({ type: "status", label: TOOL_STATUS[call.function.name] ?? "Working…" });
            const { forLLM, builders } = await executeAgentTool(
              opts.supabase,
              call.function.name,
              call.function.arguments
            );
            if (builders?.length) emit({ type: "builders", builders });
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(forLLM),
            });
          }
        }

        emit({ type: "done" });
      } catch (err) {
        console.error("Agent turn failed:", err);
        emit({
          type: "error",
          message: "The assistant hit a snag. Please try again in a moment.",
        });
      } finally {
        controller.close();
      }
    },
  });
}
