/**
 * Additional Zayvi storefront directions.
 *
 * These are ADDITIVE. They sit beside, and never modify, the existing template
 * families in `lib/storefront-theme.ts`. Each direction declares which existing
 * family it is built on (`baseFamily`), so the shared validator, entitlements
 * and merchant tooling keep working. Theme JSON is untrusted tenant input:
 * values are checked against the closed lists below and never evaluated.
 *
 * Status: contract only. Nothing here renders a page or is wired into the
 * admin editor, the API or the live store.
 */

import {
  THEME_SCHEMA_VERSION,
  validateStorefrontTheme,
  type StorefrontThemeConfig,
  type TemplateFamily,
} from "./storefront-theme";

export const DIRECTION_FAMILIES = [
  "fashion-showroom",
  "african-editorial",
  "modern-marketplace",
  "atelier-minimal",
  "fresh-market",
  "spec-sheet",
] as const;
export type DirectionFamily = (typeof DIRECTION_FAMILIES)[number];

export const DIRECTION_PRODUCT_LAYOUTS = [
  "rail-focus",
  "image-led-notes",
  "marketplace-buybox",
  "single-piece",
  "stepper-detail",
  "specification-table",
] as const;
export type DirectionProductLayout = (typeof DIRECTION_PRODUCT_LAYOUTS)[number];

export const DIRECTION_COLLECTION_LAYOUTS = [
  "rail-grid",
  "staggered-columns",
  "filter-sidebar-grid",
  "horizontal-strip",
  "aisle-rows",
  "compare-table",
] as const;
export type DirectionCollectionLayout = (typeof DIRECTION_COLLECTION_LAYOUTS)[number];

export const DIRECTION_BAG_LAYOUTS = [
  "side-panel",
  "order-sheet",
  "seller-grouped",
  "drawer",
  "basket-with-slots",
  "quote-list",
] as const;
export type DirectionBagLayout = (typeof DIRECTION_BAG_LAYOUTS)[number];

export const DIRECTION_SECTION_TYPES = [
  // fashion-showroom
  "rail-stage", "room-index", "shopping-panel",
  // african-editorial
  "masthead", "issue-hero", "textile-band", "numbered-feature", "cloth-notes", "pull-quote",
  // modern-marketplace
  "search-header", "department-grid", "promo-tiles", "product-rail", "seller-strip",
  // atelier-minimal
  "full-height-hero", "statement", "collection-strip", "bag-drawer",
  // fresh-market
  "aisle-rail", "stepper-list", "basket-panel", "slot-picker",
  // spec-sheet
  "sizing-helper", "category-tiles", "spec-table", "compare-tray", "quote-list",
  // shared
  "footer-policies",
] as const;
export type DirectionSectionType = (typeof DIRECTION_SECTION_TYPES)[number];

export type DirectionSection = {
  type: DirectionSectionType;
  version: 1;
  enabled: boolean;
  settings: Record<string, string | number | boolean | null>;
};

type DirectionDefinition = {
  family: DirectionFamily;
  name: string;
  description: string;
  recommendedFor: string[];
  /** The existing family this direction extends. */
  baseFamily: TemplateFamily;
  productLayout: DirectionProductLayout;
  collectionLayout: DirectionCollectionLayout;
  bagLayout: DirectionBagLayout;
  allowedSections: DirectionSectionType[];
  defaultSections: DirectionSectionType[];
  /** Fixed token names a merchant may set, with six-digit hex colour values. */
  colourTokens: string[];
  defaultColours: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  /** What the direction needs from the catalogue to look right. */
  requires: string[];
};

