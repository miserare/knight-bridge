import { validate } from "../chess/validate";
import { type Input } from "../chess/content";
import {
  type Job,
  jobSchema,
  TTL,
  destination,
  transition,
  isPreparedUrl,
  importResultUrl,
} from "./job";
import {
  type Message,
  type Sender,
  type Draft,
  draftSchema,
  messageSchema,
  senderRole,
} from "../platform/messages";
import { context } from "../chesscom/page-context";
export interface Platform {
  read(): Promise<unknown>;
  write(jobs: Job[]): Promise<void>;
  readDrafts(): Promise<unknown>;
  writeDrafts(drafts: Draft[]): Promise<void>;
  consent(): Promise<boolean>;
  setConsent(): Promise<void>;
  clear(): Promise<void>;
  create(): Promise<number>;
  navigate(tab: number, url: string): Promise<void>;
  focus(tab: number): Promise<void>;
  tabUrl(tab: number): Promise<string | undefined>;
  extensionId: string;
  popupUrl: string;
}
export class Coordinator {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly platform: Platform,
    private readonly now: () => number = Date.now,
  ) {}
  handle(raw: unknown, sender: Sender): Promise<unknown> {
    const task = this.tail.then(() =>
      this.dispatch(messageSchema.parse(raw), sender),
    );
    this.tail = task.catch(() => undefined);
    return task;
  }
  async prune(): Promise<void> {
    await this.handle(
      { type: "status" },
      { id: this.platform.extensionId, url: this.platform.popupUrl },
    );
  }
  private async jobs(): Promise<Job[]> {
    const raw = await this.platform.read();
    const jobs = (Array.isArray(raw) ? raw : []).flatMap((value) => {
      const parsed = jobSchema.safeParse(value);
      return parsed.success && parsed.data.expires > this.now()
        ? [parsed.data]
        : [];
    });
    if (!Array.isArray(raw) || jobs.length !== raw.length)
      await this.platform.write(jobs);
    return jobs;
  }
  private async drafts(): Promise<Draft[]> {
    const raw = await this.platform.readDrafts();
    const drafts = (Array.isArray(raw) ? raw : []).flatMap((value) => {
      const parsed = draftSchema.safeParse(value);
      return parsed.success && parsed.data.expires > this.now()
        ? [parsed.data]
        : [];
    });
    if (!Array.isArray(raw) || drafts.length !== raw.length)
      await this.platform.writeDrafts(drafts);
    return drafts;
  }
  private async discardDraft(tab: number): Promise<void> {
    const drafts = await this.drafts();
    if (drafts.some((draft) => draft.sourceTab === tab))
      await this.platform.writeDrafts(
        drafts.filter((draft) => draft.sourceTab !== tab),
      );
  }
  private async dispatch(message: Message, sender: Sender): Promise<unknown> {
    const role = senderRole(
      sender,
      this.platform.extensionId,
      this.platform.popupUrl,
    );
    if (!role) throw new Error("Untrusted message sender.");
    const popup = role === "popup";
    if (message.type === "clear") {
      if (!popup) throw new Error("Open the extension popup to clear data.");
      await this.platform.clear();
      return { ok: true };
    }
    if (message.type === "consent") {
      if (!popup)
        throw new Error("Open the extension popup for the privacy notice.");
      await this.platform.setConsent();
      return { ok: true };
    }
    if (message.type === "discard-draft") {
      if (role !== "chess" || sender.tab?.id === undefined)
        throw new Error("Only the source game can discard its draft.");
      await this.discardDraft(sender.tab.id);
      return { ok: true };
    }
    if (message.type === "prepare") {
      if (role !== "chess" || sender.tab?.id === undefined)
        throw new Error("Select a game from its Chess.com tab.");
      const url = await this.platform.tabUrl(sender.tab.id);
      if (!url || url !== sender.url || message.input.sourceUrl !== url)
        throw new Error("The game page changed. Select the game again.");
      if (context(url).kind === "excluded")
        throw new Error("This Chess.com page cannot provide a game.");
      if (!(await this.platform.consent()))
        throw new Error("Open the popup to read the public-import notice.");
      validate(message.input);
      const drafts = await this.drafts();
      const draft: Draft = {
        sourceTab: sender.tab.id,
        input: message.input,
        expires: this.now() + TTL,
      };
      await this.platform.writeDrafts(
        [
          ...drafts.filter((saved) => saved.sourceTab !== draft.sourceTab),
          draft,
        ].slice(-20),
      );
      return { ok: true };
    }
    const jobs = await this.jobs();
    if (message.type === "status") {
      if (!popup && role !== "chess") throw new Error("Invalid status sender.");
      const tab = popup ? message.tab : sender.tab?.id;
      const tabUrl =
        popup && tab !== undefined
          ? await this.platform.tabUrl(tab)
          : undefined;
      const draft = popup
        ? (await this.drafts()).find(
            (saved) =>
              saved.sourceTab === tab && saved.input.sourceUrl === tabUrl,
          )
        : undefined;
      return {
        consented: await this.platform.consent(),
        jobs: jobs.filter(
          (j) => j.sourceTab === tab || j.destinationTab === tab,
        ),
        draft: draft ?? null,
      };
    }
    if (message.type === "start") {
      if (role === "lichess")
        throw new Error("Transfers must start on Chess.com or in the popup.");
      if (!(await this.platform.consent()))
        throw new Error(
          "Open Knight Bridge in your toolbar and read the one-time public-import notice.",
        );
      const tab = popup ? message.sourceTab : sender.tab?.id;
      if (tab === undefined)
        throw new Error("Open the source tab before transferring.");
      const tabUrl = await this.platform.tabUrl(tab);
      if (
        !popup &&
        (!tabUrl ||
          tabUrl !== sender.url ||
          message.input.sourceUrl !== sender.url)
      )
        throw new Error("The game page changed. Try again.");
      if (
        tabUrl &&
        /^https:\/\/www\.chess\.com\//.test(tabUrl) &&
        context(tabUrl).kind === "excluded"
      )
        throw new Error(
          "Transfers are disabled on this page. Open a completed game or saved analysis.",
        );
      if (
        tabUrl &&
        ["game", "live-play"].includes(context(tabUrl).kind) &&
        message.input.kind !== "game"
      )
        throw new Error(
          "Game pages require a completed game with its final result.",
        );
      const result = await this.start(message.input, tab, jobs);
      await this.discardDraft(tab);
      return result;
    }
    const job =
      message.type === "hello"
        ? jobs.find((j) => j.destinationTab === sender.tab?.id)
        : jobs.find((j) => j.id === message.id);
    if (!job) {
      if (message.type === "hello") return { job: null };
      throw new Error(
        "This transfer expired or was cleared. Start again from your source game.",
      );
    }
    if (message.type === "continue") {
      if (!popup) throw new Error("Use Continue in the extension popup.");
      if (job.destinationTab === undefined) {
        return this.open(job, jobs);
      }
      try {
        const url = await this.platform.tabUrl(job.destinationTab);
        if (!url) throw new Error("closed");
        if (["opening", "ready", "sign-in", "failed"].includes(job.phase)) {
          await this.platform.navigate(
            job.destinationTab,
            destination(job.content, job.id),
          );
        }
        await this.platform.focus(job.destinationTab);
        return { job };
      } catch {
        if (["submitted", "imported", "manual"].includes(job.phase))
          throw new Error(
            "Submission outcome may be unknown. Check your Lichess imports before starting another transfer.",
          );
        return this.open(job, jobs);
      }
    }
    if (role !== "lichess" || job.destinationTab !== sender.tab?.id)
      throw new Error("This tab is not associated with that transfer.");
    const url = sender.url ?? "";
    const prepared = isPreparedUrl(url, job);
    const result =
      importResultUrl(url) &&
      ["submitted", "imported", "manual"].includes(job.phase);
    if (!prepared && !result) return { job: null };
    if (message.type === "hello") return { job };
    if (message.type === "event") {
      if (
        message.event === "analysis-complete" ||
        message.event === "analysis-queued"
      ) {
        if (!result || job.phase !== "imported" || job.destinationUrl !== url)
          throw new Error("Analysis evidence came from an unrelated page.");
        if (job.analysis !== "complete") {
          job.analysis =
            message.event === "analysis-complete" ? "complete" : "queued";
          job.message =
            job.analysis === "complete"
              ? "Analysis completed. Review the report on Lichess."
              : "Analysis queued or running on Lichess.";
          await this.platform.write(jobs);
        }
        return { job };
      }
      if (
        ["ready", "sign-in", "submitted"].includes(message.event) &&
        !prepared
      )
        throw new Error("Wrong import page.");
      if (["imported", "manual"].includes(message.event) && !result)
        throw new Error("No import result observed.");
      if (
        message.event === "imported" &&
        job.phase === "submitted" &&
        !["https://lichess.org/paste", "https://lichess.org/import"].includes(
          message.referrer ?? "",
        )
      )
        throw new Error(
          "Import success could not be confirmed from this navigation. Check the game on Lichess.",
        );
      if (message.event === "submitted" && job.phase === "submitted")
        throw new Error("This import was already submitted.");
      const next = transition(job, message.event);
      if (message.event === "submitted")
        next.analysisRequested = message.analysisRequested === true;
      if (message.event === "imported") {
        next.destinationUrl = url;
        next.analysis = job.analysisRequested ? "requested" : "none";
        next.message = job.analysisRequested
          ? "Game imported. Analysis requested; check Lichess for acceptance and progress."
          : "Game imported. Finish requesting analysis on Lichess.";
      }
      await this.platform.write(jobs.map((j) => (j.id === next.id ? next : j)));
      return { job: next };
    }
  }
  private async start(
    input: Input,
    sourceTab: number,
    jobs: Job[],
  ): Promise<{ job: Job }> {
    const content = validate(input);
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    const fingerprint = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const duplicate = jobs.find(
      (j) => j.sourceTab === sourceTab && j.fingerprint === fingerprint,
    );
    if (duplicate) {
      if (duplicate.destinationTab !== undefined)
        await this.platform
          .focus(duplicate.destinationTab)
          .catch(() => undefined);
      return { job: duplicate };
    }
    if (jobs.length >= 20)
      throw new Error(
        "There are 20 recent transfers. Clear local data or wait for expiration.",
      );
    const job: Job = {
      id: crypto.randomUUID(),
      fingerprint,
      sourceTab,
      created: this.now(),
      expires: this.now() + TTL,
      phase: "opening",
      content,
      analysisRequested: false,
      analysis: "none",
      message: "Opening Lichess…",
    };
    jobs.push(job);
    await this.platform.write(jobs);
    return this.open(job, jobs);
  }
  private async open(job: Job, jobs: Job[]): Promise<{ job: Job }> {
    // Create a harmless blank tab, then persist the binding before any website code runs.
    const tab = await this.platform.create();
    job.destinationTab = tab;
    await this.platform.write(jobs);
    try {
      await this.platform.navigate(tab, destination(job.content, job.id));
      if (job.content.kind === "position") {
        Object.assign(job, transition(job, "position"));
        await this.platform.write(jobs);
      }
    } catch {
      Object.assign(job, transition(job, "failed"));
      await this.platform.write(jobs);
      throw new Error("Could not open Lichess. Use Continue in the popup.");
    }
    return { job };
  }
}
