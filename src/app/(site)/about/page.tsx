import { pageMeta } from "@/components/home/seo";
import { Logo } from "@/components/brand/Logo";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, Section, SectionHead } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { getContent } from "@/lib/content";

export const metadata = pageMeta({
  title: "About SPP — Creative Production in Laos",
  description: "SPP is a Vientiane-based creative production company: design, visualisation, apparel, print, signage and billboards, run as one connected chain from idea to reorder.",
  path: "/about/",
});

const CHAIN = [
  { step: "Idea", who: "You + SPP", body: "We start with the outcome you want — a launch, a uniform, a campaign — not with a product code." },
  { step: "Design", who: "SPP designers", body: "Artwork is drawn for the garment, the substrate and the viewing distance it will actually meet." },
  { step: "Visualise", who: "SPP Studio", body: "You see the design on the product, front and back, before anything is made." },
  { step: "Quote", who: "SPP", body: "On-site estimates are a guide. The written quote from SPP is the price, with nothing hidden in it." },
  { step: "Approve", who: "You", body: "A production proof is sent for sign-off. Nothing is printed until you have approved it." },
  { step: "Produce", who: "SPP production", body: "One team and one job number, however many product lines the project touches." },
  { step: "Quality control", who: "SPP QC", body: "Every order passes the same checklist before it is packed." },
  { step: "Deliver", who: "SPP", body: "Shipped to any province, or installed by our own crews for signage and billboards." },
  { step: "Reorder", who: "You", body: "Designs, sizes and specifications stay on file, so the next run is one message — not a new project." },
] as const;

const PRINCIPLES = [
  { title: "Show it before we make it.", body: "Mockups, previews and proofs come first. Approvals are faster when nobody has to imagine anything." },
  { title: "Design for the press, not the screen.", body: "Artwork that ignores production gets rebuilt at the last minute. Ours starts from how it will be made." },
  { title: "Say what is true.", body: "An estimate is called an estimate. A billboard request is called a request until our team confirms it. Automated artwork checks are advisory, and a person reviews every file." },
  { title: "One job, one owner.", body: "A shirt, a banner and a billboard for the same launch are one project with one point of contact — not three orders that happen to share a logo." },
  { title: "Make the second order easy.", body: "The best measure of a production company is whether people come back. We keep what we need on file so that coming back is effortless." },
] as const;

export default async function AboutPage() {
  const { settings } = await getContent();
  return (
    <>
      <PageHero
        plate="00"
        eyebrow={`About ${settings.companyName}`}
        title={<>We turn ideas into things you can <span className="t-feel text-yellow">hold.</span></>}
        lede={settings.description}
        actions={<><Button href="/request-quote/" size="lg" arrow>Start a project</Button><Button href="/services/" size="lg" variant="outline">Explore our services</Button></>}
      />

      <Section>
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="t-label mb-6 text-fog-400">The company</p>
            <Logo className="h-16 w-auto lg:h-24" />
            <dl className="mt-12 border-b border-gold/40">
              {[
                ["Registered name", settings.legalName],
                ["Established", String(settings.foundedYear)],
                ["Based in", `${settings.address.city}, ${settings.address.country}`],
                ["Works across", "Every province of Laos"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-6 border-t border-gold/25 py-4">
                  <dt className="t-label text-fog-400">{k}</dt>
                  <dd className="text-right text-base text-fog-50">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-7">
            <h2 className="t-title max-w-[22ch] text-fog-50">A production company that begins before the press and carries on after it.</h2>
            <div className="mt-8 max-w-[62ch] space-y-6 text-lg leading-relaxed text-fog-300">
              <p>
                {settings.legalName} has been producing in {settings.address.city} since {settings.foundedYear}. The work covers custom clothing and uniforms, promotional products, printed materials, display and event systems, signage, vehicle branding and a billboard network.
              </p>
              <p>
                Most customers arrive asking for a product. What they usually need is a result: a team that looks like a team, a shop people can find, a message a whole city sees. So we organised the company around the full chain — idea, design, visualisation, production and promotion — instead of around machines.
              </p>
              <p>
                This website is part of that. SPP Studio lets you see your design before it is made, the Outdoor Network shows every billboard site on a map, and each request arrives with your design attached so nobody has to explain it twice.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHead plate="01" tone="paper" eyebrow="The way we work" title={<>Nine steps. No <span className="t-feel">surprises.</span></>} lede="Every project — twelve caps or twelve billboards — moves through the same chain. You always know which step you are on, and what happens next." />
        <ol className="grid border-t-2 border-paper-ink md:grid-cols-2 md:gap-x-16">
          {CHAIN.map((c, i) => (
            <Reveal as="li" key={c.step} i={i % 2} className="grid grid-cols-[4.5rem_1fr] gap-x-4 border-b border-paper-line py-7 lg:grid-cols-[7rem_1fr]">
              <span className="t-data text-5xl font-medium leading-none tracking-[-0.05em] text-paper-ink lg:text-7xl">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="t-heading block text-paper-ink">{c.step}</span>
                <span className="t-label mt-2 block text-paper-mute">{c.who}</span>
                <span className="mt-3 block max-w-[44ch] text-base leading-relaxed text-paper-mute">{c.body}</span>
              </span>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section tone="gold">
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-[calc(var(--nav-h)+3rem)]">
              <p className="t-label mb-6 flex items-center gap-3 text-ink-900"><span aria-hidden className="reg text-ink-950" />Plate 02 — Principles</p>
              <h2 className="t-display text-ink-950">What we hold ourselves to.</h2>
              <span aria-hidden className="gold-bar mt-7 !bg-ink-950" />
            </div>
          </div>
          <ol className="border-b border-ink-950/30 lg:col-span-8">
            {PRINCIPLES.map((p, i) => (
              <Reveal as="li" key={p.title} className="grid gap-x-8 gap-y-3 border-t border-ink-950/30 py-8 sm:grid-cols-[3rem_1fr] lg:py-10">
                <span className="t-data text-xs text-ink-950 sm:pt-2">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="t-title block text-ink-950">{p.title}</span>
                  <span className="mt-4 block max-w-[58ch] text-lg leading-relaxed text-ink-900">{p.body}</span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      <CtaBand
        title="Bring us the outcome. We will work out the rest."
        body="A short conversation is usually enough to turn a goal into a plan and a quote."
        primary={{ href: "/request-quote/", label: "Start a project" }}
        secondary={{ href: "/consultation/", label: "Let's talk" }}
      />
    </>
  );
}
