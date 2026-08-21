# 08 — Admin: Homepage Sections, Banners, Settings

Role required: **ADMIN**. This is the area most affected by the recent redesign work — test it thoroughly.

---

## 1. Homepage sections editor (`/admin/homepage-sections`)

- [ ] List shows all sections (active + inactive) with their type and `displayOrder`.
- [ ] Create new section: key (unique), title, type dropdown — dropdown only offers known types (`hero_carousel`, `category_grid`, `product_carousel`, `flash_deals`, `banner_grid`, `brand_strip`, `trust_badges`, `blog_teaser`, `app_download`, `newsletter`) — confirm you cannot free-type an arbitrary/invalid type.
- [ ] Creating with a duplicate `key` is rejected with a clear error.
- [ ] Inline edit: title and type editable per row.
- [ ] Raw JSON config textarea: editing valid JSON and saving updates the section's rendered content on `/` immediately.
- [ ] Editing the config textarea with **invalid JSON** and attempting to save is blocked client-side with a clear error (does not corrupt the stored config).
- [ ] Toggle active/inactive: turning a section off removes it from `/` immediately (reload confirms); turning it back on restores it in its original position.
- [ ] Reorder up/down buttons swap `displayOrder` with the adjacent section — confirm the homepage rendering order changes to match after reload.
- [ ] Delete a section (confirm dialog) — removed from both the admin list and the public homepage.
- [ ] For **each** of the 10 section types, create/verify one instance and confirm it renders correctly on `/` with realistic config data (reuse the demo-seeded ones as a reference, or hand-craft config JSON per the shapes documented in `Jolfa-Server/src/modules/demo/demo.service.ts`):
  - [ ] `hero_carousel`
  - [ ] `category_grid`
  - [ ] `product_carousel`
  - [ ] `flash_deals`
  - [ ] `banner_grid`
  - [ ] `brand_strip`
  - [ ] `trust_badges`
  - [ ] `blog_teaser`
  - [ ] `app_download`
  - [ ] `newsletter`
- [ ] A section with a legacy/alias type (`hero`, `categories`, `featured_products`, `new_products`, `discounted`, `promo_banner`) — if any exist from before this redesign — still renders correctly (backward-compatibility check).

## 2. Banners (`/admin/banners`)

- [ ] Create: title, subtitle, image URL, link, position, displayOrder, isActive — all fields functional.
- [ ] A banner tied to `position: "hero"` vs `"sidebar"` vs `"footer"` — confirm the public `GET /api/v1/banners/banners?position=` filter actually returns the right subset (check via the section(s) that consume it, e.g. banner_grid).
- [ ] Edit updates reflect on the storefront immediately.
- [ ] Toggle isActive off — banner disappears from public banner queries.
- [ ] Delete (confirm dialog) removes it permanently.

## 3. Settings (`/admin/settings`)

- [ ] Boolean settings (`show_search`, `show_cart`, `show_user_menu`, `show_about`, `show_contact`, `show_rules`, `show_footer_links`, `show_trust_badges`, `show_newsletter_footer`) render as toggle switches and **auto-save on change** (no separate save button) — confirm each one's effect on the storefront matches [01-guest-browsing.md](./01-guest-browsing.md)'s corresponding checklist item.
- [ ] String settings (e.g. `site_name`) render as a text input with an explicit "save" button that's disabled until the value actually changes.
- [ ] Changing `site_name` updates the header/footer/title immediately after save (reload the storefront to confirm).
- [ ] Toggling every `show_*` flag off at once — the storefront doesn't break (header/footer degrade gracefully, no leftover broken layout gaps).
- [ ] Toggling every `show_*` flag back on restores everything correctly.

---

**Sign-off:** every section type renders correctly when active, is fully removable/reorderable, and every settings toggle has a verifiable, immediate effect on the public storefront → CMS admin surface is verified working.
