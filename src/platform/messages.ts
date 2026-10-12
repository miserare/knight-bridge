import { z } from "zod/v3";
import { inputSchema } from "../chess/content";
export const draftSchema = z
  .object({
    sourceTab: z.number().int(),
    input: inputSchema,
    expires: z.number().int(),
  })
  .strict();
export type Draft = z.infer<typeof draftSchema>;
export const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prepare"), input: inputSchema }).strict(),
  z.object({ type: z.literal("discard-draft") }).strict(),
  z
    .object({
      type: z.literal("start"),
      input: inputSchema,
      sourceTab: z.number().int().optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("status"), tab: z.number().int().optional() })
    .strict(),
  z.object({ type: z.literal("hello") }).strict(),
  z
    .object({
      type: z.literal("event"),
      id: z.string().uuid(),
      event: z.enum([
        "ready",
        "sign-in",
        "submitted",
        "imported",
        "manual",
        "analysis-queued",
        "analysis-complete",
      ]),
      analysisRequested: z.boolean().optional(),
      referrer: z.string().max(2048).optional(),
    })
    .strict(),
  z.object({ type: z.literal("continue"), id: z.string().uuid() }).strict(),
  z.object({ type: z.literal("clear") }).strict(),
  z.object({ type: z.literal("consent") }).strict(),
]);
export type Message = z.infer<typeof messageSchema>;
export type Sender = {
  id?: string;
  url?: string;
  tab?: { id?: number; url?: string };
  frameId?: number;
};
export function senderRole(
  sender: Sender,
  extensionId: string,
  popupUrl: string,
): "popup" | "chess" | "lichess" | undefined {
  if (sender.id !== extensionId || (sender.frameId ?? 0) !== 0) return;
  if (!sender.tab && sender.url === popupUrl) return "popup";
  if (sender.tab?.id === undefined || !sender.url) return;
  try {
    const u = new URL(sender.url);
    if (u.username || u.password || u.port || u.protocol !== "https:") return;
    if (u.hostname === "www.chess.com") return "chess";
    if (u.hostname === "lichess.org") return "lichess";
  } catch {
    return;
  }
}
