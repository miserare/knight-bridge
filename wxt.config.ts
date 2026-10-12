import { defineConfig } from "wxt";
export default defineConfig({
  srcDir: "src",
  zip: { excludeSources: ["release/**", "docs/evidence/**"] },
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Knight Bridge — Analyze on Lichess",
    description:
      "Transfer completed Chess.com games and saved analysis to Lichess. Independent, no tracking or account tokens.",
    permissions: ["storage", "alarms", "activeTab"],
    host_permissions: ["https://www.chess.com/*", "https://lichess.org/*"],
    incognito: "not_allowed",
    icons: {
      16: "icons/16.png",
      32: "icons/32.png",
      48: "icons/48.png",
      128: "icons/128.png",
    },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "knight-bridge@extensions.local",
              strict_min_version: "142.0",
              data_collection_permissions: { required: ["websiteContent"] },
            },
          },
        }
      : {}),
  }),
});
