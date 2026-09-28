# Running SPP after launch — roles, content and publishing

Written for SPP's super admin and content managers. No developer is needed for
anything on this page. Staff-facing detail for the landing page editor is in
[CMS-HOME.md](CMS-HOME.md); the security model is in [SECURITY.md](SECURITY.md).

## 1 · How a change reaches the public site

1. Edit in the Command Center (`/admin/`). Saving writes to the database at once.
2. Press **Publish site** (CMS header). This rebuilds the public website from the database.
3. The site updates in about 3 minutes when the GitHub publish token is set, or
   within about 15 minutes without it (a scheduled job notices the request and
   rebuilds). A rebuild also runs every night at 02:15 Vientiane time.

Things that are live immediately, with no publish: everything inside the
Command Center and My SPP (leads, quotes, orders, production, designs, roles).
Things that need Publish: anything a visitor sees on the public pages.

## 2 · Roles and hierarchy

Command Center → Settings → **Roles & hierarchy** (super admin only) and **People**.

- A role has a **rank** (1–99; the super admin is 100) and, per area, a level:
  **None**, **View** or **Edit**.
- People can only be moved by someone ranked strictly above both their current
  and their new role. Only a super admin can create, edit or delete roles, and
  only a super admin can make someone an admin or super admin.
- Nobody can change their own role. The last super admin cannot be removed.
- New staff register on the website first; then give them a role under People.

### Recommended ladder for SPP

| Rank | Role | Edit | View |
|---|---|---|---|
| 100 | Super admin (owner) | Everything, plus security, roles, flags | — |
| 90 | Admin (operations manager) | Everything except security | — |
| 70 | Sales manager | Sales, designs, billboards, catalogue, finance, team | Pricing, analytics, production |
| 60 | Content manager | Content, catalogue, campaigns, billboards | Analytics |
| 60 | Sales | Sales, designs, billboards | Catalogue, pricing, production |
| 55 | Accounts | Finance | Sales, analytics |
| 50 | Designer | Designs | Production, sales |
| 50 | Production | Production | Designs |
| 40 | Customer service | Sales | Designs, billboards, production |
| 30 | Warehouse & delivery | Production | — |
| 10 | Viewer (auditor, trainee) | — | Everything grantable |

Give **Team: edit** sparingly: it lets a person assign roles below their own
rank and read the audit log.

## 3 · The landing page — who should do what

Recommended split. "CM" is the content manager; "SA" is the super admin.

| Task | CM | SA | Notes |
|---|---|---|---|
| Reword hero, section headings and intros (English and Lao) | ✅ | ✅ | "Reset to default" restores the designed wording |
| Reorder sections, hide or show a section | ✅ | ✅ | Hide rather than delete; hidden sections keep their settings |
| Choose featured products, categories, portfolio projects, FAQs | ✅ | ✅ | Up to 12 products, 6 projects |
| Add a custom block (text, image and text, gallery, video, banner) | ✅ | ✅ | CMS → Home page → Custom blocks |
| Announcement bar on or off, wording, link | ✅ | ✅ | Use for closures, holidays, new services — not discounts |
| Change hero word, print styles and buttons | ✅ | ✅ | Keep the word short; 22 characters maximum |
| Add, edit, archive products, categories and bundles | ✅ | ✅ | Archive instead of delete when a product has orders |
| Upload photos and logos to the media library | ✅ | ✅ | Always fill in the description for accessibility |
| Blog posts, portfolio case studies, FAQs, testimonials | ✅ | ✅ | Testimonials need the customer's recorded consent |
| Billboard locations, type, material, availability | ✅ | ✅ | Never enter a price; requests are quoted in writing |
| Press Publish site | ✅ | ✅ | Needs Edit on content, catalogue or settings |
| Landing-page SEO title and description | ✅ | ✅ | One sentence each; no keyword stuffing |
| Company details: address, phone, WhatsApp, email, social, hours | — | ✅ | Settings → Company & contact (admin) |
| Pricing rules and quantity tiers | — | ✅ | Admin only; never visible to customers as rules |
| Feature switches (Studio, AI, portal, booking) | — | ✅ | Settings → Feature flags |
| Roles, hierarchy, people | — | ✅ | Admins may assign roles below their rank |
| Delete a published page, product with history, or a role | — | ✅ | Deleting is permanent; prefer archive or hide |

### Rules of thumb

- **Hide, don't delete.** Hidden content can return in one click; deleted content cannot.
- **Publish once per batch of edits**, not after every field.
- **Both languages.** Fill in Lao where you change English; an empty Lao field
  falls back to English.
- **No prices, savings or promises** on the landing page. Quotations are written.
- **Check on a phone** after publishing; most visitors are on mobile.

## 4 · What still needs a developer

- New kinds of section or block, new page layouts, colours and typography.
- The inner wording of three designed sections: the five verbs in the position
  statement, the five "plates", and the three Studio feature rows.
- The fixed honesty notes (for example "A request is not a booking").
- New product types in SPP Studio (a new garment shape or print area rule).
- Changing the domain, email sender or integrations (Google Sheets, AI key).
