/**
 * Tests for feed anonymization helpers.
 *
 * anonymizePrivateEventMessage is privacy-critical: it's the text shown in
 * the public feed for a private-repo event when the owner has opted into
 * sharing. These tests lock the mapping so a future edit can't accidentally
 * leak a repo name / commit subject through the message, or change the copy
 * silently.
 */
import { describe, it, expect } from "vitest";
import { anonymizePrivateEventMessage } from "../feed-utils";

describe("anonymizePrivateEventMessage", () => {
  it("maps each known event type to a generic private-repo message", () => {
    expect(anonymizePrivateEventMessage("pr")).toBe(
      "opened a pull request in a private repo"
    );
    expect(anonymizePrivateEventMessage("create")).toBe(
      "made changes in a private repo"
    );
    expect(anonymizePrivateEventMessage("issue")).toBe(
      "opened an issue in a private repo"
    );
    expect(anonymizePrivateEventMessage("push")).toBe("pushed to a private repo");
  });

  it("falls back to the push message for null/undefined/unknown types", () => {
    expect(anonymizePrivateEventMessage(null)).toBe("pushed to a private repo");
    expect(anonymizePrivateEventMessage(undefined)).toBe(
      "pushed to a private repo"
    );
    expect(anonymizePrivateEventMessage("something_unexpected")).toBe(
      "pushed to a private repo"
    );
  });

  it("never echoes back the input (no repo/commit data can leak through)", () => {
    const secret = "my-secret-private-repo-name";
    expect(anonymizePrivateEventMessage(secret)).not.toContain(secret);
  });
});