export const DIRECTION_CATALOGUE: DirectionDefinition[] = [
  {
    family: "fashion-showroom",
    name: "Runway",
    description: "A full-screen clothing rail with isolated garments, smooth focus transitions and a compact shopping panel.",
    recommendedFor: ["Clothing", "Accessories", "Small curated ranges"],
    baseFamily: "editorial",
    productLayout: "rail-focus",
    collectionLayout: "rail-grid",
    bagLayout: "side-panel",
    allowedSections: ["rail-stage", "room-index", "shopping-panel", "footer-policies"],
    defaultSections: ["rail-stage", "room-index", "shopping-panel"],
    colourTokens: ["floor", "rail", "accent", "text"],
    defaultColours: { floor: "#E4E0D8", rail: "#6D6B65", accent: "#B8330F", text: "#1B1A18" },
    headingFont: "Bricolage Grotesque",
    bodyFont: "Bricolage Grotesque",
    requires: ["Cut-out product images on a transparent background", "Product category as a room"],
  },
  {
    family: "african-editorial",
    name: "Ilé",
    description: "A magazine-style layout with textile-inspired detail, large photography and numbered captions.",
    recommendedFor: ["Fashion", "Textiles", "Homeware", "Craft"],
    baseFamily: "editorial",
    productLayout: "image-led-notes",
    collectionLayout: "staggered-columns",
    bagLayout: "order-sheet",
    allowedSections: ["masthead", "issue-hero", "textile-band", "numbered-feature", "cloth-notes", "pull-quote", "footer-policies"],
    defaultSections: ["masthead", "issue-hero", "textile-band", "numbered-feature", "pull-quote"],
    colourTokens: ["paper", "ink", "accent", "textile1", "textile2"],
    defaultColours: { paper: "#FAF5EC", ink: "#1B1812", accent: "#B04A22", textile1: "#1F2A5A", textile2: "#E7B43C" },
    headingFont: "Fraunces",
    bodyFont: "Instrument Sans",
    requires: ["Art-directed photography", "A short cloth or material note per product", "Maker approval for any community-specific pattern"],
  },
  {
    family: "modern-marketplace",
    name: "Soko",
    description: "A search-first, department-led storefront with a rich catalogue and a bag grouped by seller.",
    recommendedFor: ["Large catalogues", "Multi-seller stores", "Everyday goods"],
    baseFamily: "general-commerce",
    productLayout: "marketplace-buybox",
    collectionLayout: "filter-sidebar-grid",
    bagLayout: "seller-grouped",
    allowedSections: ["search-header", "department-grid", "promo-tiles", "product-rail", "seller-strip", "footer-policies"],
    defaultSections: ["search-header", "promo-tiles", "department-grid", "product-rail", "seller-strip"],
    colourTokens: ["primary", "accent", "surface", "text"],
    defaultColours: { primary: "#0B5D3B", accent: "#F2A900", surface: "#FAFBF8", text: "#1A1A1A" },
    headingFont: "Plus Jakarta Sans",
    bodyFont: "Plus Jakarta Sans",
    requires: ["Departments (taxonomy)", "Seller records (vendor portal)", "Product images, square"],
  },
  {
    family: "atelier-minimal",
    name: "Forma",
    description: "Quiet and spacious. One piece at a time, a sliding collection strip and a bag drawer.",
    recommendedFor: ["Premium fashion", "Accessories", "Small ranges under about 30 pieces"],
    baseFamily: "editorial",
    productLayout: "single-piece",
    collectionLayout: "horizontal-strip",
    bagLayout: "drawer",
    allowedSections: ["full-height-hero", "statement", "collection-strip", "bag-drawer", "footer-policies"],
    defaultSections: ["full-height-hero", "statement", "collection-strip"],
    colourTokens: ["ivory", "ink", "stone"],
    defaultColours: { ivory: "#E6F2F5", ink: "#173C49", stone: "#8EC3CF" },
    headingFont: "Cormorant Garamond",
    bodyFont: "Jost",
    requires: ["Consistent, evenly lit photography (4:5)"],
  },
  {
    family: "fresh-market",
    name: "Oja",
    description: "Built for repeat shopping: an aisle rail, inline quantity steppers and an always-visible basket.",
    recommendedFor: ["Food", "Household goods", "Repeat orders with many small items"],
    baseFamily: "grocery",
    productLayout: "stepper-detail",
    collectionLayout: "aisle-rows",
    bagLayout: "basket-with-slots",
    allowedSections: ["aisle-rail", "stepper-list", "basket-panel", "slot-picker", "footer-policies"],
    defaultSections: ["aisle-rail", "stepper-list", "basket-panel"],
    colourTokens: ["leaf", "accent", "cream", "text"],
    defaultColours: { leaf: "#542B58", accent: "#E9A18C", cream: "#FFF4E8", text: "#39223F" },
    headingFont: "Nunito",
    bodyFont: "Nunito",
    requires: ["Pack size and unit price per product", "Origin and storage notes", "Delivery slots from the shipping engine (build plan item 13)"],
  },
  {
    family: "spec-sheet",
    name: "Volt",
    description: "Built for buying by specification: a sortable table, a compare view and a quote list.",
    recommendedFor: ["Electronics", "Solar and power", "Tools and parts", "Trade buyers"],
    baseFamily: "product-specification",
    productLayout: "specification-table",
    collectionLayout: "compare-table",
    bagLayout: "quote-list",
    allowedSections: ["sizing-helper", "category-tiles", "spec-table", "compare-tray", "quote-list", "footer-policies"],
    defaultSections: ["sizing-helper", "category-tiles", "spec-table", "compare-tray"],
    colourTokens: ["surface", "panel", "accent", "text"],
    defaultColours: { surface: "#0B1424", panel: "#0F1B30", accent: "#3DA5FF", text: "#E6EEF9" },
    headingFont: "IBM Plex Sans",
    bodyFont: "IBM Plex Sans",
    requires: ["Structured spec fields per product", "Datasheet PDFs where they exist", "A quote-request flow for Request a quote"],
  },
];

