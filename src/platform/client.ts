import { browser } from "wxt/browser";
import { type Message } from "./messages";
import { jobSchema } from "../transfer/job";
import { draftSchema } from "./messages";
import { z } from "zod/v3";
const reply = z.object({
  error: z.string().optional(),
  job: jobSchema.nullable().optional(),
  jobs: z.array(jobSchema).optional(),
  draft: draftSchema.nullable().optional(),
  consented: z.boolean().optional(),
  ok: z.boolean().optional(),
});
export async function send(message: Message) {
  const data = reply.parse(await browser.runtime.sendMessage(message));
  if (data.error) throw new Error(data.error);
  return data;
}
