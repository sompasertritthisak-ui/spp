"use client";
import { z } from "zod";
import { BackendError, requireBackend } from "@/lib/backend/client";

/**
 * JARVIS — client side. The model runs in the `jarvis` Edge Function (the API
 * key never reaches the browser). Everything that comes back is untrusted:
 * schema-validated here, and every suggested action is shown as a button the
 * customer chooses to press — nothing is applied automatically.
 */
export type JarvisMode = "quote" | "studio";
export type JarvisMessage = { role: "user" | "assistant"; content: string };
export type JarvisContext = {
  lines?: { product: string; qty: number; note: string | null }[];
  neededBy?: string | null;
  product?: string | null;
  garment?: string | null;
  colour?: string | null;
  side?: string | null;
  existingText?: string[];
  locale?: "en" | "lo";
};

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_line"), product: z.string().max(120), qty: z.number().int().min(1).max(1_000_000).optional(), note: z.string().max(300).optional() }),
  z.object({ type: z.literal("set_needed_by"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ type: z.literal("set_design_help"), value: z.boolean().optional() }),
  z.object({ type: z.literal("open_studio"), product: z.string().max(120).optional() }),
  z.object({ type: z.literal("suggest_layout"), prompt: z.string().max(600).optional() }),
]);
export type JarvisAction = z.infer<typeof action>;

const reply = z.object({
  reply: z.string().max(3000),
  actions: z.array(z.unknown()).max(6).optional(),
  followUps: z.array(z.string().max(80)).max(3).optional(),
});
export type JarvisReply = { reply: string; actions: JarvisAction[]; followUps: string[] };

export async function askJarvis(mode: JarvisMode, messages: JarvisMessage[], context: JarvisContext): Promise<JarvisReply> {
  const { data, error } = await requireBackend().functions.invoke("jarvis", { body: { mode, messages: messages.slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })), context } });
  if (error) {
    let msg = "";
    try { msg = ((await (error as { context?: Response }).context?.json()) as { error?: string } | undefined)?.error ?? ""; } catch { /* no body */ }
    throw new BackendError(msg || "Jarvis is not available right now. Everything else keeps working without him.", "unknown");
  }
  const parsed = reply.safeParse(data);
  if (!parsed.success) throw new BackendError("Jarvis sent something we could not use. Please try again.", "unknown");
  const actions = (parsed.data.actions ?? []).map((a) => action.safeParse(a)).flatMap((r) => (r.success ? [r.data] : []));
  return { reply: parsed.data.reply, actions, followUps: parsed.data.followUps ?? [] };
}
