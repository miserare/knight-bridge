# Knight Bridge — Analyze on Lichess

An independent TypeScript browser extension for transferring completed standard-chess games and saved analysis from Chess.com to Lichess. No backend, analytics, passwords, cookie access, or account tokens.

**0.1.1 release candidate.** Browser-specific MV3 builds are included. Firefox has been exercised against a real completed Chess.com game page; Chrome and Edge still need native runtime verification. Read [the verification matrix](docs/compatibility.md) before distribution. Nothing has been published or submitted to an extension store.

## Use

1. Open the toolbar popup and acknowledge the one-time privacy notice: **normal Lichess imports are public**, including names and metadata.
2. After a Chess.com live game ends, use **Analyze on Lichess** near the replay controls (or in the game-over panel if replay controls are absent). The same button appears on supported completed-game and saved-analysis pages. The extension opens Share Game → PGN and reads the full export.
3. To inspect the content before transferring, open the popup on that Chess.com tab and select **Load PGN or FEN from this Chess.com tab**. The exported text is placed in the paste area; if Chess.com's Share dialog closes the popup, reopen it to see the selected export. Choose **Analyze on Lichess** only after reviewing it. If export is unavailable, paste the full PGN or open a file yourself.
4. If signed in to Lichess, Knight Bridge fills and submits its normal import form with computer analysis selected. Lichess decides eligibility and service limits. The Chess.com tab stays open.
5. If signed out, sign in through Lichess and use **Continue on Lichess** in the popup on the original or destination tab. Pending content is retained for 30 minutes. If the website changes, follow the displayed manual instructions.

A saved line transfers its **exported mainline**, including the original FEN. To transfer a variation, first make that branch the mainline in Chess.com. The extension does not infer the selected variation from highlighted move labels. Comments on the mainline and available PGN headers are preserved; alternate branches and numeric annotations are omitted by normalization.

For a position without history, select **Position only**, paste a complete six-field FEN or open a `.fen` file, and choose orientation. This opens position analysis, not a historical mistakes/blunders report. No missing moves, castling rights, en-passant squares, or results are inferred. Position orientation is encoded in the destination URL; replay orientation and selected ply for imported games are not restored in this release.

Live-play pages stay inactive until Chess.com displays a game-over surface. A full PGN with a final result is required before transfer; `*` is accepted only for standalone analysis. Standard chess is supported; variants are rejected. The extension never starts a Lichess transfer merely because a game ends.

## Develop and build

Use Node.js 24 LTS or later and npm. Creating the full source handoff also uses the standard `zip` command (included in macOS and the Ubuntu CI runner). Development was verified with Node 25.7.0 / npm 11.10.1. Dependencies are pinned and `package-lock.json` is committed.

```sh
npm ci
npm run dev                 # Chrome developer workflow
npm run dev:firefox         # Firefox MV3 developer workflow
npm run typecheck
npm test
npm run build:all
npm run release
```

`npm run check` runs strict type checking, tests, and all builds. `node scripts/icons.mjs` regenerates the original icons without network access. `npm run release` creates browser ZIPs and a Firefox source ZIP in `.output/`. The handoff `release/` directory contains the same browser packages, a clean source archive, and SHA-256 checksums.

## Install development builds

- **Chrome:** open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `.output/chrome-mv3` (or extract the Chrome release ZIP and select that folder).
- **Edge:** open `edge://extensions`, enable Developer mode, choose Load unpacked, and select `.output/edge-mv3`.
- **Firefox 142+:** open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on, and select `.output/firefox-mv3/manifest.json`. Allow the requested site access if Firefox prompts. This temporary installation disappears when Firefox restarts.

Reload the extension and refresh already-open Chess.com/Lichess tabs after rebuilding. For production, Chrome Web Store / Edge Add-ons distribution requires review; normal permanent Firefox installations require Mozilla signing, including self-distributed releases. An unsigned ZIP renamed `.xpi` is **not** a signed Firefox release. Do not disable signing enforcement. See [submission drafts](docs/store-listings.md).

## Recovery

- **No button:** confirm the extension is loaded and refresh Chess.com tabs after updating it. When the game ends, wait for Chess.com's game-over display or open the game's Analysis page. On a supported Chess.com page, the popup's **Load PGN or FEN from this Chess.com tab** action is an alternative. English control labels and current website structure are targeted; other locales and layouts need verification.
- **Export failed:** open Chess.com Share Game → PGN yourself, then retry. Or download the full PGN and open it in the popup. Automatic extraction rejects exports whose game identity cannot be matched. Never paste only the visible move labels.
- **Archive fallback:** on an exact completed-game URL, open a Chess.com PubAPI monthly archive JSON file in the popup. Only the exact live/daily ID is selected. No “latest game” heuristic. Archives may lag; use the current game's export for a recent finish. Archive files up to 5 MB, PGN/FEN up to 200 KB.
- **Sign-in / expired login:** use the Lichess sign-in link, then Continue. No token or password is requested by this extension.
- **Offline / website error / quota:** keep the destination tab. There are no automatic retries. If submission was already attempted, inspect Lichess before retrying manually. A quota or error cannot be treated as a successful analysis. The normal Lichess interface is the authority for rate-limit details.
- **Unknown submission outcome:** the extension will not resubmit. Open the destination, check the imported game, or inspect your Lichess imports. Clearing extension data does not undo an import and also removes duplicate protection.
- **Privacy:** Help & privacy → Clear local extension data removes all jobs and resets the notice. Lichess imports already created remain public; manage those on Lichess itself.

## Permissions

| Permission                | Purpose                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| `storage`                 | Local jobs and the privacy-notice choice; never sync                          |
| `alarms`                  | Remove expired jobs; no network polling                                       |
| `activeTab`               | Contextual popup status and association with the tab you invoked it on        |
| `https://www.chess.com/*` | Insert the button and read the export after your click                        |
| `https://lichess.org/*`   | Prepare native import and observe results only in a job-bound destination tab |

No `cookies`, `history`, `webRequest`, clipboard, downloads, or broad `tabs` permission. Browser tab creation does not require the broad `tabs` permission. Private browsing is disabled. Firefox declares website-content transmission because PGN/FEN goes to Lichess.

See [privacy](docs/privacy.md), [architecture](docs/architecture.md), [integration evidence](docs/integration-findings.md), and [compatibility](docs/compatibility.md).
