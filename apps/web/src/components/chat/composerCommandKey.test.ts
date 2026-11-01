import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { expect, it, vi } from "vite-plus/test";
import { composerCommandKeyHandler } from "./composerCommandKey";

function setup() {
  const input = {
    keybindings: DEFAULT_RESOLVED_KEYBINDINGS,
    sendShortcut: "enter",
    routeKind: "server",
    phase: "ready",
    isCompacting: false,
    followUpBehavior: "queue",
    isSoftwareKeyboardOpen: false,
    planModeUiEnabled: true,
    isLiteralPendingAnswer: false,
    promptSuggestion: { text: "Run the checks", dismiss: vi.fn() },
    pendingUserInputs: [],
    promptHistoryMessages: [],
    promptHistoryPositionRef: { current: null },
    composerDraftTarget: {
      environmentId: EnvironmentId.make("environment"),
      threadId: ThreadId.make("thread"),
    },
    promptRef: { current: "" },
    composerImagesRef: { current: [] },
    composerFilesRef: { current: [] },
    composerTerminalContextsRef: { current: [] },
    composerPreviewAnnotations: [],
    composerReviewComments: [],
    composerEditorRef: { current: null },
    composerMenuOpenRef: { current: Boolean(false) },
    composerMenuItemsRef: { current: [] },
    activeComposerMenuItemRef: { current: null },
    setComposerDraftPrompt: vi.fn(),
    setComposerCursor: vi.fn(),
    setComposerTrigger: vi.fn(),
    setComposerHighlightedItemId: vi.fn(),
    dismissComposerTrigger: vi.fn(),
    toggleInteractionMode: vi.fn(),
    nudgeComposerMenuHighlight: vi.fn(),
    onSelectComposerItem: vi.fn(),
    resolveActiveComposerTrigger: () => ({ trigger: null }),
    readComposerSnapshot: () => ({ value: "" }),
    applyPromptReplacement: () => false,
    submitComposer: vi.fn(),
  } satisfies Parameters<typeof composerCommandKeyHandler>[0];
  return { input, handle: composerCommandKeyHandler(input) };
}

function keyEvent(key: string, overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    keyCode: 0,
    ...overrides,
  } as KeyboardEvent;
}

it.each(["Tab", "ArrowRight", "Escape"])("handles the native suggestion with %s", (key) => {
  const { input, handle } = setup();
  expect(handle(key, keyEvent(key))).toBe(true);
  expect(input.promptSuggestion.dismiss).toHaveBeenCalledOnce();
  expect(input.submitComposer).not.toHaveBeenCalled();
  if (key === "Escape") {
    expect(input.setComposerDraftPrompt).not.toHaveBeenCalled();
    expect(input.promptRef.current).toBe("");
  } else {
    expect(input.setComposerDraftPrompt).toHaveBeenCalledWith(
      input.composerDraftTarget,
      "Run the checks",
    );
    expect(input.promptRef.current).toBe("Run the checks");
    expect(input.setComposerCursor).toHaveBeenCalledWith(14);
  }
});

it("preserves typed drafts, input composition, menus and the plan shortcut", () => {
  const { input, handle } = setup();
  input.promptRef.current = "My message";
  expect(handle("ArrowRight", keyEvent("ArrowRight"))).toBe(false);
  input.promptRef.current = "";
  expect(handle("Tab", keyEvent("Tab", { isComposing: true }))).toBe(false);
  expect(handle("Tab", keyEvent("Tab", { keyCode: 229 }))).toBe(false);
  expect(handle("Tab", keyEvent("Tab", { shiftKey: true }))).toBe(true);
  expect(input.toggleInteractionMode).toHaveBeenCalledOnce();
  input.composerMenuOpenRef.current = true;
  expect(handle("Escape", keyEvent("Escape"))).toBe(true);
  expect(input.dismissComposerTrigger).toHaveBeenCalledOnce();
  expect(input.promptSuggestion.dismiss).not.toHaveBeenCalled();
  expect(input.setComposerDraftPrompt).not.toHaveBeenCalled();
});