export type DirectionThemeConfig = Omit<StorefrontThemeConfig, "template" | "storefront"> & {
  template: { family: DirectionFamily; version: string };
  storefront: {
    homeSections: DirectionSection[];
    productLayout: DirectionProductLayout;
    collectionLayout: DirectionCollectionLayout;
    bagLayout: DirectionBagLayout;
  };
  direction: {
    baseFamily: TemplateFamily;
    colours: Record<string, string>;
    /** Respect reduced motion by default; set false only for static previews. */
    motion: boolean;
  };
};

export const getDirection = (family: string): DirectionDefinition | undefined =>
  DIRECTION_CATALOGUE.find((d) => d.family === family);

export function defaultDirectionTheme(family: DirectionFamily): DirectionThemeConfig {
  const d = getDirection(family)!;
  return {
    schemaVersion: THEME_SCHEMA_VERSION,
    template: { family, version: "1.0.0" },
    brand: {
      displayName: "Zayvi",
      logoAssetId: null,
      faviconAssetId: null,
      palette: "merchant-custom",
      customColours: { primary: d.defaultColours[d.colourTokens[0]] },
      headingFont: "modern-sans",
      bodyFont: "modern-sans",
    },
    storefront: {
      homeSections: d.defaultSections.map((type) => ({ type, version: 1, enabled: true, settings: {} })),
      productLayout: d.productLayout,
      collectionLayout: d.collectionLayout,
      bagLayout: d.bagLayout,
    },
    localisation: { defaultMarket: "GB", enabledMarkets: ["GB", "NG"], defaultLocale: "en-GB" },
    direction: { baseFamily: d.baseFamily, colours: { ...d.defaultColours }, motion: true },
  };
}

export type DirectionValidationResult =
  | { ok: true; value: DirectionThemeConfig }
  | { ok: false; errors: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/**
 * Validates a direction theme. The shared fields (brand, localisation, schema
 * version) are checked by the existing validator on a copy whose
 * direction-only fields are swapped for valid base values, so the existing
 * rules apply unchanged. Direction-only fields are then checked here.
 */
export function validateDirectionTheme(input: unknown): DirectionValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["Theme must be an object."] };

  const template = isRecord(input.template) ? input.template : null;
  const def = template ? getDirection(String(template.family)) : undefined;
  if (!def) return { ok: false, errors: ["Unsupported direction family."] };

  const storefront = isRecord(input.storefront) ? input.storefront : null;
  if (!storefront) return { ok: false, errors: ["Storefront configuration is required."] };

  if (storefront.productLayout !== def.productLayout) errors.push("Product layout does not match this direction.");
  if (storefront.collectionLayout !== def.collectionLayout) errors.push("Collection layout does not match this direction.");
  if (storefront.bagLayout !== def.bagLayout) errors.push("Bag layout does not match this direction.");

  if (!Array.isArray(storefront.homeSections) || storefront.homeSections.length > 30) {
    errors.push("Homepage must contain no more than 30 configured sections.");
  } else {
    storefront.homeSections.forEach((s, i) => {
      if (!isRecord(s) || !def.allowedSections.includes(s.type as DirectionSectionType)) {
        errors.push(`Homepage section ${i + 1} is not available in this direction.`);
        return;
      }
      if (s.version !== 1 || typeof s.enabled !== "boolean" || !isRecord(s.settings) || Object.keys(s.settings).length > 20) {
        errors.push(`Homepage section ${i + 1} has invalid configuration.`);
      }
    });
  }

  const direction = isRecord(input.direction) ? input.direction : null;
  if (!direction || direction.baseFamily !== def.baseFamily) errors.push("Base family does not match this direction.");
  if (!direction || typeof direction.motion !== "boolean") errors.push("Motion must be true or false.");
  const colours = direction && isRecord(direction.colours) ? direction.colours : null;
  if (!colours) {
    errors.push("Direction colours are required.");
  } else {
    for (const [k, v] of Object.entries(colours)) {
      if (!def.colourTokens.includes(k)) errors.push(`Unknown colour token: ${k}.`);
      else if (!isHex(v)) errors.push(`Colour ${k} must be a six-digit hexadecimal value.`);
    }
  }

  const shared = validateStorefrontTheme({
    ...input,
    template: { ...template, family: def.baseFamily },
    storefront: { productLayout: "gallery-details", collectionLayout: "product-grid", homeSections: [] },
  });
  if (!shared.ok) errors.push(...shared.errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: input as unknown as DirectionThemeConfig };
}
