import { z } from "zod/v3";
export const inputSchema = z
  .object({
    kind: z.enum(["game", "line", "position"]),
    text: z.string().trim().min(1).max(200_000),
    sourceUrl: z.string().url().max(2048).optional(),
    expectedResult: z.enum(["1-0", "0-1", "1/2-1/2"]).optional(),
    orientation: z.enum(["white", "black"]).default("white"),
  })
  .strict();
export type Input = z.infer<typeof inputSchema>;
export type Content = {
  kind: Input["kind"];
  pgn?: string;
  fen?: string;
  result?: string;
  orientation: "white" | "black";
  plies: number;
  note: string;
};
export function chessUrl(raw: string): URL | undefined {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" &&
      u.hostname === "www.chess.com" &&
      !u.port &&
      !u.username &&
      !u.password
      ? u
      : undefined;
  } catch {
    return undefined;
  }
}
