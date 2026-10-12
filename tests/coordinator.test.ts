import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { Coordinator, type Platform } from "../src/transfer/coordinator";
import {
  type Job,
  TTL,
  destination,
  importResultUrl,
} from "../src/transfer/job";
import {
  senderRole,
  messageSchema,
  type Draft,
} from "../src/platform/messages";
import { normal } from "./fixtures/games";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
function harness() {
  let stored: Job[] = [],
    drafts: Draft[] = [],
    consented = true,
    now = 1_000,
    serial = 100;
  const urls = new Map<number, string>([
    [1, "https://www.chess.com/analysis/game/live/123"],
    [2, "https://www.chess.com/analysis/game/live/123"],
  ]);
  const platform: Platform = {
    extensionId: "extension",
    popupUrl: "moz-extension://test/popup.html",
    read: async () => structuredClone(stored),
    write: async (jobs) => {
      stored = structuredClone(jobs);
    },
    readDrafts: async () => structuredClone(drafts),
    writeDrafts: async (next) => {
      drafts = structuredClone(next);
    },
    consent: async () => consented,
    setConsent: async () => {
      consented = true;
    },
    clear: async () => {
      stored = [];
      drafts = [];
      consented = false;
    },
    create: async () => {
      urls.set(++serial, "about:blank");
      return serial;
    },
    navigate: async (tab, url) => {
      urls.set(tab, url);
    },
    focus: async (tab) => {
      if (!urls.has(tab)) throw new Error("closed");
    },
    tabUrl: async (tab) => urls.get(tab),
  };
  const popup = { id: "extension", url: platform.popupUrl };
  let coordinator = new Coordinator(platform, () => now);
  const start = (tab = 1, text = normal) =>
    coordinator.handle(
      {
        type: "start",
        input: { kind: "game", text, orientation: "white" },
        sourceTab: tab,
      },
      popup,
    );
  const source = (job: Job) => ({
    id: "extension",
    url: urls.get(job.destinationTab ?? 0),
    tab: { id: job.destinationTab },
    frameId: 0,
  });
  return {
    platform,
    popup,
    start,
    source,
    urls,
    get jobs() {
      return stored;
    },
    get drafts() {
      return drafts;
    },
    get c() {
      return coordinator;
    },
    restart() {
      coordinator = new Coordinator(platform, () => now);
    },
    expire() {
      now += TTL + 1;
    },
  };
}
describe("persisted transfer coordinator", () => {
  it("restores only the selected tab's export and discards it when play resumes", async () => {
    const h = harness();
    h.urls.set(1, "https://www.chess.com/play/online");
    const source = {
      id: "extension",
      url: h.urls.get(1),
      tab: { id: 1 },
      frameId: 0,
    };
    await h.c.handle(
      {
        type: "prepare",
        input: {
          kind: "game",
          text: normal,
          sourceUrl: source.url,
          orientation: "black",
        },
      },
      source,
    );
    const selected = await h.c.handle({ type: "status", tab: 1 }, h.popup);
    expect(selected).toMatchObject({
      draft: { sourceTab: 1, input: { text: normal } },
    });
    expect(await h.c.handle({ type: "status", tab: 2 }, h.popup)).toMatchObject(
      {
        draft: null,
      },
    );
    await h.c.handle({ type: "discard-draft" }, source);
    expect(h.drafts).toHaveLength(0);
  });
  it("serializes rapid clicks and separates concurrent tabs", async () => {
    const h = harness();
    await Promise.all([h.start(), h.start(), h.start(2)]);
    expect(h.jobs).toHaveLength(2);
    expect(new Set(h.jobs.map((j) => j.destinationTab)).size).toBe(2);
  });
  it("distinguishes changed content at the same URL", async () => {
    const h = harness();
    await h.start();
    await h.start(1, normal.replace('[White "Zoë 棋手"]', '[White "Other"]'));
    expect(h.jobs).toHaveLength(2);
  });
  it("survives worker restart and authentication interruption", async () => {
    const h = harness();
    await h.start();
    const j = h.jobs[0];
    if (!j) throw new Error();
    await h.c.handle(
      { type: "event", id: j.id, event: "sign-in" },
      h.source(j),
    );
    h.restart();
    await h.c.handle({ type: "continue", id: j.id }, h.popup);
    await h.c.handle({ type: "event", id: j.id, event: "ready" }, h.source(j));
    expect(h.jobs[0]?.phase).toBe("ready");
    expect(h.jobs).toHaveLength(1);
  });
  it("persists submission and refuses duplicate or replay after restart", async () => {
    const h = harness();
    await h.start();
    const j = h.jobs[0];
    if (!j) throw new Error();
    await h.c.handle({ type: "event", id: j.id, event: "ready" }, h.source(j));
    await h.c.handle(
      { type: "event", id: j.id, event: "submitted", analysisRequested: true },
      h.source(j),
    );
    h.restart();
    await expect(
      h.c.handle({ type: "event", id: j.id, event: "submitted" }, h.source(j)),
    ).rejects.toThrow("already submitted");
    h.urls.set(j.destinationTab ?? 0, "https://lichess.org/AbCd1234");
    await h.c.handle(
      {
        type: "event",
        id: j.id,
        event: "imported",
        referrer: "https://lichess.org/paste",
      },
      h.source(j),
    );
    expect(h.jobs[0]?.phase).toBe("imported");
    expect(h.jobs[0]?.analysisRequested).toBe(true);
  });
  it("does not touch independent paste pages or other destination tabs", async () => {
    const h = harness();
    await h.start();
    const j = h.jobs[0];
    if (!j) throw new Error();
    expect(
      await h.c.handle(
        { type: "hello" },
        { ...h.source(j), url: "https://lichess.org/paste" },
      ),
    ).toEqual({ job: null });
    await expect(
      h.c.handle(
        { type: "event", id: j.id, event: "ready" },
        { ...h.source(j), tab: { id: 999 } },
      ),
    ).rejects.toThrow("associated");
  });
  it("expires games and clears consent", async () => {
    const h = harness();
    await h.start();
    h.expire();
    await h.c.prune();
    expect(h.jobs).toHaveLength(0);
    await h.c.handle({ type: "clear" }, h.popup);
    await expect(h.start()).rejects.toThrow("public-import notice");
  });
  it("does not reimport an uncertain submission after the destination closes", async () => {
    const h = harness();
    await h.start();
    const j = h.jobs[0];
    if (!j) throw new Error();
    await h.c.handle({ type: "event", id: j.id, event: "ready" }, h.source(j));
    await h.c.handle(
      { type: "event", id: j.id, event: "submitted" },
      h.source(j),
    );
    h.urls.delete(j.destinationTab ?? 0);
    await expect(
      h.c.handle({ type: "continue", id: j.id }, h.popup),
    ).rejects.toThrow("unknown");
    expect(h.jobs).toHaveLength(1);
  });
  it("requires complete game input on game and live-play routes", async () => {
    const h = harness();
    await expect(
      h.c.handle(
        {
          type: "start",
          sourceTab: 1,
          input: { kind: "line", text: "1. e4 *" },
        },
        h.popup,
      ),
    ).rejects.toThrow("completed");
    h.urls.set(1, "https://www.chess.com/play/online");
    await expect(
      h.c.handle(
        {
          type: "start",
          sourceTab: 1,
          input: { kind: "line", text: "1. e4 *" },
        },
        h.popup,
      ),
    ).rejects.toThrow("completed");
    await expect(h.start()).resolves.toHaveProperty("job");
  });
  it("requires consent and trusted sender", async () => {
    const h = harness();
    await expect(
      h.c.handle(
        { type: "clear" },
        {
          id: "extension",
          url: "https://www.chess.com/analysis",
          tab: { id: 1 },
        },
      ),
    ).rejects.toThrow();
    await expect(
      h.c.handle({ type: "status" }, { id: "other", url: h.platform.popupUrl }),
    ).rejects.toThrow("Untrusted");
  });
});
it("restricts destination origins and paths", () => {
  for (const raw of [
    "https://lichess.org.evil.test/AbCd1234",
    "javascript:alert(1)",
    "https://lichess.org@evil.test/AbCd1234",
    "https://lichess.org/import",
  ])
    expect(importResultUrl(raw)).toBe(false);
  expect(importResultUrl("https://lichess.org/AbCd1234")).toBe(true);
  expect(
    destination(
      {
        kind: "position",
        fen: "8/8 w - - 0 1",
        orientation: "black",
        plies: 0,
        note: "",
      },
      "id",
    ),
  ).toMatch(/^https:\/\/lichess.org\/analysis\/standard\//);
});
it("validates messages and rejects nested frames", () => {
  expect(messageSchema.safeParse({ type: "continue", id: "bad" }).success).toBe(
    false,
  );
  expect(messageSchema.safeParse({ type: "clear", extra: "bad" }).success).toBe(
    false,
  );
  expect(
    senderRole(
      {
        id: "extension",
        url: "https://lichess.org/paste",
        tab: { id: 1 },
        frameId: 1,
      },
      "extension",
      "popup",
    ),
  ).toBeUndefined();
});
it("does not authorize a stale form after data is cleared", async () => {
  const h = harness();
  await h.start();
  const j = h.jobs[0];
  if (!j) throw new Error();
  await h.c.handle({ type: "clear" }, h.popup);
  await expect(
    h.c.handle({ type: "event", id: j.id, event: "submitted" }, h.source(j)),
  ).rejects.toThrow("expired or was cleared");
});
it("will not claim an unrelated game navigation as import success", async () => {
  const h = harness();
  await h.start();
  const j = h.jobs[0];
  if (!j) throw new Error();
  await h.c.handle({ type: "event", id: j.id, event: "ready" }, h.source(j));
  await h.c.handle(
    { type: "event", id: j.id, event: "submitted" },
    h.source(j),
  );
  h.urls.set(j.destinationTab ?? 0, "https://lichess.org/AbCd1234");
  await expect(
    h.c.handle(
      {
        type: "event",
        id: j.id,
        event: "imported",
        referrer: "https://lichess.org/games",
      },
      h.source(j),
    ),
  ).rejects.toThrow("could not be confirmed");
});
