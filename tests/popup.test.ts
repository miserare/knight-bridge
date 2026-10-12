import { it, expect, vi } from "vitest";
import { normal } from "./fixtures/games";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  fromTab: vi.fn(),
}));
vi.mock("../src/platform/client", () => ({ send: mocks.send }));
vi.mock("wxt/browser", () => ({
  browser: {
    tabs: {
      query: vi.fn(async () => [
        { id: 7, url: "https://www.chess.com/play/online" },
      ]),
      sendMessage: mocks.fromTab,
    },
    storage: { onChanged: { addListener: vi.fn() } },
  },
}));

function popupMarkup() {
  document.body.innerHTML = `
    <section id="onboarding" hidden></section><section id="workspace" hidden></section>
    <p id="status"></p><p id="context"></p><div id="jobs"></div>
    <button id="consent"></button><button id="clear"></button>
    <button id="load-current" hidden></button><button id="transfer"></button>
    <select id="kind"><option value="game">Game</option><option value="line">Line</option><option value="position">Position</option></select>
    <select id="orientation"><option value="white">White</option><option value="black">Black</option></select>
    <textarea id="input"></textarea><input id="file" type="file" />`;
}

it("fills the paste area only after selecting the current finished game", async () => {
  popupMarkup();
  mocks.send.mockResolvedValue({ consented: true, jobs: [] });
  mocks.fromTab.mockResolvedValue({
    kind: "game",
    text: normal,
    sourceUrl: "https://www.chess.com/play/online",
    orientation: "black",
  });
  await import("../src/entrypoints/popup/main");
  await vi.waitFor(() =>
    expect(document.getElementById("load-current")?.hidden).toBe(false),
  );
  const input = document.getElementById("input") as HTMLTextAreaElement;
  const transfer = document.getElementById("transfer") as HTMLButtonElement;
  expect(input.value).toBe("");
  expect(transfer.disabled).toBe(true);
  expect(mocks.fromTab).not.toHaveBeenCalled();
  document.getElementById("load-current")?.click();
  await vi.waitFor(() => expect(input.value).toBe(normal));
  expect(mocks.fromTab).toHaveBeenCalledWith(7, { type: "extract-current" });
  expect(transfer.disabled).toBe(false);
  expect(mocks.send).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: "start" }),
  );
});

it("restores a selected export when Chess.com's Share action closed the popup", async () => {
  vi.resetModules();
  mocks.fromTab.mockClear();
  popupMarkup();
  mocks.send.mockResolvedValue({
    consented: true,
    jobs: [],
    draft: {
      sourceTab: 7,
      input: {
        kind: "game",
        text: normal,
        sourceUrl: "https://www.chess.com/play/online",
        orientation: "black",
      },
      expires: Date.now() + 30_000,
    },
  });
  await import("../src/entrypoints/popup/main");
  await vi.waitFor(() =>
    expect(
      (document.getElementById("input") as HTMLTextAreaElement).value,
    ).toBe(normal),
  );
  expect(
    (document.getElementById("transfer") as HTMLButtonElement).disabled,
  ).toBe(false);
  expect(mocks.fromTab).not.toHaveBeenCalled();
});
