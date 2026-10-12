import { z } from "zod/v3";
import { context, sameGame } from "./page-context";
const archive = z.object({
  games: z.array(
    z.object({
      url: z.string(),
      pgn: z.string(),
      rules: z.string(),
      end_time: z.number().optional(),
    }),
  ),
});
// Archive responses can be stale. This adapter never guesses the newest game.
export function selectArchiveGame(data: unknown, sourceUrl: string): string {
  const target = context(sourceUrl);
  if (target.kind !== "game") throw new Error("An exact game URL is required.");
  const matches = archive
    .parse(data)
    .games.filter((g) => sameGame(g.url, target));
  if (matches.length !== 1)
    throw new Error(
      "The exact game is not in this archive. Use Chess.com Share → PGN for a just-completed game.",
    );
  const game = matches[0];
  if (!game || game.rules !== "chess")
    throw new Error("Only standard chess is supported.");
  return game.pgn;
}
