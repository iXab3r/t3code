import { WORKING_EXIT_GRACE_MS } from "@t3tools/client-runtime/state/thread-inbox";
import type { AnyRouter } from "@tanstack/react-router";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { Atom, AtomRegistry } from "effect/reactivity";
import { expect, it, vi } from "vite-plus/test";

import { fakeTimers, stubGlobal } from "../../test/render";
import { useUiStateStore } from "../uiStateStore";

const state = vi.hoisted(() => ({
  mode: "notifications",
  inApp: false,
  toast: vi.fn(),
  shells: null as unknown as { set: (id: string, value: unknown) => void },
  navigate: vi.fn(),
  sound: vi.fn(),
  badge: vi.fn(),
  settingsListeners: new Set<() => void>(),
}));
vi.mock(import("./ui/toast"), async (original) => {
  const actual = await original();
  return { ...actual, toastManager: { ...actual.toastManager, add: state.toast as never } };
});
vi.mock(import("../state/shell"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    environmentShell: {
      ...actual.environmentShell,
      stateValueAtom: ((id: string) => shellAtom(id)) as never,
    },
  };
});
vi.mock(import("../state/presentation"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    environmentSummaries: {
      ...actual.environmentSummaries,
      // Read lazily: the factory runs before this module's own bindings exist.
      get environmentIdsAtom() {
        return environmentIdsAtom as never;
      },
    },
  };
});
vi.mock(import("../state/threads"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    environmentThreadShells: {
      ...actual.environmentThreadShells,
      pendingSubagentRequestsAtom: (() => noRequestsAtom) as never,
      get delegatedUnderParentAtom() {
        return noDelegatedAtom as never;
      },
    },
  };
});
vi.mock(import("../hooks/useSettings"), async (original) => ({
  ...(await original()),
  subscribeClientSettings: ((listener: () => void) => {
    state.settingsListeners.add(listener);
    return () => state.settingsListeners.delete(listener);
  }) as never,
  getClientSettings: (() => ({
    notificationMode: state.mode,
    inAppNotificationsEnabled: state.inApp,
  })) as never,
}));
vi.mock(import("../threadNotifications"), async (original) => ({
  ...(await original()),
  playNotificationSound: state.sound,
  unlockNotificationAudio: vi.fn(),
  setNotificationBadge: state.badge,
}));

import { startThreadNotifications } from "./ThreadNotificationCoordinator";

let registry: AtomRegistry.AtomRegistry;
const shellAtom = Atom.family((_id: string) => Atom.make<unknown>(null));
const environmentIdsAtom = Atom.make<ReadonlyArray<string>>([]);
const noRequestsAtom = Atom.make(new Map());
const noDelegatedAtom = Atom.make<ReadonlySet<string>>(new Set<string>());
state.shells = { set: (id, value) => registry.set(shellAtom(id), value) };

class TestNotification extends EventTarget {
  static permission = "granted";
  static sent: TestNotification[] = [];
  close = vi.fn();
  get tag() {
    return this.options.tag ?? "";
  }
  constructor(
    readonly title: string,
    readonly options: NotificationOptions,
  ) {
    super();
    TestNotification.sent.push(this);
  }
}

const thread = {
  id: "thread",
  title: "Test thread",
  archivedAt: null as string | null,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  lastVisitedAt: "2026-09-13T06:59:00.000Z" as string | null | undefined,
  settledOverride: null as "settled" | null,
  snoozedUntil: null as string | null,
  deletedAt: null as string | null,
  parentThreadId: null as string | null,
  session: null as { status: string } | null,
  latestTurn: { turnId: "turn", state: "running", completedAt: null as string | null },
};
let focused = false;
let visibility = "visible";

const SHELL_NOW = DateTime.makeUnsafe("2026-09-13T07:00:00.000Z");

