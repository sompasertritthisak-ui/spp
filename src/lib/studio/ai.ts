"use client";
import { z } from "zod";
import { BackendError, requireBackend } from "@/lib/backend/client";
import { normaliseLayers, type Layer } from "./schema";

/**
 * SPP AI DESIGN ASSISTANT — client side. The model runs in the `ai-assistant`
 * Edge Function (the API key never reaches the browser). Whatever comes back
 * is treated as untrusted: it is schema-validated, clamped to the design
 * schema, and only ever shown as a SUGGESTION the customer may apply.
 */
export type AiContext = { productSlug: string; productName: string; garment: string; side: string; colour: string; areaAspect: number; availableColours: { name: string; hex: string }[]; brandColours: string[]; existingText: string[] };

const reply = z.object({
  message: z.string().max(1200),
  layers: z.array(z.unknown()).max(12).optional(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ideas: z.array(z.string().max(80)).max(6).optional(),
});
export type AiSuggestion = { message: string; layers: Layer[]; colour?: string; ideas: string[] };

export async function askAssistant(prompt: string, context: AiContext): Promise<AiSuggestion> {
  const { data, error } = await requireBackend().functions.invoke("ai-assistant", { body: { task: "design", prompt: prompt.slice(0, 600), context } });
  if (error) {
    // supabase-js hides the body of non-2xx replies inside error.context
    let msg = "";
    try { msg = ((await (error as { context?: Response }).context?.json()) as { error?: string } | undefined)?.error ?? ""; } catch { /* no body */ }
    throw new BackendError(msg || "The design assistant is not available right now. You can keep designing — everything else works without it.", "unknown");
  }
  const parsed = reply.safeParse(data);
  if (!parsed.success) throw new BackendError("The assistant sent something we could not use. Please try again.", "unknown");
  const maxY = 1000 * context.areaAspect;
  const layers = normaliseLayers(parsed.data.layers ?? []).filter((l) => l.type !== "image").map((l) => ({ ...l, x: Math.min(1000, Math.max(0, l.x)), y: Math.min(maxY, Math.max(0, l.y)) }) as Layer);
  return { message: parsed.data.message, layers, colour: parsed.data.colour, ideas: parsed.data.ideas ?? [] };
}
