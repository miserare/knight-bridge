# Draft store submission material

Do not submit or publish without a separate instruction. These drafts describe actual features and limitations, not store approval.

## Title and short description

**Knight Bridge — Analyze on Lichess**

Review completed Chess.com games on Lichess, with validated PGN transfer and support for saved lines and exact positions.

## Long description

Bring a completed Chess.com game to Lichess for another perspective. Knight Bridge adds an accessible Analyze on Lichess button near supported analysis controls, reads the game's full PGN export, validates its moves and starting position, and opens Lichess in a new tab.

When signed in, the extension uses Lichess's normal import form with computer analysis selected. Lichess decides which imports are eligible and applies its normal service limits. If signed out, sign in on Lichess and use Continue in the extension popup. Your Chess.com tab stays open.

Saved analysis transfers the exported mainline; promote a variation to the mainline before exporting it. Positions without move history open position analysis and cannot produce a historical mistakes report. A popup offers PGN/FEN file import and manual recovery when website controls change. Ongoing games and unsupported variants are excluded.

Normal Lichess imports are public and may include player names and game metadata. Pending transfers stay on your device for 30 minutes. No analytics, developer-operated server, passwords, cookie access, or account tokens. Clear local records from the popup.

Independent software, not affiliated with or endorsed by Chess.com or Lichess. Current English desktop website layouts are targeted. See the compatibility matrix for verified browser behavior.

## Permission justifications

- Storage: retain a pending transfer across navigation, sign-in, and background suspension; expire after 30 minutes.
- Alarms: delete expired local data while the browser is running.
- Active tab: show relevant status and associate the explicitly invoked popup with its source tab.
- Chess.com host access: attach a button and read the game export after a user action.
- Lichess host access: use native import controls and read result evidence only for an extension-created transfer.
- Firefox website-content transmission declaration: user-selected PGN/FEN and metadata are sent to Lichess for the stated purpose.

No remote code. All dependencies are bundled. No monetization or advertising.

## Reviewer instructions

Build with Node 24+ and `npm ci && npm run check && npm run release`. Use a signed-in Lichess test account you control for server-analysis checks. A legal synthetic test PGN is available in `tests/fixtures/verification.pgn`. Avoid many repeated analysis requests. The manual file path can be tested without a Chess.com account; actual saved-content export requires testing the current Chess.com interface.

Inspect `docs/compatibility.md` before marking any browser supported. Firefox uses MV3 background scripts; Chromium uses a service worker. The Firefox archive is unsigned and must go through Mozilla signing for permanent distribution.

## Submission checklist

- Complete outstanding Chrome/Edge, signed-out resume, quota, and custom-position checks.
- Select a stable publisher-owned extension ID before the first Firefox submission if changing the supplied ID.
- Supply publisher name, support contact, privacy-policy HTTPS URL, and store account metadata.
- Capture store screenshots from the final extension without unrelated personal tabs/account data.
- Attach source archive and exact build instructions; include third-party license notices.
- Confirm Chrome, Microsoft and Mozilla current policies during submission. Approval has not been requested or obtained.

References checked September 28, 2026: [Chrome policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [Microsoft publishing](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), [Mozilla policies](https://extensionworkshop.com/documentation/publish/add-on-policies/), [Firefox manifest requirements](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).
