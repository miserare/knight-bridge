import { type PageContext } from "./page-context";

const finalResult = /\[Result\s+"(?:1-0|0-1|1\/2-1\/2)"\]/;
const resultOnPage = /(?:1-0|0-1|1\/2-1\/2)/;

function displayed(element: HTMLElement): boolean {
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    if (node.hidden || node.getAttribute("aria-hidden") === "true")
      return false;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

export function finishedGame(
  doc: Document,
  page: PageContext,
  pgn?: string,
): boolean {
  if (page.kind === "excluded") return false;
  if (page.kind === "line") return true;

  if (page.kind === "live-play") {
    // The live route stays the same after a game ends. Only a displayed game-over
    // surface may unlock it; the move list or a player score is not enough.
    return Array.from(
      doc.querySelectorAll<HTMLElement>(
        '.game-over-component,.game-over-modal,.game-over-overlay,[data-testid*="game-over"]',
      ),
    ).some(
      (element) => displayed(element) && /\S/.test(element.textContent ?? ""),
    );
  }

  if (pgn && finalResult.test(pgn)) return true;

  return Array.from(
    doc.querySelectorAll<HTMLElement>(
      ".analysis-hml-scroll-container,.game-over-component,.analysis-game-title-result,.main-line-row.result-row .game-result",
    ),
  ).some(
    (element) =>
      displayed(element) && resultOnPage.test(element.textContent ?? ""),
  );
}
