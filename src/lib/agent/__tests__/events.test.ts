import { describe, it, expect } from "vitest";
import { encodeAgentEvent, decodeAgentEvents, type AgentStreamEvent } from "../events";

describe("agent event stream protocol", () => {
  it("round-trips a batch of events", () => {
    const events: AgentStreamEvent[] = [
      { type: "status", label: "Searching builders…" },
      { type: "builders", builders: [] },
      { type: "token", text: "Here are your matches.\nTop pick first." },
      { type: "done" },
    ];
    const wire = events.map(encodeAgentEvent).join("");
    const { events: decoded, rest } = decodeAgentEvents(wire);
    expect(decoded).toEqual(events);
    expect(rest).toBe("");
  });

  it("holds back a partial trailing line for the next chunk", () => {
    const full = encodeAgentEvent({ type: "token", text: "hello" });
    const cut = full.slice(0, 10);
    const first = decodeAgentEvents(cut);
    expect(first.events).toEqual([]);
    expect(first.rest).toBe(cut);

    const second = decodeAgentEvents(first.rest + full.slice(10));
    expect(second.events).toEqual([{ type: "token", text: "hello" }]);
    expect(second.rest).toBe("");
  });

  it("survives newlines inside token text (JSON-escaped on the wire)", () => {
    const event: AgentStreamEvent = { type: "token", text: "line one\n\nline two" };
    const { events } = decodeAgentEvents(encodeAgentEvent(event));
    expect(events).toEqual([event]);
  });

  it("skips malformed or foreign lines instead of dying", () => {
    const wire =
      "not json at all\n" +
      encodeAgentEvent({ type: "token", text: "ok" }) +
      '{"noType":true}\n' +
      "\n";
    const { events } = decodeAgentEvents(wire);
    expect(events).toEqual([{ type: "token", text: "ok" }]);
  });
});
