import { it, expect, vi } from "vitest";
vi.mock("../src/platform/client", () => ({
  send: vi.fn(async () => ({ consented: true, jobs: [] })),
}));
vi.mock("wxt/browser", () => ({
  browser: {
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: {
      id: "extension",
      getURL: (path: string) => `moz-extension://test${path}`,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));
import { mountChesscom } from "../src/chesscom/integration";
import { browser } from "wxt/browser";
import { normal } from "./fixtures/games";
it("creates one accessible button and removes it after excluded navigation", async () => {
  vi.useFakeTimers();
  history.replaceState(null, "", "/analysis");
  document.body.innerHTML =
    '<div class="sidebar-component"><div class="game-controls-view-component"><button aria-label="Last Move">Last Move</button></div></div>';
  const cleanup = mountChesscom();
  document.dispatchEvent(new Event("click"));
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelectorAll("#knight-bridge")).toHaveLength(1);
  const root = document.getElementById("knight-bridge")?.shadowRoot;
  expect(root?.querySelector("button")?.textContent).toBe("Analyze on Lichess");
  expect(
    root?.querySelector('[role="status"]')?.getAttribute("aria-live"),
  ).toBe("polite");
  history.replaceState(null, "", "/play/online");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelectorAll("#knight-bridge")).toHaveLength(0);
  cleanup();
  vi.useRealTimers();
});
it("shows the button when live play ends and removes it for a rematch", async () => {
  vi.useFakeTimers();
  history.replaceState(null, "", "/play/online");
  document.body.innerHTML =
    '<div class="sidebar-component"><div class="game-controls-view-component"><button aria-label="Last Move">Last Move</button></div></div>';
  const cleanup = mountChesscom();
  expect(document.getElementById("knight-bridge")).toBeNull();
  const ended = document.createElement("div");
  ended.className = "game-over-component";
  ended.textContent = "Game over · Black won";
  document.body.append(ended);
  await vi.advanceTimersByTimeAsync(200);
  expect(document.getElementById("knight-bridge")).not.toBeNull();
  ended.remove();
  await vi.advanceTimersByTimeAsync(200);
  expect(document.getElementById("knight-bridge")).toBeNull();
  cleanup();
  vi.useRealTimers();
});
it("uses the replay buttons on a completed analysis page", () => {
  history.replaceState(null, "", "/analysis/game/live/123/analysis");
  document.body.innerHTML =
    '<div class="sidebar-component"><span class="analysis-game-title-result">1-0</span><div class="game-controls-primary-component"><button aria-label="Last Move">Last Move</button></div></div>';
  const cleanup = mountChesscom();
  expect(document.getElementById("knight-bridge")).not.toBeNull();
  cleanup();
});
it("shows the button on Chess.com's finished live-game viewer", () => {
  history.replaceState(null, "", "/game/123");
  document.body.innerHTML =
    '<div class="sidebar-component"><div class="main-line-row result-row"><span class="game-result">1-0</span></div><div><button aria-label="Last Move">Last Move</button></div></div>';
  const cleanup = mountChesscom();
  expect(document.getElementById("knight-bridge")).not.toBeNull();
  cleanup();
});
it("floats the completed-game action when live play has no replay controls", () => {
  history.replaceState(null, "", "/play/online");
  document.body.innerHTML =
    '<div class="game-over-modal">Game over · won on time</div>';
  const cleanup = mountChesscom();
  expect(document.getElementById("knight-bridge")?.dataset.layout).toBe(
    "floating",
  );
  cleanup();
});
it("returns the full export only to the extension popup after selection", async () => {
  history.replaceState(null, "", "/analysis/game/live/123/analysis");
  document.body.innerHTML =
    '<div class="sidebar-component"><span class="analysis-game-title-result">1-0</span><button aria-label="Last Move">Last Move</button><textarea aria-label="PGN"></textarea></div>';
  const field = document.querySelector("textarea");
  if (!field) throw new Error();
  field.value = normal;
  const cleanup = mountChesscom();
  const listener = vi
    .mocked(browser.runtime.onMessage.addListener)
    .mock.calls.at(-1)?.[0];
  if (!listener) throw new Error("Missing popup extraction listener.");
  const request = { type: "extract-current" };
  expect(
    listener(
      request,
      {
        id: "other-extension",
        url: "moz-extension://test/popup.html",
      },
      () => undefined,
    ),
  ).toBeUndefined();
  const input = await listener(
    request,
    {
      id: "extension",
      url: "moz-extension://test/popup.html",
    },
    () => undefined,
  );
  expect(input).toMatchObject({ kind: "game", text: normal });
  cleanup();
});
