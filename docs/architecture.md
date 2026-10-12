# Architecture and consequential decisions

Knight Bridge uses WXT, strict TypeScript, Zod’s non-JIT v3 entrypoint at message boundaries (avoids dynamic code generation under extension CSP), and chess.js for legal PGN/FEN validation. There is no backend.

## Boundaries

- `chess/`: input schema and pure normalization. No DOM, network, or browser imports. Complete games require a final matching result. FEN requires all six fields. Mainline comments and supplied metadata survive; absent metadata is not synthesized by us (Chess.com exports may themselves contain `?` placeholders).
- `chesscom/`: route classification, normal Share → PGN controls, exact archive-file selection, and lifecycle of the injected button. No rendered move-label reconstruction or page-global injection.
- `transfer/`: serialized coordinator and persistent jobs. Only this module changes job state. The platform is injected for integration tests.
- `platform/`: runtime message validation, sender/extension/top-frame checks, browser client.
- `lichess/`: the native form adapter and bounded observation of analysis evidence. No undocumented HTTP analysis call or OAuth token.
- `ui/` and popup: safe text rendering, keyboard controls, status announcements, local cleanup, and manual PGN/FEN/archive recovery.
- `entrypoints/`: thin WXT registration and browser-specific background wiring.

## Submission and recovery

The coordinator validates again in the background, computes a SHA-256 content fingerprint, persists the job, creates a blank tab, saves its ID, and only then navigates to Lichess. This avoids a content-script/startup race. The destination URL has an opaque job marker, not a full PGN. Messages must match the bound tab and expected URL. Independent import tabs are ignored.

A signed-in destination fills the observed native `/import` form and invokes `requestSubmit`. A capturing submit handler persists submission intent before allowing native navigation. CSRF, website authentication, import eligibility and quotas remain Lichess's responsibility. No cookies are read. A signed-out destination retains the job and gives the official sign-in link. Continue navigates that same bound tab back to its marked import form, avoiding duplicate imports.

When the user selects **Load PGN or FEN from this Chess.com tab**, the content script exports and validates the content, then the coordinator stores a separate draft bound to that tab and URL. This preserves it if Chess.com's Share UI closes the browser popup. The popup restores the draft on reopen. Drafts expire after 30 minutes, are capped at 20, and are cleared when a transfer starts or a new active live game replaces the completed one.

Unknown submission outcomes are deliberately not retried. Zero automatic network retries are used. User Continue may reopen a pre-submission tab but will not create another import after submission. Jobs and fingerprints are scoped to each source tab so independent tabs cannot overwrite each other. Changed saved content produces a new fingerprint even at the same URL. Duplicate protection ends after expiry or manual clearing; Lichess may deduplicate imports independently, but correctness does not depend on it.

## Evidence and states

Import phase and analysis status are distinct. `opening`, `ready`, `sign-in`, `submitted`, `imported`, `position`, `manual`, and `failed` describe transfer state. Analysis status is `none`, `requested`, `queued`, or `complete`. A submitted native form is not proof of acceptance. Import success requires a bound eight-character game URL after a native import referrer. Analysis completion requires the observed Lichess chart, both advice summaries, and enough server move evaluations. Queue state is reserved but not automatically emitted without a verified queue marker. Lichess's own UI remains authoritative for quota details.

Completed-game and analysis pages observe the Chess.com sidebar. Live-play pages observe body child changes because Chess.com can add the game-over surface outside the sidebar without changing URL; updates are debounced and never initiate a transfer. A Chess.com bootstrap observer disconnects after discovery or ten seconds. Event-driven navigation checks use clicks, focus, pageshow, and popstate; there is no polling. Lichess result observation stops after completion or two minutes. Refresh the page to pick up later completion.

## Limitations

English website controls/current DOM are targeted. Automatic extraction requires a complete labeled PGN and, on actual game routes, a matching identity. A live-play route has no stable game ID in its URL, so it requires a visible game-over surface and a final result in the PGN; exact identity matching remains a manual verification point there. Unknown routes fail closed or use the popup. Saved analysis deliberately exports the mainline; the user must promote a desired variation first. Server analysis of arbitrary custom positions/unfinished saved lines remains subject to Lichess eligibility and is not exhaustively verified. Position FEN/orientation transfer is supported; restoring imported-game orientation and selected ply is deferred.

The current browser matrix is a release gate, not a promise that all target browsers passed. Source and builds are prepared for review, but publication requires the remaining real-browser checks, distributor metadata and store approval.