function toV2ThreadShell(input: typeof thread) {
  const latestTurn = input.latestTurn;
  return {
    id: input.id,
    projectId: "project",
    title: input.title,
    providerInstanceId: "codex",
    modelSelection: { instanceId: "codex", model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    activeProviderThreadId: null,
    lineage: {
      rootThreadId: input.id,
      parentThreadId: input.parentThreadId,
      relationshipToParent: input.parentThreadId ? "subagent" : null,
    },
    forkedFrom: null,
    createdBy: "user",
    creationSource: "web",
    latestRunId: latestTurn.turnId,
    activeRunId: null,
    status:
      latestTurn.state === "completed"
        ? "completed"
        : latestTurn.state === "error" || input.session?.status === "error"
          ? "failed"
          : "running",
    pendingRuntimeRequest: input.hasPendingUserInput
      ? { id: "request-1", kind: "user_input", createdAt: SHELL_NOW }
      : input.hasPendingApprovals
        ? { id: "request-1", kind: "command", createdAt: SHELL_NOW }
        : null,
    latestVisibleMessage: null,
    latestUserMessageAt: null,
    hasActionableProposedPlan: false,
    itemCount: 0,
    visibleItemCount: 0,
    createdAt: SHELL_NOW,
    updatedAt: SHELL_NOW,
    latestRunRequestedAt: SHELL_NOW,
    latestRunStartedAt: SHELL_NOW,
    latestRunCompletedAt: latestTurn.completedAt
      ? DateTime.makeUnsafe(latestTurn.completedAt)
      : undefined,
    archivedAt: input.archivedAt ? DateTime.makeUnsafe(input.archivedAt) : null,
    settledOverride: input.settledOverride,
    settledAt: null,
    snoozedUntil: input.snoozedUntil ? DateTime.makeUnsafe(input.snoozedUntil) : null,
    lastVisitedAt:
      input.lastVisitedAt == null ? input.lastVisitedAt : DateTime.makeUnsafe(input.lastVisitedAt),
    deletedAt: input.deletedAt ? DateTime.makeUnsafe(input.deletedAt) : null,
  };
}

function shell(overrides: Partial<typeof thread> = {}, ...others: Partial<typeof thread>[]) {
  return {
    status: "live",
    snapshot: Option.some({
      threads: [overrides, ...others].map((override) =>
        toV2ThreadShell({ ...thread, ...override }),
      ),
    }),
  };
}
// The mocked modules read `state` and the focus flags, so every test resets them before
// starting the service.
function setup() {
  vi.clearAllMocks();
  const stack = new AsyncDisposableStack();
  const priorVisits = useUiStateStore.getState().threadLastVisitedAtById;
  stack.defer(() => useUiStateStore.setState({ threadLastVisitedAtById: priorVisits }));
  registry = AtomRegistry.make();
  const testRegistry = registry;
  stack.defer(() => testRegistry.dispose());
  state.mode = "notifications";
  state.inApp = false;
  state.settingsListeners.clear();
  registry.set(environmentIdsAtom, ["one", "two"]);
  state.shells.set("one", shell());
  state.shells.set("two", shell());
  focused = false;
  visibility = "visible";
  TestNotification.permission = "granted";
  TestNotification.sent = [];
  stack.use(stubGlobal("Notification", TestNotification));
  stack.use(vi.spyOn(window, "focus").mockImplementation(() => undefined));
  stack.use(vi.spyOn(document, "hasFocus").mockImplementation(() => focused));
  stack.use(
    vi
      .spyOn(document, "visibilityState", "get")
      .mockImplementation(() => visibility as DocumentVisibilityState),
  );
  const router = {
    state: { matches: [{ params: {} }] },
    navigate: state.navigate,
  } as unknown as AnyRouter;
  return {
    start: () => {
      stack.defer(startThreadNotifications(testRegistry, router));
    },
    setEnvironmentIds: (ids: ReadonlyArray<string>) => testRegistry.set(environmentIdsAtom, ids),
    changeSettings: () => {
      for (const listener of state.settingsListeners) listener();
    },
    [Symbol.asyncDispose]: () => stack.disposeAsync(),
  };
}

it.each(["hasPendingApprovals", "hasPendingUserInput"] as const)(
  "badges %s and clears when notifications are disabled",
  async (flag) => {
    await using app = setup();
    app.start();
    state.shells.set("one", shell({ [flag]: true }));
    expect(state.badge).toHaveBeenLastCalledWith(1);
    const notification = TestNotification.sent[0]!;
    notification.dispatchEvent(new Event("click"));
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/$environmentId/$threadId",
      params: { environmentId: EnvironmentId.make("one"), threadId: "thread" },
    });
    state.mode = "sound";
    app.changeSettings();
    expect(state.badge).toHaveBeenLastCalledWith(0);
    expect(notification.close).toHaveBeenCalled();
  },
);

