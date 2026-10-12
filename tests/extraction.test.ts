import { it, expect } from "vitest";
import { selectArchiveGame } from "../src/chesscom/archive-client";
import { context } from "../src/chesscom/page-context";
import { extractedInput, exportField } from "../src/chesscom/export-pgn";
import { normal } from "./fixtures/games";
const url = "https://www.chess.com/analysis/game/live/123";
it("selects exact identity, not the latest game", () => {
  expect(
    selectArchiveGame(
      {
        games: [
          {
            url: "https://www.chess.com/game/live/456",
            pgn: "wrong",
            rules: "chess",
          },
          {
            url: "https://www.chess.com/game/live/123",
            pgn: normal,
            rules: "chess",
          },
        ],
      },
      url,
    ),
  ).toBe(normal);
  expect(() => selectArchiveGame({ games: [] }, url)).toThrow("exact game");
  expect(() =>
    selectArchiveGame(
      {
        games: [
          {
            url: "https://www.chess.com/game/daily/123",
            pgn: normal,
            rules: "chess",
          },
        ],
      },
      url,
    ),
  ).toThrow();
});
it("does not export displayed move labels or the replay cursor", () => {
  document.body.innerHTML =
    '<div class="moves">1. e4</div><textarea name="pgn"></textarea>';
  const field = document.querySelector("textarea");
  if (!field) throw new Error();
  field.value = normal;
  expect(extractedInput(document, url).text).toBe(normal);
});
it("matches a completed live-game viewer to its exported game identity", () => {
  const viewer = "https://www.chess.com/game/123";
  expect(context(viewer)).toEqual({ kind: "game", mode: "live", id: "123" });
  document.body.innerHTML = '<textarea aria-label="PGN"></textarea>';
  const field = document.querySelector("textarea");
  if (!field) throw new Error();
  field.value = normal;
  expect(extractedInput(document, viewer).kind).toBe("game");
  field.value = normal.replace("/game/live/123", "/game/live/456");
  expect(() => extractedInput(document, viewer)).toThrow("matched");
});
it("rejects wrong export identity and unfinished daily games", () => {
  document.body.innerHTML = '<textarea name="pgn"></textarea>';
  const field = document.querySelector("textarea");
  if (!field) throw new Error();
  field.value = normal.replace("/live/123", "/live/456");
  expect(() => extractedInput(document, url)).toThrow("matched");
  field.value = normal.replace(/1-0/g, "*").replace("/live/123", "/daily/123");
  expect(() =>
    extractedInput(document, "https://www.chess.com/game/daily/123"),
  ).toThrow();
});
it("requires unambiguous, labeled export fields", () => {
  document.body.innerHTML = "<textarea>1. e4</textarea>";
  expect(exportField(document)).toBeUndefined();
  document.body.innerHTML =
    '<textarea name="pgn">one</textarea><textarea name="pgn">two</textarea>';
  expect(exportField(document)).toBeUndefined();
});
it.each([
  "https://www.chess.com/variants",
  "https://www.chess.com.evil.test/analysis",
])("excludes %s", (url) => expect(context(url).kind).toBe("excluded"));
it.each(["https://www.chess.com/play/online", "https://www.chess.com/live"])(
  "recognizes live-play page %s",
  (url) => expect(context(url).kind).toBe("live-play"),
);
it("requires a displayed game-over state before reading live-play PGN", () => {
  document.body.innerHTML = '<textarea aria-label="PGN"></textarea>';
  const field = document.querySelector("textarea");
  if (!field) throw new Error();
  field.value = normal;
  const liveUrl = "https://www.chess.com/play/online";
  expect(() => extractedInput(document, liveUrl)).toThrow("finish");
  const ended = document.createElement("div");
  ended.className = "game-over-component";
  ended.textContent = "Game over · Black won";
  document.body.append(ended);
  const input = extractedInput(document, liveUrl);
  expect(input.kind).toBe("game");
  expect(input.text).toBe(normal);
  ended.setAttribute("aria-hidden", "true");
  expect(() => extractedInput(document, liveUrl)).toThrow("finish");
  ended.removeAttribute("aria-hidden");
  ended.style.display = "none";
  expect(() => extractedInput(document, liveUrl)).toThrow("finish");
  expect(extractedInput(document, liveUrl, true).kind).toBe("game");
});
it("waits for export controls despite unrelated mutations", async () => {
  const { openExport } = await import("../src/chesscom/export-pgn");
  document.body.innerHTML =
    '<button><svg data-glyph="mark-ellipsis-horizontal"></svg></button>';
  document.querySelector("button")?.addEventListener("click", () => {
    document.body.append(document.createElement("span"));
    setTimeout(() => {
      const share = document.createElement("button");
      share.setAttribute("aria-label", "Share Game");
      share.addEventListener("click", () => {
        const field = document.createElement("textarea");
        field.setAttribute("aria-label", "PGN");
        field.value = normal;
        document.body.append(field);
      });
      document.body.append(share);
    }, 20);
  });
  await openExport(document);
  expect(exportField(document)).toBe(normal);
});
it("transfers exact exported FEN only when standalone analysis has no moves", () => {
  document.body.innerHTML =
    '<textarea aria-label="PGN">[Result "*"]\n\n*</textarea><input aria-label="FEN">';
  const fen = document.querySelector("input");
  if (!fen) throw new Error();
  fen.value = "7k/8/8/8/8/8/8/7K b - - 0 14";
  const input = extractedInput(document, "https://www.chess.com/analysis");
  expect(input.kind).toBe("position");
  expect(input.text).toBe(fen.value);
});
