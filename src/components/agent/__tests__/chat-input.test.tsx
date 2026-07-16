// Regression test for the "click the box again after every message" bug:
// the input used to get `disabled` while the bot streamed, which blurs it in
// real browsers and forced a re-click before typing the next message. The
// input must stay enabled (and focused) for the whole send → stream → send
// cycle; only submission is gated.

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { ChatInput } from "@/components/agent/chat-input";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeAll(() => {
  // jsdom has no matchMedia; the component autofocuses on fine pointers.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: true })
  );
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function render(ui: React.ReactElement) {
  if (!root) {
    container = document.body.appendChild(document.createElement("div"));
    root = createRoot(container);
  }
  await act(async () => root!.render(ui));
}

/** Simulate the user typing: native setter + input event → React onChange. */
async function type(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Simulate Enter / send: the form's submit event (implicit submission). */
async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("ChatInput", () => {
  it("stays enabled and focused across a full send → streaming → send cycle", async () => {
    const onSend = vi.fn();
    await render(<ChatInput onSend={onSend} disabled={false} />);
    const input = container!.querySelector("input")!;
    const form = container!.querySelector("form")!;

    // Autofocused on mount — ready to type without a click.
    expect(document.activeElement).toBe(input);

    await type(input, "find me a rust dev");
    await submit(form);
    expect(onSend).toHaveBeenCalledWith("find me a rust dev");
    expect(input.value).toBe("");

    // Parent flips to streaming: the send path is gated, but the input
    // element must NOT be disabled (disabling is what dropped focus).
    await render(<ChatInput onSend={onSend} disabled={true} />);
    expect(input.disabled).toBe(false);
    expect(document.activeElement).toBe(input);

    // Typing the next message mid-stream works; sending it is blocked.
    await type(input, "and how do streaks work?");
    await submit(form);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("and how do streaks work?"); // draft preserved

    // Stream ends — Enter sends the kept draft, still without any re-click.
    await render(<ChatInput onSend={onSend} disabled={false} />);
    await submit(form);
    expect(onSend).toHaveBeenLastCalledWith("and how do streaks work?");
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("ignores empty submissions", async () => {
    const onSend = vi.fn();
    await render(<ChatInput onSend={onSend} disabled={false} />);
    const form = container!.querySelector("form")!;

    await submit(form);
    await type(container!.querySelector("input")!, "   ");
    await submit(form);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps the send button gated while streaming or empty", async () => {
    await render(<ChatInput onSend={() => {}} disabled={true} />);
    const input = container!.querySelector("input")!;
    const button = container!.querySelector("button[type=submit]")! as HTMLButtonElement;

    expect(button.disabled).toBe(true); // streaming
    await type(input, "hello");
    expect(button.disabled).toBe(true); // streaming still wins

    await render(<ChatInput onSend={() => {}} disabled={false} />);
    expect(button.disabled).toBe(false); // has text, not streaming
  });
});