it("holds a completion through a continuation gap and notifies once it settles", async () => {
  await using app = setup();
  app.start();
  using _timers = fakeTimers();
  const finished = (turnId: string, completedAt: string) => ({
    latestTurn: { turnId, state: "completed", completedAt },
  });
  state.shells.set("one", shell(finished("turn-1", "2026-09-13T07:00:01.000Z")));
  state.shells.set(
    "one",
    shell({ latestTurn: { turnId: "turn-2", state: "running", completedAt: null } }),
  );
  state.shells.set("one", shell(finished("turn-2", "2026-09-13T07:00:02.000Z")));
  expect(TestNotification.sent).toEqual([]);
  await vi.advanceTimersByTimeAsync(WORKING_EXIT_GRACE_MS - 1);
  expect(TestNotification.sent).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(TestNotification.sent.map((sent) => sent.title)).toEqual(["Thread completed"]);
});

it.each(["hasPendingApprovals", "hasPendingUserInput"] as const)(
  "notifies for offline completion and %s once across reconnects",
  async (flag) => {
    await using app = setup();
    const asking = { id: "asking", hasPendingApprovals: true };
    const offline = { id: "offline", [flag]: true };
    const done = {
      id: "done",
      latestTurn: {
        turnId: "done-turn",
        state: "completed",
        completedAt: "2026-09-13T07:00:00.000Z",
      },
    };
    state.shells.set("one", shell({ id: "working" }, { id: "asking" }, { id: "offline" }, done));
    app.start();
    using _timers = fakeTimers();
    state.shells.set("one", shell({ id: "working" }, asking, { id: "offline" }, done));
    state.shells.set("one", {
      ...shell({ id: "working" }, asking, { id: "offline" }, done),
      status: "cached",
    });

    const completed = {
      id: "working",
      latestTurn: { turnId: "turn", state: "completed", completedAt: "2026-09-13T07:05:00.000Z" },
    };
    state.shells.set("one", {
      ...shell(completed, asking, offline, done),
      status: "synchronizing",
    });
    state.shells.set("one", shell(completed, asking, offline, done));

    expect(TestNotification.sent.map(({ title }) => title)).toEqual([
      "Approval needed",
      flag === "hasPendingApprovals" ? "Approval needed" : "Input needed",
    ]);
    await vi.advanceTimersByTimeAsync(WORKING_EXIT_GRACE_MS);
    state.shells.set("one", { ...shell(completed, asking, offline, done), status: "cached" });
    state.shells.set("one", shell(completed, asking, offline, done));
    await vi.advanceTimersByTimeAsync(WORKING_EXIT_GRACE_MS);
    expect(TestNotification.sent.map(({ title }) => title)).toEqual([
      "Approval needed",
      flag === "hasPendingApprovals" ? "Approval needed" : "Input needed",
      "Thread completed",
    ]);
  },
);

it.each([false, true])(
  "rechecks a pending completion after reconnect (continued: %s)",
  async (continued) => {
    await using app = setup();
    app.start();
    using _timers = fakeTimers();
    const completed = shell({
      latestTurn: { turnId: "turn", state: "completed", completedAt: "2026-09-13T07:05:00.000Z" },
    });
    state.shells.set("one", completed);
    state.shells.set("one", { ...completed, status: "cached" });
    await vi.advanceTimersByTimeAsync(WORKING_EXIT_GRACE_MS);
    expect(TestNotification.sent).toEqual([]);
    state.shells.set("one", continued ? shell() : completed);
    await vi.advanceTimersByTimeAsync(WORKING_EXIT_GRACE_MS);
    expect(TestNotification.sent.map(({ title }) => title)).toEqual(
      continued ? [] : ["Thread completed"],
    );
  },
);

it("keeps unread completions across focus and acknowledges each thread separately", async () => {
  await using app = setup();
  const completed = {
    latestTurn: {
      turnId: "finished",
      state: "completed",
      completedAt: "2026-09-13T07:00:01.000Z",
    },
  };
  state.shells.set("one", shell(completed, { ...completed, id: "other" }));
  state.shells.set("two", shell(completed));
  TestNotification.permission = "denied";
  app.start();
  expect(state.badge).toHaveBeenLastCalledWith(3);
  focused = true;
  window.dispatchEvent(new Event("focus"));
  expect(state.badge).toHaveBeenLastCalledWith(3);
  state.shells.set("one", {
    ...shell(completed, { ...completed, id: "other" }),
    status: "cached",
  });
  expect(state.badge).toHaveBeenLastCalledWith(3);
  state.shells.set(
    "one",
    shell(
      { ...completed, lastVisitedAt: "2026-09-13T07:00:01.000Z" },
      { ...completed, id: "other" },
    ),
  );
  expect(state.badge).toHaveBeenLastCalledWith(2);
  state.mode = "off";
  app.changeSettings();
  expect(state.badge).toHaveBeenLastCalledWith(2);
  app.setEnvironmentIds(["one"]);
  expect(state.badge).toHaveBeenLastCalledWith(1);
  state.shells.set("one", shell({ ...completed, lastVisitedAt: completed.latestTurn.completedAt }));
  expect(state.badge).toHaveBeenLastCalledWith(0);
});

