# Integration findings — September 28, 2026

## Evidence level

Documentation/source explains intended behavior. Live browser observations below establish only the scenarios actually exercised. Fixtures are not evidence that a website integration works.

## Lichess

- [API](https://lichess.org/api), [import specification](https://github.com/lichess-org/api/blob/master/doc/specs/tags/games/api-import.yaml): PGN import and import limits are documented. The import API returns an ID/URL; it does not establish acceptance of a full server-analysis request. An analysis board URL is documented for positions/lines.
- [Import controller](https://github.com/lichess-org/lila/blob/master/app/controllers/Importer.scala): the HTML negotiation branch invokes the analyser when authenticated, the analyse field is supplied and the game is analysable. The JSON branch returns import information. This is why the extension uses the normal HTML form and existing destination session instead of an invented endpoint or OAuth capability.
- [Import interface](https://lichess.org/paste): observed `form[action="/import"][method="post"]`, `textarea[name="pgn"]`, `input[name="analyse"][type="checkbox"]`, and its submit button. Signed-out UI displayed Sign in / account-required links. The checkbox is not reliably disabled when signed out; the adapter checks the login/signup UI rather than trusting disabled state.
- First IAB prototype: signed-out import form was readable; attempted synthetic import did not produce a confirmed result. It was not counted as a successful import.
- **Firefox 156, actual extension:** a completed synthetic 18-ply game was transferred from the popup into the signed-in native form. A manual final click on the prototype requested server analysis; the result showed Stockfish server-analysis loading, then the evaluation report.
- **Firefox 156, automatic version:** from a Chess.com saved PGN page at its starting position, one Analyze on Lichess click opened Share → PGN, validated all 18 plies, opened a new destination tab, submitted the native form with analyse selected, and eventually displayed the extension's Analysis completed status. The [synthetic test result](https://lichess.org/JfC7LLMA) contains the correct sequence and a server report. Two confirmed real-service test imports were used during this work; routine tests use fixtures.
- Completion DOM observed on the real result: `#acpl-chart`, two `.analyse__acpl .advice-summary__side` elements, and `.analyse__moves eval` server evaluations. Those signals are isolated in the Lichess adapter. No invented queue percentages or success based only on navigation to `/paste`.
- The native Firefox profile contained other installed Lichess-related extensions. The public result was independently checked in the IAB without Knight Bridge or those extensions. A clean Firefox-profile repeat is still a release gate.

A separate live IAB position test loaded `7k/8/8/8/8/8/8/7K b - - 0 14` through the generated analysis URL. The exported FEN remained exact and the board used black orientation. This verifies website URL semantics, not Chrome/Edge extension runtime.

Authentication is browser-session based. No credentials or cookies are read. Login referrer continuation and persisted recovery are tested with mocks; actual sign-out/re-login interruption has not been exercised so the user's existing session is not disrupted. Lichess remains responsible for CSRF, quotas, eligibility, and analysis scheduling. No quota exhaustion was intentionally induced.

## Chess.com

- [Official PGN export guidance](https://support.chess.com/en/articles/8705305-how-do-i-get-a-pgn-of-my-game) identifies Share → PGN and analysis-export options.
- [PubAPI overview](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it) describes a read-only API. Archives are not used as a fresh-game source by default. The extension supports opening an archive JSON file and selects the exact live/daily identity, never the latest game. Actual archive publication delay has not been measured.
- Live `/analysis` UI exposes PGN/FEN import, saved analysis and replay controls. English labels and `svg[data-glyph="mark-ellipsis-horizontal"]` in the replay menu were observed.
- On the signed-out IAB synthetic line, Share Game returned a website error. This justified retaining manual PGN/file recovery.
- In signed-in Firefox, Share opened a modal with a labeled PGN textarea and labeled six-field FEN input. The PGN contained all 18 plies while the displayed board was at the start. Sharing a local line changed its route to `/analysis/game/pgn/<id>/analysis`; this is treated as standalone analysis, not a live game.
- The initial export adapter woke on unrelated engine mutations before menu items existed. It was repaired to wait for actual controls, and the repaired automatic workflow passed live. A regression test simulates unrelated mutations before the Share button appears.
- Actual live/daily game routes (`/game/live/<id>`, `/analysis/game/live/<id>`, daily equivalents) use exact identity matching in exports. Route/identity/result checks are fixture-tested; representative actual completed/live/daily site pages still need real-browser verification.
- In Firefox 156, the signed-in completed live-game analysis page `/analysis/game/live/184516198834/analysis` displayed a `0-1` result in `.analysis-game-title-result` and `.main-line-row.result-row .game-result`, with replay controls grouped under `.game-controls-primary-component`. After adapting those selectors and reloading the temporary extension, **Analyze on Lichess** appeared beside the real replay controls. The button was not clicked, so this verifies placement only, not export or transfer of that personal game.
- The same completed game was also open at `/game/184516198834`, a route the original classifier excluded. That viewer displayed its result in `.main-line-row.result-row .game-result`, and showed a Share button plus replay controls. The new classifier maps `/game/<id>` to the corresponding live-game identity. Placement on that viewer was checked after the update; export and transfer were left untouched.
- The live-play route and new popup load action are fixture-tested. A fresh game-over transition and a real PGN loaded into the popup have not been verified in a browser; Chess.com's live game-over markup may need further adjustment.
- Export adapters use full PGN fields, never rendered move labels or undocumented page globals. Custom position state is taken from a full exported FEN or pasted FEN. A selected branch is not silently substituted for the mainline.

## Platforms and distribution

[WXT](https://wxt.dev/guide/essentials/target-different-browsers.html) provides separate browser builds. MV3 is explicit for all targets. Chromium uses a service worker; Firefox uses background scripts. Mozilla's current manifest requires ID and data-transmission metadata for distribution. The minimum is Firefox 142 to match the validator's data-permissions support floor across its checks; this project targets desktop only.

The first Mozilla lint run flagged Zod's optional JIT Function constructor. The bundle now imports the non-JIT `zod/v3` entrypoint from the pinned package. Final lint: zero errors, warnings, or notices. No CSP weakening was used.

[Chrome policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [Edge publishing](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), [Mozilla policies](https://extensionworkshop.com/documentation/publish/add-on-policies/) and [Firefox metadata](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings) informed the permission disclosures, local-only execution, source package, public-import notice, and unsigned-build installation instructions. Store compliance/approval is not inferred from lint success.
