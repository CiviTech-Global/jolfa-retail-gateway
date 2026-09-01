/**
 * Canonical list of settings the storefront relies on.
 *
 * The admin panel can only edit settings that already exist as rows, so this
 * list is seeded on boot (`ensureDefaultSettings`) rather than only by the demo
 * seeder — a fresh install with no demo data must still expose branding.
 */
export interface SettingDefault {
  key: string;
  value: string;
  group: string;
  isPublic: boolean;
  description: string;
}

export const DEFAULT_SETTINGS: SettingDefault[] = [
  // Branding — name, title and logo of the whole application.
  {
    key: "site_name",
    value: "ارس پرو",
    group: "branding",
    isPublic: true,
    description: "Site name shown in header and footer",
  },
  {
    key: "site_title",
    value: "ارس پرو | فروشگاه محصولات محلی",
    group: "branding",
    isPublic: true,
    description: "Browser tab title and default page title",
  },
  {
    key: "site_logo_url",
    value: "",
    group: "branding",
    isPublic: true,
    description: "Logo image shown in header, footer and admin panel",
  },
  {
    key: "site_favicon_url",
    value: "",
    group: "branding",
    isPublic: true,
    description: "Favicon shown in the browser tab",
  },
  {
    key: "site_description",
    value: "فروشگاه محصولات محلی و سنتی ارس پرو",
    group: "branding",
    isPublic: true,
    description: "Meta description and hero subtitle",
  },

  { key: "currency", value: "تومان", group: "general", isPublic: true, description: "Currency label" },

  { key: "show_search", value: "true", group: "header", isPublic: true, description: "Show search input in header" },
  { key: "show_cart", value: "true", group: "header", isPublic: true, description: "Show cart icon in header" },
  { key: "show_user_menu", value: "true", group: "header", isPublic: true, description: "Show user account menu in header" },

  // Footer — every block is admin-editable so the storefront carries no
  // hard-coded marketing copy or placeholder contact details.
  { key: "show_trust_badges", value: "true", group: "footer", isPublic: true, description: "Show the trust badge strip above the footer" },
  { key: "show_footer_links", value: "true", group: "footer", isPublic: true, description: "Show the footer link columns" },
  { key: "show_footer_contact", value: "true", group: "footer", isPublic: true, description: "Show the footer contact block" },
  { key: "show_footer_social", value: "true", group: "footer", isPublic: true, description: "Show social links in the footer" },
  {
    key: "footer_about",
    value: "فروشگاه محصولات محلی و سنتی ارس پرو.",
    group: "footer",
    isPublic: true,
    description: "Short blurb under the logo in the footer",
  },
  { key: "footer_phone", value: "", group: "footer", isPublic: true, description: "Contact phone shown in the footer" },
  { key: "footer_email", value: "", group: "footer", isPublic: true, description: "Contact email shown in the footer" },
  { key: "footer_address", value: "", group: "footer", isPublic: true, description: "Postal address shown in the footer" },
  { key: "footer_instagram", value: "", group: "footer", isPublic: true, description: "Instagram profile URL" },
  { key: "footer_telegram", value: "", group: "footer", isPublic: true, description: "Telegram channel URL" },
  { key: "footer_whatsapp", value: "", group: "footer", isPublic: true, description: "WhatsApp contact URL" },
  {
    key: "footer_copyright",
    value: "",
    group: "footer",
    isPublic: true,
    description: "Copyright line; falls back to the site name and current year",
  },
  {
    // JSON so an admin can add, rename, reorder and remove columns without a
    // deploy. Shape: [{ "title": "...", "links": [{ "label": "...", "url": "..." }] }]
    key: "footer_link_columns",
    value: JSON.stringify([
      {
        title: "دسترسی سریع",
        links: [
          { label: "محصولات", url: "/products" },
          { label: "دسته‌بندی‌ها", url: "/categories" },
          { label: "درباره ما", url: "/about" },
          { label: "تماس با ما", url: "/contact" },
        ],
      },
      {
        title: "خدمات مشتریان",
        links: [
          { label: "قوانین و مقررات", url: "/rules" },
          { label: "سبد خرید", url: "/cart" },
          { label: "پیگیری سفارش", url: "/profile/orders" },
        ],
      },
    ]),
    group: "footer",
    isPublic: true,
    description: "Footer link columns as JSON",
  },

  { key: "show_about", value: "true", group: "static_pages", isPublic: true, description: "Show About page link" },
  { key: "show_contact", value: "true", group: "static_pages", isPublic: true, description: "Show Contact page link" },
  { key: "show_rules", value: "true", group: "static_pages", isPublic: true, description: "Show Rules page link" },
];

/**
 * Settings that used to exist and have since been dropped. Seeding only ever
 * adds rows, so without this an existing database keeps serving a key the
 * storefront no longer reads — and the admin panel keeps offering a switch
 * that does nothing.
 */
export const RETIRED_SETTING_KEYS = [
  // The newsletter block and its email capture were removed from the footer.
  "show_newsletter_footer",
];

export const DEFAULT_SETTING_KEYS = new Set(DEFAULT_SETTINGS.map((setting) => setting.key));

export function findSettingDefault(key: string): SettingDefault | undefined {
  return DEFAULT_SETTINGS.find((setting) => setting.key === key);
}
