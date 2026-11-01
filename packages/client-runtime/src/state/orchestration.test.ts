import { expect, it } from "@effect/vitest";
import { AtomRegistry } from "effect/reactivity";
import { dismissedPromptSuggestion } from "./orchestration.ts";

it("keeps dismissals for each thread and run when switching composers", () => {
  const registry = AtomRegistry.make();
  try {
    const first = dismissedPromptSuggestion("environment:thread-a:run-1");
    const second = dismissedPromptSuggestion("environment:thread-b:run-1");
    registry.set(first, true);
    registry.set(second, true);
    expect(registry.get(first)).toBe(true);
    expect(registry.get(second)).toBe(true);
    expect(registry.get(dismissedPromptSuggestion("environment:thread-a:run-2"))).toBe(false);
    expect(registry.get(dismissedPromptSuggestion("other:thread-a:run-1"))).toBe(false);
  } finally {
    registry.dispose();
  }
});
