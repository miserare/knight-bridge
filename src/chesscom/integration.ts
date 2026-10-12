import { browser } from "wxt/browser";
import { context } from "./page-context";
import { openExport, extractedInput, exportField } from "./export-pgn";
import { finishedGame } from "./finished-game";
import { panel } from "../ui/panel";
import { send } from "../platform/client";
import { type Input } from "../chess/content";
export function mountChesscom(): () => void {
  let host: HTMLElement | undefined;
  let observer: MutationObserver | undefined;
  let root: Element | undefined;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let oldUrl = location.href;
  let liveFinished: boolean | undefined;
  const extractCurrent = async (): Promise<Input> => {
    const url = location.href;
    const page = context(url);
    if (!finishedGame(document, page, exportField(document)))
      throw new Error("Open a finished game or saved analysis first.");
    await openExport(document);
    const exportCreatedSavedPage =
      page.kind === "line" &&
      /^\/analysis\/game\/pgn\/[a-zA-Z0-9]+\/analysis$/.test(
        location.pathname,
      ) &&
      exportField(document)?.includes('[Link "' + location.href + '"]');
    if (location.href !== url && !exportCreatedSavedPage)
      throw new Error("The page changed. Try again on the new game.");
    return extractedInput(document, location.href, page.kind === "live-play");
  };
  const refresh = () => {
    const page = context(location.href);
    const controls =
      document.querySelector(".game-controls-view-component") ??
      document.querySelector('button[aria-label="Last Move"]')?.parentElement;
    const nextRoot =
      page.kind === "live-play"
        ? document.body
        : document.querySelector(".sidebar-component");
    if (nextRoot !== root) {
      observer?.disconnect();
      root = nextRoot ?? undefined;
      if (root) {
        observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, subtree: true });
      }
    }
    const eligible = finishedGame(document, page, exportField(document));
    if (page.kind === "live-play" && !eligible && liveFinished !== false)
      void send({ type: "discard-draft" }).catch(() => {
        console.warn("Knight Bridge could not discard the prior game draft.");
      });
    liveFinished = page.kind === "live-play" ? eligible : undefined;
    const anchor = controls ?? nextRoot;
    if (oldUrl !== location.href) {
      oldUrl = location.href;
      host?.remove();
      host = undefined;
    }
    if (!eligible || !anchor) {
      host?.remove();
      host = undefined;
      return;
    }
    if (host?.isConnected) {
      host.dataset.theme = document.documentElement.classList.contains(
        "dark-mode",
      )
        ? "dark"
        : "light";
      return;
    }
    const ui = panel(document, "knight-bridge");
    host = ui.host;
    host.dataset.theme = document.documentElement.classList.contains(
      "dark-mode",
    )
      ? "dark"
      : "light";
    const button = document.createElement("button");
    button.textContent = "Analyze on Lichess";
    button.type = "button";
    ui.body.insertBefore(button, ui.status);
    ui.status.textContent =
      page.kind === "line"
        ? "Transfer the exported mainline or use the popup for an exact position."
        : "Review the complete game on Lichess.";
    if (anchor === document.body) anchor.append(host);
    else anchor.after(host);
    host.dataset.layout = anchor === document.body ? "floating" : "inline";
    button.addEventListener("click", async () => {
      if (running) return;
      running = true;
      button.disabled = true;
      try {
        ui.status.textContent = "Preparing game…";
        const status = await send({ type: "status" });
        if (!status.consented)
          throw new Error(
            "Open Knight Bridge from your browser toolbar to read the one-time public-import notice.",
          );
        const input = await extractCurrent();
        ui.status.textContent = "Opening Lichess…";
        const result = await send({ type: "start", input });
        ui.status.textContent =
          result.job?.message ?? "Open the extension popup to continue.";
      } catch (error) {
        ui.status.textContent =
          error instanceof Error
            ? error.message
            : "Open the popup to paste or import your PGN.";
      } finally {
        running = false;
        button.disabled = false;
      }
    });
  };
  const popupExtract = (
    message: unknown,
    sender: { id?: string; url?: string },
  ) => {
    if (
      typeof message !== "object" ||
      message === null ||
      !("type" in message) ||
      message.type !== "extract-current" ||
      sender.id !== browser.runtime.id ||
      sender.url !== browser.runtime.getURL("/popup.html")
    )
      return;
    return extractCurrent().then(async (input) => {
      // The Share dialog may close the browser popup. Keep only the selected
      // export locally so reopening the popup can still fill its paste area.
      await send({ type: "prepare", input });
      return input;
    });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refresh, 120);
  };
  const storage = () => {
    void send({ type: "status" })
      .then((data) => {
        const last = data.jobs?.at(-1);
        const status = host?.shadowRoot?.querySelector('[role="status"]');
        if (last && status) status.textContent = last.message;
      })
      .catch(() => undefined);
  };
  // Event-driven discovery handles ordinary SPA navigation; the observer stays within the sidebar.
  document.addEventListener("click", schedule, true);
  window.addEventListener("popstate", schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("focus", schedule);
  browser.storage.onChanged.addListener(storage);
  browser.runtime.onMessage.addListener(popupExtract);
  const themeObserver = new MutationObserver(schedule);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  refresh();
  const bootstrap = new MutationObserver(() => {
    if (document.querySelector(".sidebar-component")) {
      bootstrap.disconnect();
      refresh();
    }
  });
  if (!root) {
    bootstrap.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => bootstrap.disconnect(), 10_000);
  }
  return () => {
    host?.remove();
    observer?.disconnect();
    bootstrap.disconnect();
    themeObserver.disconnect();
    if (timer) clearTimeout(timer);
    document.removeEventListener("click", schedule, true);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("pageshow", schedule);
    window.removeEventListener("focus", schedule);
    browser.storage.onChanged.removeListener(storage);
    browser.runtime.onMessage.removeListener(popupExtract);
  };
}
