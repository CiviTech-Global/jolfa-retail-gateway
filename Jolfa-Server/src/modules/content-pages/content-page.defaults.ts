import type { ContentBlock } from "./content-page.types.js";

export interface DefaultContentPage {
  slug: string;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  blocks: ContentBlock[];
}

/**
 * The copy these pages shipped with, lifted out of the React components so an
 * admin can edit it.
 *
 * Seeded verbatim rather than rewritten. Some of it is stale — it still
 * describes a Jolfa marketplace and carries a jolfa.local support address from
 * before the Araspro rebrand — but inventing replacement business facts
 * (addresses, phone numbers, what the shop sells) is not ours to do. Seeding it
 * as-is puts the existing words in front of the admin in an editor, which is
 * the point of the change.
 */
export const DEFAULT_CONTENT_PAGES: DefaultContentPage[] = [
  {
    slug: "about",
    title: "درباره ما",
    metaDescription: "درباره فروشگاه، محصولات و نحوه ارسال سفارش‌ها.",
    blocks: [
      {
        id: "about-heading",
        type: "heading",
        text: "درباره ارس پرو",
        subtitle:
          "ارس پرو فروشگاهی آنلاین برای عرضه محصولات محلی، سنتی و باکیفیت منطقه آزاد جلفا است. هدف ما ایجاد بستری ساده و مطمئن برای خرید مستقیم از تولیدکنندگان و عرضه‌کنندگان محلی است.",
        align: "center",
      },
      {
        id: "about-highlights",
        type: "feature_cards",
        title: null,
        cards: [
          {
            icon: "store",
            title: "فروشگاه محلی",
            description: "دسترسی مستقیم به تولیدکنندگان و عرضه‌کنندگان منطقه آزاد جلفا.",
          },
          {
            icon: "leaf",
            title: "محصولات باکیفیت",
            description: "غذاها، نوشیدنی‌ها، شیرینی‌ها و صنایع‌دستی انتخاب‌شده.",
          },
          {
            icon: "truck",
            title: "ارسال به سراسر کشور",
            description: "تحویل سریع و مطمئن سفارش‌ها در کوتاه‌ترین زمان ممکن.",
          },
        ],
      },
      {
        id: "about-body",
        type: "text",
        title: null,
        body: "در ارس پرو می‌توانید انواع مواد غذایی، نوشیدنی‌ها، شیرینی‌ها و لوازم خانگی را با قیمت مناسب و ارسال به سراسر کشور سفارش دهید. ما همواره تلاش می‌کنیم تجربه خریدی دلنشین، امن و سریع را برای مشتریان خود فراهم کنیم.",
      },
    ],
  },
  {
    slug: "contact",
    title: "تماس با ما",
    metaDescription: "راه‌های ارتباطی با پشتیبانی فروشگاه.",
    blocks: [
      {
        id: "contact-heading",
        type: "heading",
        text: "تماس با ما",
        subtitle:
          "برای پشتیبانی، پیشنهادات و شکایات می‌توانید از طریق راه‌های ارتباطی زیر با ما در تماس باشید.",
        align: "center",
      },
      {
        id: "contact-details",
        type: "feature_cards",
        title: null,
        cards: [
          { icon: "phone", title: "تلفن", description: "۰۴۱-۳۵۵۵۵۵۵۵" },
          { icon: "mail", title: "ایمیل", description: "support@jolfa.local" },
          { icon: "map_pin", title: "آدرس", description: "منطقه آزاد جلفا، بازارچه مرزی جلفا" },
          {
            icon: "clock",
            title: "ساعت پاسخگویی",
            description: "شنبه تا چهارشنبه ۹ صبح تا ۶ بعدازظهر",
          },
        ],
      },
    ],
  },
  {
    slug: "rules",
    title: "قوانین و مقررات",
    metaDescription: "شرایط خرید، ارسال و مرجوعی سفارش‌ها.",
    blocks: [
      {
        id: "rules-heading",
        type: "heading",
        text: "قوانین و مقررات",
        subtitle: "لطفاً پیش از ثبت سفارش، موارد زیر را مطالعه کنید.",
        align: "center",
      },
      {
        id: "rules-list",
        type: "feature_cards",
        title: null,
        cards: [
          {
            icon: "shield",
            title: "اصالت کالا",
            description: "تمامی محصولات عرضه‌شده در ارس پرو اصلی و دارای مجوزهای لازم هستند.",
          },
          {
            icon: "alert",
            title: "قیمت‌ها",
            description: "قیمت‌ها به تومان بوده و ممکن است بدون اطلاع قبلی تغییر کنند.",
          },
          {
            icon: "truck",
            title: "زمان ارسال",
            description: "زمان ارسال سفارشات بسته به مقصد بین ۲ تا ۷ روز کاری است.",
          },
          {
            icon: "refresh",
            title: "مرجوعی",
            description:
              "در صورت مغایرت کالا با سفارش، امکان مرجوعی تا ۷ روز پس از تحویل وجود دارد.",
          },
          {
            icon: "credit_card",
            title: "پرداخت امن",
            description: "پرداخت‌ها از درگاه‌های مطمئن و معتبر داخلی انجام می‌شود.",
          },
        ],
      },
    ],
  },
];
