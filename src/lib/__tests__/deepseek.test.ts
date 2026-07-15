import { describe, it, expect } from "vitest";
import { mergeToolCallDelta, type ToolCall } from "@/lib/deepseek";

describe("mergeToolCallDelta", () => {
  it("assembles a call whose name and arguments stream in fragments", () => {
    const acc: ToolCall[] = [];
    mergeToolCallDelta(acc, {
      index: 0,
      id: "call_1",
      type: "function",
      function: { name: "search_", arguments: "" },
    });
    mergeToolCallDelta(acc, { index: 0, function: { name: "builders" } });
    mergeToolCallDelta(acc, { index: 0, function: { arguments: '{"skills":' } });
    mergeToolCallDelta(acc, { index: 0, function: { arguments: '["next.js"]}' } });

    expect(acc).toHaveLength(1);
    expect(acc[0].id).toBe("call_1");
    expect(acc[0].function.name).toBe("search_builders");
    expect(JSON.parse(acc[0].function.arguments)).toEqual({ skills: ["next.js"] });
  });

  it("keeps parallel tool calls separate by index", () => {
    const acc: ToolCall[] = [];
    mergeToolCallDelta(acc, {
      index: 0,
      id: "call_a",
      function: { name: "get_builder", arguments: '{"username":"a"}' },
    });
    mergeToolCallDelta(acc, {
      index: 1,
      id: "call_b",
      function: { name: "get_builder", arguments: '{"username":"b"}' },
    });

    expect(acc).toHaveLength(2);
    expect(acc[0].id).toBe("call_a");
    expect(acc[1].id).toBe("call_b");
    expect(JSON.parse(acc[1].function.arguments)).toEqual({ username: "b" });
  });
});
