import * as Effect from "effect/Effect";
import { beforeEach, expect, vi } from "vite-plus/test";
import { it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";

const native = vi.hoisted(() => ({
  setBadgeCount: vi.fn(),
  setOverlayIcon: vi.fn(),
  isDestroyed: vi.fn(() => false),
  getFocusedWindow: vi.fn(() => null as object | null),
  image: { isEmpty: vi.fn(() => false) },
  createFromDataURL: vi.fn(),
  webContents: { send: vi.fn() },
  listeners: new Map<string, () => void>(),
}));
vi.mock("electron", () => ({
  app: {
    setBadgeCount: native.setBadgeCount,
    on: (event: string, listener: () => void) => native.listeners.set(event, listener),
    removeListener: (event: string) => native.listeners.delete(event),
  },
  BrowserWindow: {
    getFocusedWindow: native.getFocusedWindow,
    getAllWindows: () => [native],
  },
  nativeImage: { createFromDataURL: native.createFromDataURL },
}));

import * as ElectronApp from "../../electron/ElectronApp.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import { installNotificationBadge } from "./notificationBadge.ts";

const badge = { count: 2, image: "data:image/png;base64,aGVsbG8=" };

beforeEach(() => {
  vi.clearAllMocks();
  native.getFocusedWindow.mockReturnValue(null);
  native.isDestroyed.mockReturnValue(false);
  native.image.isEmpty.mockReturnValue(false);
  native.createFromDataURL.mockReturnValue(native.image);
  native.setBadgeCount.mockImplementation(() => true);
  native.listeners.clear();
});

it.effect.each(["linux", "darwin", "win32"] as const)(
  "%s validates IPC, preserves the badge on focus, and clears on quit and disposal",
  (platform) =>
    Effect.gen(function* () {
      const expectBadge = (count: number) => {
        if (platform === "win32") {
          expect(native.setOverlayIcon).toHaveBeenLastCalledWith(
            count > 0 ? native.image : null,
            count > 0 ? `${count} threads with new notifications` : "",
          );
        } else {
          expect(native.setBadgeCount).toHaveBeenLastCalledWith(count);
        }
      };
      const handlers = new Map<string, DesktopIpc.DesktopIpcHandleListener>();
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* installNotificationBadge();
          const handler = handlers.get("desktop:set-notification-badge")!;
          const event = { sender: { id: 1 } };
          for (const invalid of [
            { ...badge, count: -1 },
            { ...badge, count: 0.5 },
            { ...badge, count: Infinity },
            { ...badge, image: "https://example.com/icon.png" },
            { ...badge, image: `data:image/png;base64,${"a".repeat(16_384)}` },
          ]) {
            yield* Effect.promise(() => expect(handler(event, invalid)).rejects.toBeDefined());
          }
          expect(native.setBadgeCount).not.toHaveBeenCalled();
          expect(native.setOverlayIcon).not.toHaveBeenCalled();
          yield* Effect.promise(() => Promise.resolve(handler(event, badge)));
          expectBadge(2);
          native.listeners.get("browser-window-focus")!();
          expectBadge(2);
          expect(native.webContents.send).toHaveBeenCalledWith("desktop:set-notification-badge");
          native.getFocusedWindow.mockReturnValue({});
          yield* Effect.promise(() => Promise.resolve(handler(event, badge)));
          expectBadge(2);
          expect(native.webContents.send).toHaveBeenCalledTimes(1);
          yield* Effect.promise(() => Promise.resolve(handler(event, { count: 0, image: null })));
          expectBadge(0);
          expect(native.webContents.send).toHaveBeenCalledTimes(1);
          native.getFocusedWindow.mockReturnValue(null);
          yield* Effect.promise(() => Promise.resolve(handler(event, badge)));
          native.listeners.get("before-quit")!();
          expectBadge(0);
        }),
      ).pipe(
        Effect.provideService(HostProcess.Platform, platform),
        Effect.provide([
          ElectronApp.layer,
          DesktopIpc.layer({
            handle: (channel, handler) => {
              handlers.set(channel, handler);
            },
            removeHandler: (channel) => {
              handlers.delete(channel);
            },
            on: vi.fn(),
            removeAllListeners: vi.fn(),
          }),
        ]),
      );
      expectBadge(0);
      expect(native.listeners.size).toBe(0);
      expect(handlers.size).toBe(0);
    }),
);
