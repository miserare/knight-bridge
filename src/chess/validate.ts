import { Chess, validateFen } from "chess.js";
import { type Content, type Input, chessUrl, inputSchema } from "./content";

export class NoMovesError extends Error {}

export function validate(input: Input): Content {
  input = inputSchema.parse(input);
  if (input.sourceUrl && !chessUrl(input.sourceUrl))
    throw new Error("The source must be a Chess.com HTTPS page.");
  if (input.kind === "position") {
    const fen = input.text.trim();
    if (fen.split(/\s+/).length !== 6 || !validateFen(fen).ok)
      throw new Error(
        "Paste a complete, valid six-field FEN. Missing position state cannot be guessed.",
      );
    return {
      kind: "position",
      fen,
      orientation: input.orientation,
      plies: 0,
      note: "This position has no move history. Opening position analysis; no historical mistakes report is available.",
    };
  }
  const text = input.text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (/\[Variant\s+"(?!Standard"|Chess"|From Position")[^"]+"\]/i.test(text))
    throw new Error(
      "Only standard chess is supported. Export a standard-chess PGN.",
    );
  if ((text.match(/\[Event\s+"/g) ?? []).length > 1)
    throw new Error("Choose one game, not a multi-game PGN file.");
  const headers = [
    ...text.matchAll(/\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\]/g),
  ];
  if (new Set(headers.map((h) => h[1])).size !== headers.length)
    throw new Error(
      "Duplicate PGN headers are ambiguous. Export the game again.",
    );
  const resultHeader = headers.find((h) => h[1] === "Result")?.[2];
  const body = text
    .replace(/\[[A-Za-z0-9_]+\s+"(?:\\.|[^"\\])*"\]/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/;[^\n]*/g, "");
  // Exclude variations from result inspection, while chess.js parses the PGN itself.
  let depth = 0,
    main = "";
  for (const c of body) {
    if (c === "(") depth++;
    else if (c === ")") {
      if (--depth < 0) throw new Error("Unbalanced variation.");
    } else if (depth === 0) main += c;
  }
  if (depth !== 0) throw new Error("Unbalanced variation.");
  const results = main.match(/(?:1-0|0-1|1\/2-1\/2|\*)/g) ?? [];
  if (results.length > 1)
    throw new Error("The PGN contains multiple games or result markers.");
  const end = results[0];
  if (end && resultHeader && end !== resultHeader)
    throw new Error("PGN header and movetext results disagree.");
  const result = resultHeader ?? end ?? "*";
  if (!["1-0", "0-1", "1/2-1/2", "*"].includes(result))
    throw new Error("Invalid game result.");
  if (input.kind === "game" && (result === "*" || !end))
    throw new Error(
      "A completed game needs its full PGN and a final result. Ongoing games cannot be transferred.",
    );
  if (input.expectedResult && input.expectedResult !== result)
    throw new Error("The exported result does not match this game.");
  const hasFen = headers.some((h) => h[1] === "FEN");
  const setup = headers.find((h) => h[1] === "SetUp")?.[2];
  if (setup === "1" && !hasFen)
    throw new Error("The custom starting position is missing its FEN.");
  const fen = headers.find((h) => h[1] === "FEN")?.[2];
  if (fen && (fen.split(/\s+/).length !== 6 || !validateFen(fen).ok))
    throw new Error("The starting FEN is invalid or incomplete.");
  if (hasFen && setup && setup !== "1")
    throw new Error("FEN and SetUp tags disagree.");
  const game = new Chess();
  try {
    game.loadPgn(text, { strict: true });
  } catch {
    throw new Error(
      "The PGN contains an illegal or malformed move. Export the full game again.",
    );
  }
  const plies = game.history().length;
  if (!plies)
    throw new NoMovesError(
      "No moves found. Choose Position and paste its full FEN instead.",
    );
  if (plies > 2000)
    throw new Error("This line is too long. Transfer a shorter selected line.");
  // chess.js supplies placeholder headers: remove any metadata absent from the original.
  const original = new Set(headers.map((h) => h[1]));
  for (const key of Object.keys(game.getHeaders()))
    if (!original.has(key) && !["FEN", "SetUp"].includes(key))
      game.removeHeader(key);
  if (hasFen) game.setHeader("SetUp", "1");
  if (resultHeader || end) game.setHeader("Result", result);
  if (input.sourceUrl) {
    const source = new URL(input.sourceUrl);
    game.setHeader("Source", source.origin + source.pathname);
  }
  const keep = new Set([
    ...original,
    "FEN",
    "SetUp",
    ...(resultHeader || end ? ["Result"] : []),
    ...(input.sourceUrl ? ["Source"] : []),
  ]);
  const normalized = game
    .pgn()
    .split("\n")
    .filter((line) => {
      const header = line.match(/^\[([A-Za-z0-9_]+)\s/);
      return !header || keep.has(header[1]);
    })
    .join("\n");
  return {
    kind: input.kind,
    pgn: normalized,
    result,
    orientation: input.orientation,
    plies,
    note:
      input.kind === "line"
        ? "Transfers the exported mainline from its real starting position. To transfer a branch, make it the mainline in Chess.com before exporting."
        : "Transfers the full exported game, including moves after the replay cursor.",
  };
}
