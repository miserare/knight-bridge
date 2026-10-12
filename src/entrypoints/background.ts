import { ZodError } from "zod/v3";
import { browser } from "wxt/browser";
import { Coordinator } from "../transfer/coordinator";
export default defineBackground(() => {
  const coordinator = new Coordinator({
    extensionId: browser.runtime.id,
    popupUrl: browser.runtime.getURL("/popup.html"),
    read: async () => (await browser.storage.local.get("jobs")).jobs,
    write: async (jobs) => browser.storage.local.set({ jobs }),
    readDrafts: async () => (await browser.storage.local.get("drafts")).drafts,
    writeDrafts: async (drafts) => browser.storage.local.set({ drafts }),
    consent: async () =>
      (await browser.storage.local.get("consented")).consented === true,
    setConsent: async () => browser.storage.local.set({ consented: true }),
    clear: async () => browser.storage.local.clear(),
    create: async () => {
      const tab = await browser.tabs.create({ url: "about:blank" });
      if (tab.id === undefined) throw new Error("Tab creation failed.");
      return tab.id;
    },
    navigate: async (tab, url) => {
      await browser.tabs.update(tab, { url });
    },
    focus: async (tab) => {
      await browser.tabs.update(tab, { active: true });
    },
    tabUrl: async (tab) => (await browser.tabs.get(tab)).url,
  });
  browser.runtime.onMessage.addListener((message, sender) =>
    coordinator.handle(message, sender).catch((error: unknown) => ({
      error:
        error instanceof Error && !(error instanceof ZodError)
          ? error.message
          : "Invalid transfer data. Check the PGN and try again.",
    })),
  );
  browser.runtime.onInstalled.addListener(() => {
    void browser.alarms.create("expiry", { periodInMinutes: 1 });
  });
  browser.runtime.onStartup.addListener(() => {
    void browser.alarms.create("expiry", { periodInMinutes: 1 });
    void coordinator.prune();
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "expiry") void coordinator.prune();
  });
});
