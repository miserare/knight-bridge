import { send } from "../platform/client";
import { panel } from "../ui/panel";
import { importForm, prepareForm, signedOut } from "./import-form";
import { importResultUrl, isPreparedUrl } from "../transfer/job";
export async function mountLichess(): Promise<() => void> {
  const reply = await send({ type: "hello" });
  const job = reply.job;
  if (!job) return () => undefined;
  const ui = panel(document, "knight-bridge");
  const main = document.querySelector("main") ?? document.body;
  main.before(ui.host);
  ui.host.style.cssText = "max-width:1000px;margin:8px auto;padding:0 12px";
  ui.status.textContent = job.message;
  if (
    importResultUrl(location.href) &&
    ["submitted", "imported", "manual"].includes(job.phase)
  ) {
    if (job.phase === "submitted") {
      try {
        await send({
          type: "event",
          id: job.id,
          event: "imported",
          referrer: document.referrer,
        });
      } catch {
        ui.status.textContent =
          "Check this game on Lichess. Knight Bridge could not confirm the import outcome and will not submit it again.";
        return () => ui.host.remove();
      }
    }
    ui.status.textContent = job.analysisRequested
      ? "Game imported. A computer-analysis request was included with your import. Lichess decides eligibility and quotas; check its Computer analysis panel for progress."
      : "Game imported. Finish requesting analysis in Lichess’s Computer analysis panel.";
    const observe = () => {
      if (
        document.querySelectorAll(".analyse__acpl .advice-summary__side")
          .length === 2 &&
        document.querySelector("#acpl-chart") &&
        document.querySelectorAll(".analyse__moves eval").length >=
          job.content.plies
      ) {
        observer.disconnect();
        clearTimeout(timeout);
        void send({ type: "event", id: job.id, event: "analysis-complete" })
          .then(() => {
            ui.status.textContent =
              "Analysis completed. Review the evaluation graph, mistakes, and improvements on Lichess.";
          })
          .catch(() => undefined);
      }
    };
    const observer = new MutationObserver(observe);
    const timeout = setTimeout(() => observer.disconnect(), 120_000);
    for (const element of document.querySelectorAll(
      ".analyse__underboard,.analyse__round-training,.analyse__tools",
    ))
      observer.observe(element, { childList: true, subtree: true });
    observe();
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
      ui.host.remove();
    };
  }
  if (!isPreparedUrl(location.href, job)) return () => ui.host.remove();
  if (["submitted", "imported", "manual"].includes(job.phase)) {
    ui.status.textContent =
      "The import was already submitted. Check Lichess for the result or any quota/error message. To avoid duplicates, Knight Bridge will not submit it again.";
    const blocked = importForm(document);
    if (blocked) blocked.submit.disabled = true;
    return () => {
      ui.host.remove();
      if (blocked) blocked.submit.disabled = false;
    };
  }
  const adapter = importForm(document);
  if (!adapter || !job.content.pgn) {
    ui.status.textContent =
      "Lichess’s form has changed. Use the original PGN in Lichess Import game. Your transfer is retained for 30 minutes.";
    return () => ui.host.remove();
  }
  const loggedOut = signedOut(document);
  // Use the native form and session. The signed-in HTML import path was verified in Firefox on 2026-09-28.
  prepareForm(adapter, job.content.pgn, !loggedOut);
  await send({
    type: "event",
    id: job.id,
    event: loggedOut ? "sign-in" : "ready",
  });
  ui.status.textContent = loggedOut
    ? "Sign in to Lichess to request the full-game report. Then use Continue in the extension popup. Your game is saved locally for 30 minutes."
    : "Requesting import and computer analysis through Lichess…";
  const note = document.createElement("p");
  note.textContent = job.content.note;
  ui.body.append(note);
  if (loggedOut) {
    const link = document.createElement("a");
    link.className = "action";
    link.textContent = "Sign in to Lichess";
    link.href = `/login?referrer=${encodeURIComponent("/paste#knight-bridge=" + job.id)}`;
    ui.body.append(link);
  }
  let committing = false,
    allow = false;
  const onSubmit = async (event: SubmitEvent) => {
    if (allow) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (committing) return;
    committing = true;
    try {
      // Persist intent before letting the native form navigate. Never replay uncertain submissions.
      if (adapter.pgn.value !== job.content.pgn)
        throw new Error(
          "The PGN changed. Start a new transfer from the popup to validate the edited content.",
        );
      await send({
        type: "event",
        id: job.id,
        event: "submitted",
        analysisRequested: adapter.analyse.checked && !signedOut(document),
      });
      allow = true;
      adapter.form.requestSubmit(adapter.submit);
    } catch (error) {
      committing = false;
      ui.status.textContent =
        error instanceof Error
          ? error.message
          : "Unable to save transfer state. Try again.";
    }
  };
  adapter.form.addEventListener("submit", onSubmit, true);
  if (!loggedOut) adapter.form.requestSubmit(adapter.submit);
  return () => {
    adapter.form.removeEventListener("submit", onSubmit, true);
    ui.host.remove();
  };
}
