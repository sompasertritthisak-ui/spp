import Link from "next/link";
import { LegalDoc, type LegalSection } from "@/components/home/LegalDoc";
import { pageMeta } from "@/components/home/seo";
import { getContent } from "@/lib/content";

export const metadata = pageMeta({
  title: "Terms of Use",
  description: "Plain-language terms for using the SPP website: estimates and quotes, SPP Studio mockups, artwork, billboard requests, proofs and production.",
  path: "/terms/",
});

export default async function TermsPage() {
  const { settings } = await getContent();
  const sections: LegalSection[] = [
    {
      id: "about", title: "About these terms",
      body: <p>This website is operated by {settings.legalName} (“SPP”), {settings.address.city}, {settings.address.country}. By using it you agree to these terms. They cover the website and its tools. An order for goods or services is governed by the written quote and any contract SPP issues for that order; where the two differ, the quote or contract prevails.</p>,
    },
    {
      id: "estimates", title: "Estimates, quotes and prices",
      body: (
        <>
          <p><strong>An on-site estimate is a guide, not an offer.</strong> “From” prices and instant estimates are calculated from typical specifications and can change with quantity, artwork, materials, deadlines and delivery.</p>
          <p><strong>The written quote from SPP is the price.</strong> A quote is valid for the period stated on it. Nothing on this website obliges either of us until a quote has been accepted in writing.</p>
        </>
      ),
    },
    {
      id: "requests", title: "Requests are not orders",
      body: (
        <>
          <p>Sending a quote request, consultation request or project plan starts a conversation. You will receive a reference number so you can follow it up; it does not create an order.</p>
          <p><strong>A billboard request is not a booking.</strong> It reserves nothing automatically. A site is secured only when SPP has confirmed availability for your dates in writing and the agreed contract and payment terms are in place. Site details shown online — dimensions, lighting, availability dates, guide prices — are subject to confirmation by SPP.</p>
        </>
      ),
    },
    {
      id: "studio", title: "SPP Studio and mockups",
      body: (
        <>
          <p>SPP Studio mockups are a close visual guide to placement, scale and colour. Screens, fabrics and inks render colour differently, so a mockup is not a colour-accurate proof. Final colours, sizes and positions are confirmed on a production proof.</p>
          <p>Downloads are preview-resolution and watermarked with a Design ID. They are for review and approval, not for production elsewhere.</p>
          <p><strong>Automated preflight checks are advisory. Final production approval is subject to SPP review.</strong></p>
          <p>Where an AI assistant is available it offers suggestions only. It cannot place orders, approve artwork or make commitments on SPP’s behalf.</p>
        </>
      ),
    },
    {
      id: "artwork", title: "Your artwork and your responsibilities",
      body: (
        <>
          <p>You keep ownership of everything you upload. You give SPP permission to store, display to you, and reproduce it solely to prepare mockups, quotes, proofs and your production.</p>
          <p>You confirm that you have the right to use the logos, images, names and text you submit, and that they do not infringe anyone else’s rights or break the law. SPP may decline any job at its discretion, including artwork it believes to be unlawful, infringing or offensive.</p>
        </>
      ),
    },
    {
      id: "production", title: "Proofs, production and delivery",
      body: (
        <>
          <p>Production begins after you approve the proof and any agreed deposit is received. Once approved, changes may not be possible or may carry a cost. Please check spelling, sizes, quantities and colours on the proof carefully — approved proofs are the reference for quality control.</p>
          <p>Lead times shown on the site are typical, in working days from artwork approval, and are not guaranteed until confirmed on your quote. Slight variation in colour, print position and garment measurement is normal in production and is not a defect.</p>
          <p>If something arrives wrong, tell us promptly with photographs and your order reference, and we will put right what is our error.</p>
        </>
      ),
    },
    {
      id: "accounts", title: "Accounts",
      body: <p>Keep your sign-in details to yourself and tell us if you think someone else has used your account. We may suspend accounts used to abuse the service, submit spam or attempt to access other people’s information.</p>,
    },
    {
      id: "content", title: "This website’s content",
      body: (
        <>
          <p>The SPP name, wordmark, site design and written content belong to SPP. The logo files offered on the <Link href="/brand/">brand guidelines</Link> page may be used to refer to SPP, following those guidelines.</p>
          <p>Portfolio entries labelled <strong>“Sample project”</strong> are illustrative, with fictional clients and illustrative figures. They are not claims about real customers or results.</p>
        </>
      ),
    },
    {
      id: "liability", title: "Availability and liability",
      body: <p>We work to keep the website accurate and available but provide it “as is”: it may contain errors, change, or be offline at times. To the extent the law allows, SPP is not liable for losses arising from reliance on website content or estimates rather than on a written quote, proof or contract.</p>,
    },
    {
      id: "law", title: "Governing law and changes",
      body: <p>These terms are governed by the laws of the Lao PDR. We may update them; the date at the top shows the latest version, and the version in force when you send a request applies to that request.</p>,
    },
  ];
  return (
    <LegalDoc
      eyebrow="Terms"
      title={<>The fine print, in plain <span className="t-feel text-yellow">words.</span></>}
      lede="What the website promises, what it does not, and where a written quote takes over."
      updated="September 2026"
      sections={sections}
      email={settings.email}
    />
  );
}
