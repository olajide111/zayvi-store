/**
 * Zayvi storefront theme contracts.
 *
 * Theme JSON is untrusted tenant input. Validate it at API boundaries and
 * render only registered template/section identifiers. Never evaluate theme
 * values as code or accept arbitrary HTML/CSS/JavaScript.
 */

export const THEME_SCHEMA_VERSION = 1 as const;

export const TEMPLATE_FAMILIES = [
  "editorial",
  "general-commerce",
  "product-specification",
  "grocery",
  "home-furniture",
  "wholesale",
] as const;

export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

export const PALETTE_PRESETS = [
  "warm-neutral",
  "cool-minimal",
  "ink",
  "forest",
  "merchant-custom",
] as const;

export type PalettePreset = (typeof PALETTE_PRESETS)[number];

export const FONT_PRESETS = [
  "editorial-serif",
  "modern-sans",
  "geometric-sans",
] as const;

export type FontPreset = (typeof FONT_PRESETS)[number];

export const STOREFRONT_SECTION_TYPES = [
  "hero",
  "category-navigation",
  "collection-grid",
  "product-grid",
  "editorial-story",
  "brand-story",
  "newsletter",
  "trust-information",
] as const;

export type StorefrontSectionType = (typeof STOREFRONT_SECTION_TYPES)[number];

export type ThemeSection = {
  type: StorefrontSectionType;
  version: 1;
  enabled: boolean;
  settings: Record<string, string | number | boolean | null>;
};

export type StorefrontThemeConfig = {
  schemaVersion: typeof THEME_SCHEMA_VERSION;
  template: {
    family: TemplateFamily;
    version: string;
  };
  brand: {
    displayName: string;
    logoAssetId: string | null;
    faviconAssetId: string | null;
    palette: PalettePreset;
    customColours?: {
      primary?: string;
      accent?: string;
      background?: string;
      text?: string;
    };
    headingFont: FontPreset;
    bodyFont: FontPreset;
  };
  storefront: {
    homeSections: ThemeSection[];
    productLayout: "gallery-details" | "editorial-product" | "specification-led";
    collectionLayout: "product-grid" | "editorial-grid" | "dense-catalogue";
  };
  localisation: {
    defaultMarket: "GB" | "NG";
    enabledMarkets: Array<"GB" | "NG">;
    defaultLocale: "en-GB" | "en-NG";
  };
};

export const DEFAULT_THEME_CONFIG: StorefrontThemeConfig = {
  schemaVersion: THEME_SCHEMA_VERSION,
  template: { family: "editorial", version: "1.0.0" },
  brand: {
    displayName: "Zayvi",
    logoAssetId: null,
    faviconAssetId: null,
    palette: "warm-neutral",
    headingFont: "editorial-serif",
    bodyFont: "modern-sans",
  },
  storefront: {
    homeSections: [
      { type: "hero", version: 1, enabled: true, settings: {} },
      { type: "category-navigation", version: 1, enabled: true, settings: {} },
      { type: "collection-grid", version: 1, enabled: true, settings: {} },
      { type: "editorial-story", version: 1, enabled: true, settings: {} },
      { type: "trust-information", version: 1, enabled: true, settings: {} },
    ],
    productLayout: "gallery-details",
    collectionLayout: "editorial-grid",
  },
  localisation: {
    defaultMarket: "GB",
    enabledMarkets: ["GB"],
    defaultLocale: "en-GB",
  },
};

export type ThemeValidationResult =
  | { ok: true; value: StorefrontThemeConfig }
  | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOneOf = <T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] => typeof value === "string" && values.includes(value);

const isHexColour = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

/**
 * Minimal structural validation for API boundaries. Asset ownership,
 * entitlements, market enablement and section-specific settings require
 * database-backed checks in the service layer.
 */
