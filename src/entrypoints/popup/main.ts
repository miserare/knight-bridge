import "./styles.css";
import { browser } from "wxt/browser";
import { send } from "../../platform/client";
import { validate } from "../../chess/validate";
import { inputSchema } from "../../chess/content";
import { selectArchiveGame } from "../../chesscom/archive-client";
import { context } from "../../chesscom/page-context";
function element<T extends HTMLElement>(id: string, kind: { new (): T }): T {
  const e = document.getElementById(id);
  if (!(e instanceof kind)) throw new Error("Missing interface element.");
  return e;
}
const status = element("status", HTMLParagraphElement),
  input = element("input", HTMLTextAreaElement),
  kind = element("kind", HTMLSelectElement),
  orientation = element("orientation", HTMLSelectElement),
  transfer = element("transfer", HTMLButtonElement),
  loadCurrent = element("load-current", HTMLButtonElement);
let tabId: number | undefined, tabUrl: string | undefined;
let selectedCurrentTabId: number | undefined;
function error(e: unknown) {
  status.textContent =
    e instanceof Error ? e.message : "Something went wrong. Try again.";
}
async function refresh() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== tabId) selectedCurrentTabId = undefined;
  tabId = tab?.id;
  tabUrl = tab?.url;
  const data = await send({ type: "status", tab: tabId });
  element("onboarding", HTMLElement).hidden = !!data.consented;
  element("workspace", HTMLElement).hidden = !data.consented;
  if (data.draft && !input.value && tabId === data.draft.sourceTab) {
    input.value = data.draft.input.text;
    kind.value = data.draft.input.kind;
    orientation.value = data.draft.input.orientation;
    selectedCurrentTabId = tabId;
    status.textContent =
      "Selected export loaded. Review it before transferring.";
  }
  const page = tabUrl ? context(tabUrl) : { kind: "excluded" };
  const excluded =
    tabUrl?.startsWith("https://www.chess.com/") && page.kind === "excluded";
  loadCurrent.hidden =
    !tabUrl?.startsWith("https://www.chess.com/") || page.kind === "excluded";
  transfer.disabled =
    !!excluded || (page.kind === "live-play" && selectedCurrentTabId !== tabId);
  element("context", HTMLParagraphElement).textContent = excluded
    ? "Transfers are disabled on this page. Open a completed game or standalone analysis."
    : page.kind === "live-play"
      ? "After the game ends, load its PGN here or use the button on the game page."
      : page.kind === "game"
        ? "Completed games only. Paste the full game export."
        : page.kind === "line"
          ? "Saved analysis: export the mainline, or paste an exact FEN."
          : "Paste a completed-game PGN, saved line, or full FEN.";
  const jobs = element("jobs", HTMLDivElement);
  jobs.replaceChildren();
  for (const job of data.jobs ?? []) {
    const card = document.createElement("div");
    card.className = "job";
    const label = document.createElement("p");
    label.textContent = job.message;
    card.append(label);
    const button = document.createElement("button");
    button.textContent = [
      "submitted",
      "imported",
      "manual",
      "position",
    ].includes(job.phase)
      ? "Open destination"
      : "Continue on Lichess";
    button.addEventListener("click", () => {
      button.disabled = true;
      void send({ type: "continue", id: job.id })
        .catch(error)
        .finally(() => {
          button.disabled = false;
        });
    });
    card.append(button);
    const restore = document.createElement("button");
    restore.className = "secondary";
    restore.textContent = "Recover PGN / FEN";
    restore.addEventListener("click", () => {
      input.value = job.content.pgn ?? job.content.fen ?? "";
      kind.value = job.content.kind;
      orientation.value = job.content.orientation;
      input.focus();
      status.textContent =
        "Recovered locally. If already submitted, check Lichess before starting again.";
    });
    card.append(restore);
    jobs.append(card);
  }
}
loadCurrent.addEventListener("click", async () => {
  if (tabId === undefined) return;
  const sourceTab = tabId;
  loadCurrent.disabled = true;
  status.textContent = "Reading the finished game from Chess.com…";
  try {
    const selected = inputSchema.parse(
      await browser.tabs.sendMessage(sourceTab, { type: "extract-current" }),
    );
    validate(selected);
    if (sourceTab !== tabId)
      throw new Error("The selected tab changed. Try again.");
    input.value = selected.text;
    kind.value = selected.kind;
    orientation.value = selected.orientation;
    tabUrl = selected.sourceUrl ?? tabUrl;
    selectedCurrentTabId = sourceTab;
    transfer.disabled = false;
    input.focus();
    status.textContent =
      selected.kind === "position"
        ? "Exact FEN loaded. Review it, then choose Analyze on Lichess."
        : "Full PGN loaded. Review it, then choose Analyze on Lichess.";
  } catch (e) {
    error(e);
  } finally {
    loadCurrent.disabled = false;
  }
});
element("consent", HTMLButtonElement).addEventListener("click", () => {
  void send({ type: "consent" }).then(refresh).catch(error);
});
element("clear", HTMLButtonElement).addEventListener("click", () => {
  void send({ type: "clear" })
    .then(() => {
      input.value = "";
      status.textContent =
        "Local data cleared. Existing Lichess imports remain public.";
      return refresh();
    })
    .catch(error);
});
element("file", HTMLInputElement).addEventListener("change", async (event) => {
  try {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;
    if (file.size > (file.name.endsWith(".json") ? 5_000_000 : 200_000))
      throw new Error(
        "Choose a PGN/FEN under 200 KB or an archive JSON under 5 MB.",
      );
    const text = await file.text();
    input.value = file.name.endsWith(".json")
      ? selectArchiveGame(JSON.parse(text), tabUrl ?? "")
      : text;
    if (file.name.toLowerCase().endsWith(".fen")) kind.value = "position";
  } catch (e) {
    error(e);
  }
});
transfer.addEventListener("click", async () => {
  transfer.disabled = true;
  status.textContent = "Preparing game…";
  try {
    const data = inputSchema.parse({
      kind: kind.value,
      text: input.value,
      orientation: orientation.value,
      ...(tabUrl?.startsWith("https://www.chess.com/")
        ? { sourceUrl: tabUrl }
        : {}),
    });
    validate(data);
    const response = await send({
      type: "start",
      input: data,
      sourceTab: tabId,
    });
    status.textContent = response.job?.content.note ?? "Opening Lichess…";
    await refresh();
  } catch (e) {
    error(e);
  } finally {
    const excluded =
      tabUrl?.startsWith("https://www.chess.com/") &&
      context(tabUrl).kind === "excluded";
    transfer.disabled =
      !!excluded ||
      (tabUrl !== undefined &&
        context(tabUrl).kind === "live-play" &&
        selectedCurrentTabId !== tabId);
  }
});
browser.storage.onChanged.addListener(() => {
  void refresh().catch(error);
});
void refresh().catch(error);
