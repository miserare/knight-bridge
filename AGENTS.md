Implement this extension with clear boundaries, direct code, and verified behavior.

Follow the architecture in docs/architecture.md. Treat the proposed folder structure as guidance; create modules when their responsibilities exist. Do not create placeholder layers to fill out the tree.

Keep entrypoints thin. Isolate Chess.com and Lichess page integrations in their respective modules. Keep chess validation independent of the DOM, network, and browser APIs. Route transfer state changes through the transfer coordinator.

Remember that content scripts, background execution, and the popup are separate contexts. Validate messages at runtime, check their senders, and persist pending jobs before relying on them across navigation or background suspension.

Use strict TypeScript. Model distinct content types and outcomes explicitly. Do not use broad casts or non-null assertions to hide uncertainty at external boundaries.

Prefer small functions and descriptive domain names. Introduce abstractions only when they clarify an existing responsibility, remove meaningful duplication, or allow a real boundary to be tested. Avoid generic manager classes, speculative plugin systems, and miscellaneous utility collections.

Write comments for non-obvious constraints, assumptions, and tradeoffs. Do not narrate straightforward statements or add repetitive documentation to self-explanatory functions.

Handle failures where a recovery decision can be made. Do not swallow errors, report false success, or automatically retry submissions whose outcome is unknown.

Test observable behavior, especially extraction accuracy, state recovery, duplicate prevention, authentication, and concurrent transfers. Use sanitized fixtures. Do not substitute mocked results for evidence that a real browser integration works.

Keep website-dependent assumptions documented with their source and verification date. Separate verified behavior from untested expectations.

Before finishing, review the changes for unnecessary code and remove it. Run the relevant checks and accurately report what was tested, what remains uncertain, and any user-visible limitations.

Do not imitate human authorship through deliberate inconsistency, fabricated history, or unnecessary quirks. Optimize for code another engineer can understand, modify, and trust.