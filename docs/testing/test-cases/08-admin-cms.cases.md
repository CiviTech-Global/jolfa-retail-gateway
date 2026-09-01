# 08 — Admin: Homepage Sections, Banners, Settings: Automated Test Cases

Source: `docs/testing/08-admin-cms.md`. See `00-INDEX.md` for ID scheme/layers.

## 1. Homepage sections editor

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CMS-001 | List shows active + inactive with type/order | Component | `Jolfa-web/src/features/cms/pages/AdminHomepageSectionsPage.test.tsx` | `renders all sections including inactive ones with type and displayOrder` | — |
| CMS-002 | Type dropdown only offers known types | Component | `AdminHomepageSectionsPage.test.tsx` | `type select only lists SECTION_TYPE_OPTIONS values, no free text` | option list matches known-type constant exactly |
| CMS-003 | Duplicate key rejected | Integration | `Jolfa-Server/src/modules/homepage-sections/homepage-section.test.ts` | `POST /homepage-sections rejects a duplicate key with a clear error` | 400/409 |
| CMS-004 | Inline title/type edit | Component | `AdminHomepageSectionsPage.test.tsx` | `inline edit updates title and type and calls the update API with correct payload` | — |
| CMS-005 | Valid JSON config save updates storefront immediately | E2E | `e2e/admin-homepage-sections.spec.ts` | `saving a valid config change is reflected on the live homepage without further action` | — |
| CMS-006 | Invalid JSON blocked client-side, doesn't corrupt stored config | Component | `AdminHomepageSectionsPage.test.tsx` | `blocks save when config textarea contains invalid JSON and leaves stored config untouched` | parse error shown, no API call fired |
| CMS-007 | Toggle active/inactive removes/restores from homepage | Integration | `homepage-section.test.ts` | `GET /homepage-sections/public excludes isActive=false sections and includes them again once reactivated` | — |
| CMS-008 | Reorder up/down swaps displayOrder, storefront order changes | Integration + Component | `homepage-section.test.ts` (`swapping two sections' displayOrder is reflected in GET /homepage-sections/public order`); `AdminHomepageSectionsPage.test.tsx` (`reorder buttons swap adjacent displayOrder values in the rendered list`) | — |
| CMS-009 | Delete removes from admin list and public homepage | Integration | `homepage-section.test.ts` | `DELETE /homepage-sections/:id removes it from both admin list and public endpoint` | — |
| CMS-010 | Unrecognized `type` rejected at API boundary | Integration | `homepage-section.test.ts` | `POST /homepage-sections rejects a type string outside the known enum, even via direct API call bypassing the UI dropdown` | 400, confirms the soft-validation guard from the original design plan actually exists |
| CMS-011a..j | Each of the 10 section types renders correctly with realistic config | Component | one file per section (already itemized in `01-guest-browsing.cases.md` G-017–G-026); this row is the admin-authored-config round trip | `AdminHomepageSectionsPage.test.tsx` + E2E | `creating each section type via the admin form results in correct storefront rendering` (parametrized ×10, E2E in `e2e/admin-homepage-sections.spec.ts`) | one sub-case per type: hero_carousel, category_grid, product_carousel, flash_deals, banner_grid, brand_strip, trust_badges, blog_teaser, app_download, newsletter |
| CMS-012 | Legacy/alias types still render (backward compatibility) | Integration + Component | `homepage-section.test.ts`; relevant section-registry test | `a section with a legacy type alias (hero, categories, featured_products, new_products, discounted, promo_banner) still resolves to a renderable component` | section-registry lookup test per alias |

## 2. Banners

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CMS-013 | Create with all fields functional | Integration | `Jolfa-Server/src/modules/banners/banner.test.ts` | `POST /admin/banners persists title/subtitle/imageUrl/link/position/displayOrder/isActive` | — |
| CMS-014 | Position filter (`hero`/`sidebar`/`footer`) returns correct subset | Integration | `banner.test.ts` | `GET /banners/banners?position= returns only banners matching that position` (parametrized ×3) | — |
| CMS-015 | Edit reflects on storefront immediately | E2E | `e2e/admin-homepage-sections.spec.ts` | `editing a banner's image/link updates a banner-consuming section on the storefront` | — |
| CMS-016 | Toggle isActive off removes from public query | Integration | `banner.test.ts` | `an inactive banner is excluded from GET /banners/banners` | — |
| CMS-017 | Delete removes permanently | Integration | `banner.test.ts` | `DELETE /admin/banners/:id removes it permanently, confirmed by a subsequent GET returning 404` | — |
| CMS-018 | Authorization matrix for all 4 banner mutations | Integration | `banner.test.ts` | `rejects with 401/403, succeeds for admin` (parametrized) | — |

## 3. Settings

| ID | Checklist item | Layer | Test file (planned) | Test name | Key assertions |
|---|---|---|---|---|---|
| CMS-019 | Boolean settings auto-save on toggle | Component | `Jolfa-web/src/features/admin/pages/AdminSettingsPage.test.tsx` | `toggling a boolean setting immediately calls the update API with no separate save step` | — |
| CMS-020 | String settings require explicit save, disabled until changed | Component | `AdminSettingsPage.test.tsx` | `save button for a string setting is disabled until the value differs from its original` | — |
| CMS-021 | Each `show_*` flag has a verifiable storefront effect | E2E | `e2e/admin-homepage-sections.spec.ts` (or a dedicated `admin-settings.spec.ts`) | `toggling each show_* flag off hides and back on restores the corresponding storefront element` (parametrized ×9: show_search, show_cart, show_user_menu, show_about, show_contact, show_rules, show_footer_links, show_trust_badges, show_newsletter_footer) | cross-references `01-guest-browsing.cases.md` G-006/007/008/011/058-064 |
| CMS-022 | `site_name` change updates header/footer/title after save | E2E | same spec as CMS-021 | `changing site_name updates the header and footer text after save and reload` | — |
| CMS-023 | All `show_*` flags off simultaneously doesn't break layout | E2E | same spec | `disabling every show_* flag at once leaves the storefront layout intact with no broken gaps` | visual/structural assertion (no error boundary triggered, header/footer still render) |
| CMS-024 | Restoring all flags restores everything | E2E | same spec | `re-enabling every show_* flag restores all previously-hidden elements` | — |
| CMS-025 | Authorization matrix for settings endpoints | Integration | `Jolfa-Server/src/modules/settings/settings.test.ts` | `rejects with 401/403 for admin-only settings list/update, public endpoint remains open` | includes confirming `GET /settings/public` stays guest-accessible while `GET /settings` and `PATCH /settings/:key` require admin |
