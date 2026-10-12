import { mountChesscom } from "../chesscom/integration";
export default defineContentScript({
  matches: ["https://www.chess.com/*"],
  main(ctx) {
    const stop = mountChesscom();
    ctx.onInvalidated(stop);
  },
});
