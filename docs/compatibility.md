# Compatibility and verification matrix

Recorded September 28, 2026. Release candidate 0.1.1. **Do not describe the package as fully cross-browser certified.**

| Scenario                                         | Chrome                            | Edge                              | Firefox 156 on macOS                                                                |
| ------------------------------------------------ | --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| Separate MV3 production build                    | Passed                            | Passed                            | Passed                                                                              |
| Manifest structure                               | Service worker inspected          | Service worker inspected          | Background scripts inspected; Mozilla validator passed                              |
| Installed extension runtime                      | Unverified; not installed locally | Unverified; not installed locally | Temporarily loaded; background and popup worked                                     |
| Public-import onboarding and keyboard transfer   | Unverified                        | Unverified                        | Passed in native popup                                                              |
| Chess.com injected single button                 | Unverified                        | Unverified                        | Observed on saved PGN analysis, a real completed game viewer, and its analysis page |
| Full export while replay at start                | Unverified                        | Unverified                        | Passed: all 18 plies exported                                                       |
| Saved line → automatic import → server report    | Unverified                        | Unverified                        | Passed against live Chess.com and Lichess                                           |
| Completed PGN via popup                          | Unverified                        | Unverified                        | Passed with synthetic resignation-result game                                       |
| Real completed live/daily game identity          | Fixture only                      | Fixture only                      | Real completed live-game button observed; export and transfer remain unverified     |
| Live-play game-over detection                    | Fixture only                      | Fixture only                      | Fixture only; no live game was played during this update                            |
| Explicit popup load into PGN/FEN area            | Unit test                         | Unit test                         | Popup control visible; fill tested with DOM fixture, not confirmed on real game     |
| Signed-out interface                             | IAB observation only, not Chrome  | Unverified                        | Session logic mocked; actual profile was signed in                                  |
| Login interruption / expired login / Continue    | Mocked                            | Mocked                            | Mocked, not a real logout/re-login test                                             |
| Custom FEN, branch normalization, special moves  | Unit tests                        | Unit tests                        | Unit tests; real arbitrary-content eligibility not certified                        |
| Quotas, 429, service failure                     | No forced live quota test         | Same                              | Native recovery documented; no retry loop; no forced quota test                     |
| Restart, repeated clicks, concurrent source tabs | Coordinator tests                 | Coordinator tests                 | Coordinator tests; no full browser restart during submission                        |
| Light/dark, focus, live status                   | CSS/DOM checks                    | CSS/DOM checks                    | Keyboard popup and native dark UI observed; complete theme/a11y audit outstanding   |
| Store signature / approval                       | Not submitted                     | Not submitted                     | Unsigned temporary build; not submitted                                             |

The in-app Chromium browser was used for website inspection and independently viewing the public analysis result. It is **not** treated as installed Chrome/Edge extension verification. The native Firefox profile had other extensions installed; repeat in a clean profile before distribution.

## Automated checks actually run

`npm run check`: strict TypeScript; 63 tests in seven files; all three production builds; Mozilla `web-ext lint --warnings-as-errors` with zero errors/warnings/notices. The validator's optional self-update check could not write outside the workspace; that notice did not affect package validation.

Fixtures/tests cover castling, en passant, promotion, draws, timeout/resignation results, black-to-move custom starts, Unicode names, missing metadata, nested variations, exact positions, malformed/empty/unsupported input, ongoing-game rejection, archive identity, sender/schema validation, destination restrictions, duplicate suppression, clearing/expiration, submission uncertainty, authentication interruption, worker recreation, source concurrency, unrelated destination forms, accessible status, and SPA button removal.

Mocks simulate extension APIs and DOM integration; they do not establish live platform behavior. Lichess quota text, full sign-in interruption, all Chess.com variants/layouts/locales, and queued-state selectors remain unverified. The extension does not claim a queued state without a verified signal.

## Repeatable manual checklist

1. Load the correct built directory in each browser; allow only the two named hosts.
2. Read onboarding, transfer the supplied synthetic PGN, and inspect both source and destination tabs.
3. Test with signed-out Lichess, sign in through the official page, and Continue; check no second import is created.
4. Export a real completed live game and completed daily game while the replay is moved backward. Compare the full mainline, result and FEN.
5. Confirm active live/daily games never transfer. Test unrelated pages and independent Lichess paste forms.
6. Verify custom FEN, a promoted selected variation, and a zero-move position. Compare exact state and orientation.
7. Double click, transfer two games in separate tabs, terminate/restart the background, and navigate away during import. Unknown submissions must not replay.
8. Use browser offline mode and fixture/simulated rate-limit pages. Do not exhaust real service quotas.
9. Check tab order, Enter/Space, visible focus, screen-reader announcements, both site themes, and navigation without reload.
10. Record versions, evidence, and any failures here before release. Store review and signing are separate gates.
