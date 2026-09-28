"use client";
import { CtaBand } from "@/components/site/CtaBand";
import type { Bilingual, HomeLink } from "@/content/types";
import { rich, useCopy } from "./Copy";
import { HOME_DEFAULTS } from "./defaults";

const D = HOME_DEFAULTS.cta;

/** The landing page's closing band. Wording and both buttons come from CMS → Home page; empty fields keep the designed text. */
export function HomeCta({ title, body, primary, secondary }: { title?: Bilingual; body?: Bilingual; primary?: HomeLink; secondary?: HomeLink }) {
  const pick = useCopy();
  const heading = pick(title);
  // a secondary button exists only while it has somewhere to go
  const second = secondary ? secondary.href : "/consultation/";
  return (
    <CtaBand
      title={heading ? rich(heading, "plain") : D.title}
      body={pick(body) ?? D.body}
      primary={{ href: primary?.href || "/request-quote/", label: pick(primary?.label) ?? D.primary }}
      secondary={second ? { href: second, label: pick(secondary?.label) ?? D.secondary } : undefined}
    />
  );
}
