"use client";
import { EmptyState } from "@/components/ui/EmptyState";
import { canDo, useAuth } from "@/lib/backend/auth";
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
  const { profile } = useAuth();
  const [tab, setTab] = useParam<Tab>("tab", "pages", ["id", "new", "media"]);
  const allowed = ["content", "catalogue", "designs"].some((c) => canDo(profile?.role, c));
  const active = TABS.some((t) => t.value === tab) ? tab : "pages";

  return (
    <div>
      <PageHeader title="CMS" sub="Everything on the public site that is not a product or a billboard. Edits save at once; the site changes when you publish." actions={<PublishSite compact />} />
      {!allowed ? <EmptyState title="Not part of your role." body="Content is managed by marketing and administrators. Ask an administrator if you need access." /> : (
        <>
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
