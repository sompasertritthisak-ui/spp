import { LegalDoc, type LegalSection } from "@/components/home/LegalDoc";
import { pageMeta } from "@/components/home/seo";
import { getContent } from "@/lib/content";

export const metadata = pageMeta({
  title: "Privacy Notice",
  description: "What the SPP website collects, why, and what it does not do: no advertising trackers, no third-party CDNs, cookieless first-party analytics that honour Do Not Track.",
  path: "/privacy/",
});

export default async function PrivacyPage() {
  const { settings } = await getContent();
  const mail = <a href={`mailto:${settings.email}`}>{settings.email}</a>;
  const sections: LegalSection[] = [
    {
      id: "short-version", title: "The short version",
      body: (
        <ul>
          <li><strong>No advertising trackers.</strong> No Google Analytics, no Meta pixel, no ad networks, no data sold or shared for advertising.</li>
          <li><strong>No third-party CDNs.</strong> Fonts, scripts, icons and the billboard map all ship with the site. Your browser is not sent to other companies’ servers just to display a page.</li>
          <li><strong>Cookieless analytics.</strong> We count visits and funnel steps ourselves, against a random session ID. It contains nothing about you, and it is switched off entirely if your browser sends Do Not Track.</li>
          <li><strong>We only contact you if you asked us to,</strong> or to answer a request you sent.</li>
          <li><strong>Your uploaded artwork is private.</strong> It is visible to you and to the SPP staff who need it to do the work.</li>
        </ul>
      ),
    },
    {
      id: "who", title: "Who is responsible",
      body: <p>{settings.legalName} (“SPP”), {settings.address.city}, {settings.address.country}, operates this website and is responsible for the information collected through it. Contact: {mail}.</p>,
    },
    {
      id: "what-you-give", title: "Information you give us",
      body: (
        <>
          <p>When you send a quote request, billboard request, consultation booking or contact message, we store what you typed: typically your name, company, email, phone or WhatsApp number, the details of what you need, and any design or files you attached. We use it to reply, prepare a quote, produce your order and keep the records a business must keep.</p>
          <p>If you create an account, we store your email address and profile details so you can sign in, save designs, follow orders and reorder.</p>
          <p>Forms include a hidden anti-spam field and submissions are rate-limited. Neither involves a third-party service or a CAPTCHA.</p>
        </>
      ),
    },
    {
      id: "analytics", title: "First-party analytics",
      body: (
        <>
          <p>We measure how the site is used so we can improve it — for example how many people open SPP Studio, and at which step of a quote request people stop. This is done by our own system, not by an analytics company.</p>
          <p>How it works: the first time an event is recorded, your browser generates a <strong>random session ID</strong> and keeps it in its local storage. It is not a cookie, is not derived from your device, and holds no personal information. Each event records the ID, the event name (such as “page view” or “quote started”), the page path, the time, and where relevant the product, a reference number, the step in a flow and a campaign source such as a QR code. If you are signed in, events may be linked to your account.</p>
          <p><strong>Do Not Track is honoured.</strong> If your browser sends the Do Not Track signal, no analytics events and no abandoned-activity records are sent at all. You can also clear the ID at any time by clearing this site’s data in your browser.</p>
        </>
      ),
    },
    {
      id: "abandoned", title: "Unfinished requests",
      body: (
        <>
          <p>If you begin a design, quote, project plan or billboard request and do not finish, the site records — against the same random session ID — which flow and step you reached, so that we can see where our forms are failing people.</p>
          <p><strong>Your email address is stored with that record only if you tick the consent box</strong> allowing SPP to send you a reminder with a link to pick up where you left off. Without that explicit consent, no contact details are kept for unfinished requests, and we will not contact you about them.</p>
        </>
      ),
    },
    {
      id: "artwork", title: "Artwork and designs",
      body: (
        <>
          <p>Files you upload to SPP Studio or attach to a request are kept in <strong>private storage</strong>. They are not publicly listed or reachable by a guessable link; access is restricted to your account and to the SPP staff roles that need the file, through short-lived signed links.</p>
          <p>While you work, SPP Studio keeps a draft of your design in your own browser so that a refresh does not lose it. Mockups you download are preview-resolution and watermarked with a Design ID so that our team can find your exact design when you get in touch.</p>
          <p>You keep all rights in your artwork. We use it only to prepare mockups, quotes and your production. We do not publish customer work without permission.</p>
        </>
      ),
    },
    {
      id: "browser-storage", title: "Cookies and browser storage",
      body: (
        <>
          <p>This site does not set advertising or third-party cookies. It uses your browser’s local storage for three things: the random analytics session ID, your Studio draft, and — if you sign in — the token that keeps you signed in. Clearing site data in your browser removes all three.</p>
        </>
      ),
    },
    {
      id: "security-logs", title: "Security records",
      body: <p>To stop abuse, the form endpoints keep a short-lived record of the IP address behind each submission, deleted after about a day. Actions taken by SPP staff in the back office are written to an audit log, which can include the staff member’s IP address. IP addresses are not used for analytics or advertising.</p>,
    },
    {
      id: "who-sees", title: "Who can see your information",
      body: (
        <>
          <p>SPP staff, limited by role: sales staff see requests and quotes, designers see designs and artwork, production sees orders. Access rules are enforced in the database itself, not just in the screens.</p>
          <p>The site’s database, file storage and sign-in are hosted for SPP by an infrastructure provider (Supabase) acting on our instructions. Transactional email — such as a confirmation of your request — passes through an email delivery provider. Where the AI design assistant is switched on, the text you type into it is sent to an AI model provider to generate suggestions; do not put personal information in those prompts.</p>
          <p>If you choose to continue a conversation on WhatsApp, Facebook or another platform, that platform’s own privacy terms apply there. We do not sell personal information, and we disclose it to authorities only where the law requires.</p>
        </>
      ),
    },
    {
      id: "retention", title: "How long we keep it",
      body: <p>Requests, quotes and order records are kept for as long as needed to serve you, support reorders and meet accounting and legal obligations. Analytics events are kept in order to compare periods and are not linked to a name unless you were signed in. You can ask us to delete your account, designs and uploaded artwork at any time; we will do so unless we are required to keep a record, such as an invoice.</p>,
    },
    {
      id: "your-choices", title: "Your choices",
      body: (
        <ul>
          <li>Ask for a copy of the information we hold about you, or ask us to correct or delete it — write to {mail}.</li>
          <li>Turn on Do Not Track in your browser to switch off analytics on this site.</li>
          <li>Leave the reminder-consent box unticked; everything still works.</li>
          <li>Withdraw a consent you gave earlier by writing to us.</li>
        </ul>
      ),
    },
    {
      id: "changes", title: "Changes to this notice",
      body: <p>If the way the site handles information changes, this page will be updated and the date at the top will change. Significant changes will be flagged on the site.</p>,
    },
  ];
  return (
    <LegalDoc
      eyebrow="Privacy"
      title={<>What we collect, and what we <span className="t-feel text-yellow">don’t.</span></>}
      lede="Written in plain language, and written to match what this website actually does."
      updated="September 2026"
      sections={sections}
      email={settings.email}
    />
  );
}
