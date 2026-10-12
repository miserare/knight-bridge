import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { validate } from "../src/chess/validate";
import {
  normal,
  draw,
  enPassant,
  promotion,
  variations,
  blackStart,
  position,
  timeout,
} from "./fixtures/games";
const check = (text: string, kind: "game" | "line" | "position" = "game") =>
  validate({ text, kind, orientation: "white" });
describe("chess validation", () => {
  it.each([normal, draw, enPassant, promotion, timeout])(
    "accepts complete legal game %s",
    (text) => expect(check(text).plies).toBeGreaterThan(0),
  );
  it("keeps metadata and full history", () => {
    const result = check(normal);
    const c = new Chess();
    c.loadPgn(result.pgn ?? "");
    expect(c.history()).toHaveLength(10);
    expect(c.getHeaders().White).toBe("Zoë 棋手");
    expect(c.getHeaders().TimeControl).toBe("600");
    expect(result.pgn).not.toContain("[Date");
  });
  it("keeps mainline, does not concatenate branches", () => {
    const c = new Chess();
    c.loadPgn(check(variations, "line").pgn ?? "");
    expect(c.history()).toEqual(["e4", "e5", "Nf3"]);
    expect(check(variations, "line").note).toContain("mainline");
  });
  it("preserves black-to-move setup and promotion", () => {
    const out = check(blackStart, "line");
    expect(out.pgn).toContain("b - - 0 15");
    expect(out.pgn).toContain("15. ... a1=Q+");
  });
  it("preserves exact FEN state", () =>
    expect(check(position, "position").fen).toBe(position));
  it.each([
    "",
    "garbage",
    "1. e4 e5",
    '[Result "*"]\n1. e4 *',
    '[Variant "Chess960"]\n1. e4 1-0',
    '[Result "0-1"]\n1. e4 1-0',
    '[SetUp "1"]\n1. e4 1-0',
    "1. e4 e5 2. Ke4 1-0",
    "1. e4 1-0 1. d4 1-0",
  ])("rejects invalid or unfinished games: %s", (text) =>
    expect(() => check(text)).toThrow(),
  );
  it("rejects incomplete FEN and setup contradiction", () => {
    expect(() =>
      check(position.split(" ").slice(0, 4).join(" "), "position"),
    ).toThrow();
    expect(() =>
      check(promotion.replace('[SetUp "1"]', '[SetUp "0"]')),
    ).toThrow();
  });
  it("distinguishes saved lines from ongoing games", () => {
    expect(check("1. e4 *", "line").kind).toBe("line");
    expect(() => check("1. e4 *")).toThrow();
  });
  it("checks known result", () =>
    expect(() =>
      validate({
        kind: "game",
        text: normal,
        expectedResult: "0-1",
        orientation: "white",
      }),
    ).toThrow());
  it("rejects duplicate headers and trailing malformed content", () => {
    expect(() => check('[Result "1-0"]\n' + normal)).toThrow();
    expect(() => check(normal + " nonsense")).toThrow();
  });
  it("strips source queries, rejects foreign sources", () => {
    expect(
      validate({
        text: normal,
        kind: "game",
        orientation: "white",
        sourceUrl: "https://www.chess.com/game/live/123?secret=abc",
      }).pgn,
    ).not.toContain("secret");
    expect(() =>
      validate({
        text: normal,
        kind: "game",
        orientation: "white",
        sourceUrl: "https://evil.test",
      }),
    ).toThrow();
  });
});