it.each([
  { archivedAt: "2026-09-13T07:00:02.000Z" },
  { settledOverride: "settled" as const },
  { snoozedUntil: "2099-01-01T00:00:00.000Z" },
  { deletedAt: "2026-09-13T07:00:02.000Z" },
  { parentThreadId: "parent" },
  { hasPendingUserInput: true },
  { latestTurn: { turnId: "new-run", state: "running", completedAt: null } },
  {
    latestTurn: {
      turnId: "failed-run",
      state: "error",
      completedAt: "2026-09-13T07:00:02.000Z",
    },
  },
])("removes a completion when its thread leaves unread ready state: %j", async (change) => {
  await using app = setup();
  state.mode = "off";
  const completed = {
    latestTurn: {
      turnId: "finished",
      state: "completed",
      completedAt: "2026-09-13T07:00:01.000Z",
    },
  };
  state.shells.set("one", shell(completed));
  app.start();
  expect(state.badge).toHaveBeenLastCalledWith(1);
  state.shells.set("one", shell({ ...completed, ...change }));
  expect(state.badge).toHaveBeenLastCalledWith(0);
  state.shells.set("one", shell(completed));
  expect(state.badge).toHaveBeenLastCalledWith(1);
});

it("deduplicates completion notifications and retains only unread work after focus", async () => {
  await using app = setup();
  app.start();
  using _timers = fakeTimers();
  const completed = {
    latestTurn: {
      turnId: "finished",
      state: "completed",
      completedAt: "2026-09-13T07:00:01.000Z",
    },
  };
  state.shells.set("one", shell(completed));
  await vi.advanceTimersByTimeAsync(WORKING_EXIT_GRACE_MS);
  expect(TestNotification.sent.map((sent) => sent.title)).toEqual(["Thread completed"]);
  expect(state.badge).toHaveBeenLastCalledWith(1);
  state.shells.set("one", shell({ ...completed, lastVisitedAt: completed.latestTurn.completedAt }));
  expect(state.badge).toHaveBeenLastCalledWith(0);
  expect(TestNotification.sent[0]!.close).toHaveBeenCalled();
  state.shells.set("one", shell(completed));
  expect(state.badge).toHaveBeenLastCalledWith(1);
  state.shells.set("two", shell({ hasPendingUserInput: true }));
  expect(state.badge).toHaveBeenLastCalledWith(2);
  focused = true;
  window.dispatchEvent(new Event("focus"));
  expect(state.badge).toHaveBeenLastCalledWith(1);
  expect(TestNotification.sent.every((sent) => sent.close.mock.calls.length > 0)).toBe(true);
  state.shells.set("one", shell({ ...completed, lastVisitedAt: completed.latestTurn.completedAt }));
  expect(state.badge).toHaveBeenLastCalledWith(0);
});

it.each([null, undefined])(
  "counts unopened completions with lastVisitedAt %s",
  async (lastVisitedAt) => {
    await using app = setup();
    state.mode = "off";
    state.shells.set(
      "one",
      shell({
        lastVisitedAt,
        latestTurn: {
          turnId: "finished",
          state: "completed",
          completedAt: "2026-09-13T07:00:01.000Z",
        },
      }),
    );
    app.start();
    expect(state.badge).toHaveBeenLastCalledWith(1);
    if (lastVisitedAt === undefined) {
      const key = scopedThreadKey({
        environmentId: EnvironmentId.make("one"),
        threadId: ThreadId.make("thread"),
      });
      useUiStateStore.getState().markThreadVisited(key, "2026-09-13T07:00:01.000Z");
      expect(state.badge).toHaveBeenLastCalledWith(0);
    }
  },
);