export function validateStorefrontTheme(input: unknown): ThemeValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["Theme must be an object."] };

  if (input.schemaVersion !== THEME_SCHEMA_VERSION) {
    errors.push("Unsupported theme schema version.");
  }

  const template = isRecord(input.template) ? input.template : null;
  if (!template || !isOneOf(TEMPLATE_FAMILIES, template.family)) {
    errors.push("Unsupported template family.");
  }
  if (!template || typeof template.version !== "string" || !/^\d+\.\d+\.\d+$/.test(template.version)) {
    errors.push("Template version must use semantic version format.");
  }

  const brand = isRecord(input.brand) ? input.brand : null;
  if (!brand || typeof brand.displayName !== "string" || !brand.displayName.trim() || brand.displayName.length > 80) {
    errors.push("Brand display name is required and must be 80 characters or fewer.");
  }
  if (!brand || !isOneOf(PALETTE_PRESETS, brand.palette)) {
    errors.push("Unsupported brand palette.");
  }
  if (!brand || !isOneOf(FONT_PRESETS, brand.headingFont) || !isOneOf(FONT_PRESETS, brand.bodyFont)) {
    errors.push("Unsupported font preset.");
  }
  if (brand?.customColours !== undefined) {
    if (!isRecord(brand.customColours) || Object.values(brand.customColours).some((v) => !isHexColour(v))) {
      errors.push("Custom colours must be six-digit hexadecimal colour values.");
    }
  }
  for (const key of ["logoAssetId", "faviconAssetId"] as const) {
    if (brand && brand[key] !== null && typeof brand[key] !== "string") {
      errors.push(`Brand ${key} must be an asset identifier or null.`);
    }
  }

  const storefront = isRecord(input.storefront) ? input.storefront : null;
  const productLayouts = ["gallery-details", "editorial-product", "specification-led"];
  const collectionLayouts = ["product-grid", "editorial-grid", "dense-catalogue"];
  if (!storefront || !productLayouts.includes(String(storefront.productLayout))) {
    errors.push("Unsupported product layout.");
  }
  if (!storefront || !collectionLayouts.includes(String(storefront.collectionLayout))) {
    errors.push("Unsupported collection layout.");
  }
  if (!storefront || !Array.isArray(storefront.homeSections) || storefront.homeSections.length > 30) {
    errors.push("Homepage must contain no more than 30 configured sections.");
  } else {
    storefront.homeSections.forEach((section, index) => {
      if (!isRecord(section) || !isOneOf(STOREFRONT_SECTION_TYPES, section.type)) {
        errors.push(`Homepage section ${index + 1} has an unsupported type.`);
        return;
      }
      if (section.version !== 1 || typeof section.enabled !== "boolean" || !isRecord(section.settings)) {
        errors.push(`Homepage section ${index + 1} has invalid configuration.`);
      }
      if (isRecord(section.settings) && Object.keys(section.settings).length > 20) {
        errors.push(`Homepage section ${index + 1} has too many settings.`);
      }
    });
  }

  const localisation = isRecord(input.localisation) ? input.localisation : null;
  if (!localisation || !isOneOf(["GB", "NG"] as const, localisation.defaultMarket)) {
    errors.push("Default market must be GB or NG.");
  }
  if (!localisation || !Array.isArray(localisation.enabledMarkets) || localisation.enabledMarkets.length === 0 ||
      localisation.enabledMarkets.some((market) => !isOneOf(["GB", "NG"] as const, market))) {
    errors.push("At least one supported market must be enabled.");
  }
  if (localisation && Array.isArray(localisation.enabledMarkets) &&
      !localisation.enabledMarkets.includes(localisation.defaultMarket)) {
    errors.push("Default market must be included in enabled markets.");
  }
  if (!localisation || !isOneOf(["en-GB", "en-NG"] as const, localisation.defaultLocale)) {
    errors.push("Unsupported default locale.");
  }

  if (errors.length) return { ok: false, errors };

  // All fields are now structurally checked. Keep a defensive cast local to
  // this validator rather than trusting unvalidated request JSON elsewhere.
  return { ok: true, value: input as unknown as StorefrontThemeConfig };
}

export const TEMPLATE_CATALOGUE: Array<{
  family: TemplateFamily;
  name: string;
  description: string;
  recommendedFor: string[];
}> = [
  {
    family: "editorial",
    name: "Editorial",
    description: "Image-led, story-rich shopping for considered brands.",
    recommendedFor: ["Fashion", "Beauty", "Lifestyle", "Curated retail"],
  },
  {
    family: "general-commerce",
    name: "General commerce",
    description: "A flexible, balanced storefront for broad catalogues.",
    recommendedFor: ["Multi-category retailers", "New online stores"],
  },
  {
    family: "product-specification",
    name: "Product and specification",
    description: "Detailed attributes, comparisons and technical discovery.",
    recommendedFor: ["Electronics", "Appliances", "Equipment"],
  },
  {
    family: "grocery",
    name: "Grocery and convenience",
    description: "Fast category navigation and repeat-order journeys.",
    recommendedFor: ["Grocers", "Convenience", "Food retail"],
  },
  {
    family: "home-furniture",
    name: "Home and furniture",
    description: "Lifestyle imagery, dimensions and material-led product detail.",
    recommendedFor: ["Furniture", "Homeware", "Interiors"],
  },
  {
    family: "wholesale",
    name: "Wholesale and B2B",
    description: "Business purchasing journeys and bulk-order presentation.",
    recommendedFor: ["Wholesalers", "Distributors", "Trade suppliers"],
  },
];
