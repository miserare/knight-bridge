import { z } from "zod/v3";
export const TTL = 30 * 60 * 1000;
export const phaseSchema = z.enum([
  "opening",
  "ready",
  "sign-in",
  "submitted",
  "imported",
  "position",
  "manual",
  "failed",
]);
export type Phase = z.infer<typeof phaseSchema>;
export const jobSchema = z.object({
  id: z.string().uuid(),
  fingerprint: z.string(),
  sourceTab: z.number().int(),
  destinationTab: z.number().int().optional(),
  created: z.number(),
  expires: z.number(),
  phase: phaseSchema,
  content: z.object({
    kind: z.enum(["game", "line", "position"]),
    pgn: z.string().optional(),
    fen: z.string().optional(),
    result: z.string().optional(),
    orientation: z.enum(["white", "black"]),
    plies: z.number(),
    note: z.string(),
  }),
  analysisRequested: z.boolean().default(false),
  analysis: z.enum(["none", "requested", "queued", "complete"]).default("none"),
  destinationUrl: z.string().optional(),
  message: z.string(),
});
export type Job = z.infer<typeof jobSchema>;
export const messages: Record<Phase, string> = {
  opening: "Opening Lichess…",
  ready: "Ready. Click Import game on Lichess to continue.",
  "sign-in": "Sign in to Lichess, then use Continue here.",
  submitted: "Import submitted. Waiting for Lichess; do not submit again.",
  imported: "Game imported. Check Computer analysis on Lichess.",
  position:
    "Position analysis opened. A position has no historical mistakes report.",
  manual: "Finish requesting analysis on Lichess.",
  failed: "Transfer interrupted. Continue to recover your game.",
};
const transitions: Record<Phase, Phase[]> = {
  opening: ["ready", "sign-in", "position", "failed"],
  ready: ["sign-in", "submitted", "failed"],
  "sign-in": ["ready", "submitted", "failed"],
  submitted: ["imported", "manual", "failed"],
  imported: ["manual"],
  position: [],
  manual: [],
  failed: ["ready", "sign-in"],
};
export function transition(job: Job, phase: Phase): Job {
  if (job.phase === phase) return job;
  if (!transitions[job.phase].includes(phase))
    throw new Error("This transfer cannot repeat that action.");
  return { ...job, phase, message: messages[phase] };
}
export function destination(content: Job["content"], id: string): string {
  if (content.kind === "position" && content.fen)
    return `https://lichess.org/analysis/standard/${encodeURIComponent(content.fen.replace(/ /g, "_"))}?color=${content.orientation}`;
  return `https://lichess.org/paste#knight-bridge=${id}`;
}
export function importResultUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.origin === "https://lichess.org" &&
      /^\/[a-zA-Z0-9]{8}(?:\/(?:white|black))?$/.test(u.pathname) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
export function isPreparedUrl(raw: string, job: Job): boolean {
  return raw === destination(job.content, job.id);
}
