import { Button } from "@/components/ui/Button";

export type AuthContact = { email: string; whatsappHref: string | null };

/** Honest state for a build with no back-end configured. */
export function NotSwitchedOn({ contact }: { contact: AuthContact }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-title text-fog-50">Accounts are not switched on <span className="t-feel text-gold">yet</span>.</h1>
      <p className="text-fog-300">My SPP — saved designs, quotes, orders and reorders — opens once SPP connects its customer system. Nothing you type here would be saved, so we are not showing a form.</p>
      <p className="text-fog-400">You can still <span className="text-gold">start a project today</span>. We reply to every request personally.</p>
      <div className="flex flex-wrap gap-3">
        <Button href="/request-quote/" arrow>Request a quote</Button>
        {contact.whatsappHref && <Button href={contact.whatsappHref} variant="outline">WhatsApp SPP</Button>}
        {contact.email && <Button href={`mailto:${contact.email}`} variant="outline">Email SPP</Button>}
      </div>
    </div>
  );
}
