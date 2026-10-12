// @vitest-environment-options {"url":"https://lichess.org/paste"}
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { jobSchema, type Job } from "../src/transfer/job";
import { normal } from "./fixtures/games";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/platform/client", () => ({ send: mocks.send }));
vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      onChanged: { addListener: mocks.add, removeListener: mocks.remove },
    },
  },
}));
import { mountLichess } from "../src/lichess/integration";
let cleanup: (() => void) | undefined;
let job: Job;
beforeEach(() => {
  vi.clearAllMocks();
  job = jobSchema.parse({
    id: "8e76ad73-4109-4e7b-8799-8b0afc0eb192",
    fingerprint: "abc",
    sourceTab: 1,
    destinationTab: 2,
    created: 0,
    expires: 999999,
    phase: "opening",
    content: {
      kind: "game",
      pgn: normal,
      orientation: "white",
      plies: 10,
      note: "Full game",
    },
    message: "Opening",
    analysisRequested: false,
  });
  mocks.send.mockImplementation(async (msg) => {
    if (msg.type === "hello") return { job };
    if (msg.type === "status") return { consented: true, jobs: [] };
    return { job };
  });
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
});
function form(loggedOut = false) {
  document.body.innerHTML = `<main><form action="/import" method="post"><textarea name="pgn"></textarea><input type="checkbox" name="analyse"><button type="submit">Import game</button></form>${loggedOut ? '<a href="/login">Sign in</a>' : ""}</main>`;
  history.replaceState(null, "", `/paste#knight-bridge=${job.id}`);
}
it("does not fill an independently opened form", async () => {
  form();
  mocks.send.mockResolvedValue({ job: null });
  cleanup = await mountLichess();
  expect(document.querySelector("textarea")?.value).toBe("");
  expect(document.getElementById("knight-bridge")).toBeNull();
});
it("preserves pending content on sign-in and offers the real login link", async () => {
  form(true);
  cleanup = await mountLichess();
  expect(document.querySelector("textarea")?.value).toBe(normal);
  expect(document.querySelector("input")?.checked).toBe(false);
  expect(mocks.send).toHaveBeenCalledWith({
    type: "event",
    id: job.id,
    event: "sign-in",
  });
  expect(
    document.getElementById("knight-bridge")?.shadowRoot?.textContent,
  ).toContain("30 minutes");
});
it("prepares signed-in native form and persists intent before submission", async () => {
  form();
  const native = document.querySelector("form");
  if (!native) throw new Error();
  const submit = vi.spyOn(native, "requestSubmit").mockImplementation(() => {
    native.dispatchEvent(new SubmitEvent("submit", { cancelable: true }));
  });
  cleanup = await mountLichess();
  expect(document.querySelector("input")?.checked).toBe(true);
  expect(submit).toHaveBeenCalled();
  native.dispatchEvent(new SubmitEvent("submit", { cancelable: true }));
  native.dispatchEvent(new SubmitEvent("submit", { cancelable: true }));
  await Promise.resolve();
  expect(
    mocks.send.mock.calls.filter(([m]) => m.event === "submitted"),
  ).toHaveLength(1);
  expect(submit).toHaveBeenCalledTimes(2);
});
it("will not replay an uncertain submission on reload", async () => {
  form();
  job.phase = "submitted";
  cleanup = await mountLichess();
  expect(document.querySelector("button")?.disabled).toBe(true);
  expect(
    document.getElementById("knight-bridge")?.shadowRoot?.textContent,
  ).toContain("already submitted");
});
