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
    value: "بازارچه جلفا",
    group: "branding",
    isPublic: true,
    description: "Site name shown in header and footer",
  },
  {
    key: "site_title",
    value: "بازارچه جلفا | فروشگاه محصولات محلی",
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
    value: "فروشگاه محصولات محلی و سنتی بازارچه جلفا",
    group: "branding",
    isPublic: true,
    description: "Meta description and hero subtitle",
  },

  { key: "currency", value: "تومان", group: "general", isPublic: true, description: "Currency label" },

  { key: "show_search", value: "true", group: "header", isPublic: true, description: "Show search input in header" },
  { key: "show_cart", value: "true", group: "header", isPublic: true, description: "Show cart icon in header" },
  { key: "show_user_menu", value: "true", group: "header", isPublic: true, description: "Show user account menu in header" },

  { key: "show_footer_links", value: "true", group: "footer", isPublic: true, description: "Show footer quick links" },
  { key: "show_newsletter_footer", value: "true", group: "footer", isPublic: true, description: "Show newsletter signup block in footer" },

  { key: "show_about", value: "true", group: "static_pages", isPublic: true, description: "Show About page link" },
  { key: "show_contact", value: "true", group: "static_pages", isPublic: true, description: "Show Contact page link" },
  { key: "show_rules", value: "true", group: "static_pages", isPublic: true, description: "Show Rules page link" },
];

export const DEFAULT_SETTING_KEYS = new Set(DEFAULT_SETTINGS.map((setting) => setting.key));

export function findSettingDefault(key: string): SettingDefault | undefined {
  return DEFAULT_SETTINGS.find((setting) => setting.key === key);
}
