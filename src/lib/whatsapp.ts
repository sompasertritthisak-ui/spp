/**
 * Contextual WhatsApp deep links. Every conversion surface can hand the
 * customer to WhatsApp with the message already written, so nobody retypes a
 * Design ID. Returns null when SPP has not configured a number yet — callers
 * must then hide the channel rather than link to nowhere.
 */
export type WhatsAppContext =
  | { kind: "general" }
  | { kind: "product"; product: string; qty?: number }
  | { kind: "design"; product: string; designRef: string; qty?: number; sides?: string[]; neededBy?: string }
  | { kind: "quote"; quoteRef: string }
  | { kind: "billboard"; code: string; name: string; from?: string; to?: string; bookingRef?: string }
  | { kind: "consultation"; topic?: string }
  | { kind: "bundle"; bundle: string }
  | { kind: "order"; orderRef: string };

const nice = (iso?: string) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(`${iso}T00:00:00`)) : "");

export function whatsappMessage(ctx: WhatsAppContext): string {
  switch (ctx.kind) {
    case "product":
      return `Hello SPP, I would like to request a quotation for ${ctx.qty ? `${ctx.qty} ` : ""}${ctx.product}.`;
    case "design":
      return [
        `Hello SPP, I would like to request a quotation for ${ctx.qty ? `${ctx.qty} ` : ""}custom ${ctx.product}.`,
        `Design ID: ${ctx.designRef}.`,
        ctx.sides?.length ? `${ctx.sides.join(" + ")} printing.` : "",
        ctx.neededBy ? `Required date: ${nice(ctx.neededBy)}.` : "",
      ].filter(Boolean).join("\n");
    case "quote":
      return `Hello SPP, I am following up on quote request ${ctx.quoteRef}.`;
    case "billboard":
      return [
        `Hello SPP, I am interested in billboard ${ctx.code} — ${ctx.name}.`,
        ctx.from && ctx.to ? `Campaign period: ${nice(ctx.from)} to ${nice(ctx.to)}.` : "",
        ctx.bookingRef ? `Booking reference: ${ctx.bookingRef}.` : "",
      ].filter(Boolean).join("\n");
    case "consultation":
      return `Hello SPP, I would like to book a consultation${ctx.topic ? ` about ${ctx.topic}` : ""}.`;
    case "bundle":
      return `Hello SPP, I would like a quotation for the ${ctx.bundle}.`;
    case "order":
      return `Hello SPP, I have a question about order ${ctx.orderRef}.`;
    default:
      return "Hello SPP, I would like to start a project.";
  }
}

export function whatsappHref(number: string, ctx: WhatsAppContext): string | null {
  const digits = number.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage(ctx))}`;
}
