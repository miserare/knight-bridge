import { mountLichess } from "../lichess/integration";
export default defineContentScript({
  matches: ["https://lichess.org/*"],
  async main(ctx) {
    try {
      const stop = await mountLichess();
      ctx.onInvalidated(stop);
    } catch {
      /* An unavailable background must never trigger form submission. */
    }
  },
});
