"use client";
import { Arrow, Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/backend/auth";
import { MediaLibrary } from "../media/MediaLibrary";
import { ResourceManager } from "../resource/ResourceManager";
import { useParam } from "../resource/useSelection";
import { PageHeader, Tabs } from "../ui";
import { postsConfig, portfolioConfig, solutionsConfig, templatesConfig } from "./configs/editorial";
import { categoriesConfig, faqsConfig, servicesConfig, teamConfig, testimonialsConfig } from "./configs/simple";
import { PagesManager } from "./pages/PagesManager";
import { PublishSite } from "./PublishSite";

const TABS = [
  { value: "pages", label: "Pages" }, { value: "portfolio", label: "Portfolio" }, { value: "journal", label: "Journal" }, { value: "faqs", label: "FAQs" },
  { value: "testimonials", label: "Testimonials" }, { value: "team", label: "Team" }, { value: "services", label: "Services" }, { value: "solutions", label: "Solutions" },
  { value: "categories", label: "Categories" }, { value: "templates", label: "Design templates" }, { value: "media", label: "Media library" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** CMS hub. `?tab=` picks the content type; `?id=` / `?new=1` the record inside it (cleared when the tab changes). */
export function CmsHub() {
  const { can } = useAuth();
  const [tab, setTab] = useParam<Tab>("tab", "pages", ["id", "new", "media"]);
  const allowed = ["content", "catalogue", "designs"].some((c) => can(c));
  const active = TABS.some((t) => t.value === tab) ? tab : "pages";

  return (
    <div>
      <PageHeader title="CMS" sub="Everything on the public site that is not a product or a billboard. Edits save at once; the site changes when you publish." actions={<PublishSite compact />} />
      {!allowed ? <EmptyState title="Not part of your role." body="Content is managed by marketing and administrators. Ask an administrator if you need access." /> : (
        <>
          {can("content") && (
            <section aria-labelledby="cms-home-card" className="crop relative mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border border-gold/50 bg-ink-900 p-5 [--crop-color:var(--color-gold)] sm:p-6">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gold" />
              <div className="min-w-0 max-w-3xl">
                <p className="t-label mb-2 text-gold">Landing page</p>
                <h2 id="cms-home-card" className="t-heading text-fog-50">Home page</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-fog-400">Edit the hero and every section of the main landing page, choose the products to feature, reorder or hide sections, add your own blocks and set the announcement bar — in English and Lao.</p>
              </div>
              <Button href="/admin/cms/home/" className="min-h-11">Edit the home page <Arrow /></Button>
            </section>
          )}
          <Tabs label="Content types" tabs={[...TABS]} value={active} onChange={setTab} />
          {active === "pages" && <PagesManager />}
          {active === "portfolio" && <ResourceManager key="portfolio" config={portfolioConfig} />}
          {active === "journal" && <ResourceManager key="journal" config={postsConfig} />}
          {active === "faqs" && <ResourceManager key="faqs" config={faqsConfig} />}
          {active === "testimonials" && <ResourceManager key="testimonials" config={testimonialsConfig} />}
          {active === "team" && <ResourceManager key="team" config={teamConfig} />}
          {active === "services" && <ResourceManager key="services" config={servicesConfig} />}
          {active === "solutions" && <ResourceManager key="solutions" config={solutionsConfig} />}
          {active === "categories" && <ResourceManager key="categories" config={categoriesConfig} />}
          {active === "templates" && <ResourceManager key="templates" config={templatesConfig} />}
          {active === "media" && <MediaLibrary />}
        </>
      )}
    </div>
  );
}
