import { Button } from "@/components/ui/Button";
import { T } from "@/lib/i18n";

export type AuthContact = { email: string; whatsappHref: string | null };

/** Honest state for a build with no back-end configured. */
export function NotSwitchedOn({ contact }: { contact: AuthContact }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-title text-fog-50"><T k="auth.nsTitle" /> <span className="t-feel text-gold"><T k="auth.nsFeel" /></span>.</h1>
      <p className="text-fog-300"><T k="auth.nsBody" /></p>
      <p className="text-fog-400"><T k="auth.nsStart1" /> <span className="text-gold"><T k="auth.nsStart2" /></span><T k="auth.nsStart3" /></p>
      <div className="flex flex-wrap gap-3">
        <Button href="/request-quote/" arrow><T k="common.requestQuote" /></Button>
        {contact.whatsappHref && <Button href={contact.whatsappHref} variant="outline"><T k="common.whatsappSpp" /></Button>}
        {contact.email && <Button href={`mailto:${contact.email}`} variant="outline"><T k="common.emailSpp" /></Button>}
      </div>
    </div>
  );
}
