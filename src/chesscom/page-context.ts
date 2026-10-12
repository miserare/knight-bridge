import { chessUrl } from "../chess/content";
export type PageContext =
  | { kind: "game"; id: string; mode: "live" | "daily" }
  | { kind: "live-play" }
  | { kind: "line" }
  | { kind: "excluded" };
export function context(raw: string): PageContext {
  const u = chessUrl(raw);
  if (!u) return { kind: "excluded" };
  if (/^\/variants(\/|$)/.test(u.pathname)) return { kind: "excluded" };
  if (/^\/(play|live)(\/|$)/.test(u.pathname)) return { kind: "live-play" };
  // Chess.com's finished live-game viewer uses /game/<id>, while its PGN Link
  // and analysis routes identify the same game as /game/live/<id>.
  const liveViewer = u.pathname.match(/^\/game\/(\d+)(?:\/|$)/);
  if (liveViewer?.[1]) return { kind: "game", mode: "live", id: liveViewer[1] };
  const game = u.pathname.match(
    /^\/(?:analysis\/)?game\/(live|daily)\/(\d+)(?:\/|$)/,
  );
  if (game?.[1] && game[2])
    return {
      kind: "game",
      mode: game[1] === "live" ? "live" : "daily",
      id: game[2],
    };
  if (/^\/analysis(?:\/|$)/.test(u.pathname)) return { kind: "line" };
  return { kind: "excluded" };
}
export function sameGame(url: string, target: PageContext): boolean {
  const other = context(url);
  return (
    target.kind === "game" &&
    other.kind === "game" &&
    target.id === other.id &&
    target.mode === other.mode
  );
}
