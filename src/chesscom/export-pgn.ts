import { context, sameGame } from "./page-context";
import { validate, NoMovesError } from "../chess/validate";
import { type Input } from "../chess/content";
import { finishedGame } from "./finished-game";
export function exportField(doc: Document): string | undefined {
  const fields = Array.from(
    doc.querySelectorAll<HTMLTextAreaElement>("textarea"),
  );
  const values = fields
    .filter(
      (e) =>
        /pgn/i.test(
          [
            e.id,
            e.name,
            e.getAttribute("aria-label"),
            e.getAttribute("placeholder"),
          ].join(" "),
        ) && e.value.trim(),
    )
    .map((e) => e.value);
  return new Set(values).size === 1 ? values[0] : undefined;
}
export function extractedInput(
  doc: Document,
  url: string,
  finishedLivePlay = false,
): Input {
  const page = context(url);
  if (page.kind === "excluded")
    throw new Error("Open a completed game or standalone saved analysis.");
  const pgn = exportField(doc);
  if (
    page.kind === "live-play" &&
    !finishedLivePlay &&
    !finishedGame(doc, page, pgn)
  )
    throw new Error("Wait for the live game to finish before exporting it.");
  if (!pgn)
    throw new Error(
      "Open Chess.com Share Game → PGN, then try again. If export is unavailable, use the extension popup to paste or open a PGN file.",
    );
  if (page.kind === "game") {
    const link = pgn.match(
      /\[(?:Link|Site)\s+"(https:\/\/www\.chess\.com\/[^"\s]+)"\]/,
    )?.[1];
    if (!link || !sameGame(link, page))
      throw new Error(
        "This export cannot be matched to the current game. Use its full PGN in the popup.",
      );
  }
  const input: Input = {
    kind: page.kind === "live-play" ? "game" : page.kind,
    text: pgn,
    sourceUrl: url,
    orientation: doc.querySelector(".board.flipped") ? "black" : "white",
  };
  try {
    validate(input);
    return input;
  } catch (error) {
    if (page.kind === "line" && error instanceof NoMovesError) {
      const field = doc.querySelector<HTMLInputElement>(
        'input[aria-label="FEN"],input[name="fen"]',
      );
      if (field?.value) {
        const position: Input = {
          ...input,
          kind: "position",
          text: field.value,
        };
        validate(position);
        return position;
      }
    }
    throw error;
  }
}
export async function openExport(doc: Document): Promise<void> {
  if (exportField(doc)) return;
  const shareButton = () =>
    Array.from(doc.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      /^(share|share game)$/i.test(
        b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "",
      ),
    );
  let share = shareButton();
  if (!share) {
    const menu = doc.querySelector(
      'button:has(svg[data-glyph="mark-ellipsis-horizontal"])',
    );
    if (!(menu instanceof HTMLElement))
      throw new Error(
        "Open Chess.com Share Game → PGN, then try again, or use the popup.",
      );
    menu.click();
    share = await waitFor(doc, shareButton);
  }
  share.click();
  const fieldOrTab = await waitFor(
    doc,
    () =>
      exportField(doc) ||
      Array.from(doc.querySelectorAll<HTMLElement>('[role="tab"],button')).find(
        (e) => /^PGN$/i.test(e.textContent?.trim() ?? ""),
      ),
  );
  if (fieldOrTab instanceof HTMLElement) fieldOrTab.click();
  await waitFor(doc, () => exportField(doc));
}
function waitFor<T>(doc: Document, read: () => T | undefined): Promise<T> {
  const found = read();
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const value = read();
      if (value) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      }
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(
        new Error(
          "Chess.com export did not become available. Open Share Game → PGN yourself, or paste the full PGN in the popup.",
        ),
      );
    }, 4000);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value", "aria-label"],
    });
  });
}
