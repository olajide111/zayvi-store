export type ContentKind = "page" | "article";
export type ContentMarket = "GB" | "NG";
export type ContentCopy = { title: string; summary?: string; body: string };

export const starterPages: Record<string, ContentCopy> = {
  about: {
    title: "About Zayvi",
    body: "Zayvi Store is preparing its catalogue for the UK and Nigeria. The current storefront is a preview.",
  },
  contact: {
    title: "Contact Zayvi",
    body: "Email hello@zayvi.store. For order help, include your order reference.",
  },
  privacy: {
    title: "Privacy notice",
    body: "Use sample contact and address details when testing the Preview cart. Contact hello@zayvi.store for questions about how Zayvi handles your information.",
  },
  returns: {
    title: "Returns and cancellations",
    body: "Returns and cancellation information for each market will be available before live purchasing opens.",
  },
  shipping: {
    title: "Shipping information",
    body: "Live delivery coverage, charges and estimates will be available before purchasing opens. Fees shown in the Preview cart are examples.",
  },
  faqs: {
    title: "Frequently asked questions",
    body: "Can I place a live order?\n\nThe current storefront saves unpaid test drafts. A Preview draft does not take payment or start a shipment.",
  },
  tracking: {
    title: "Order tracking",
    body: "For help with a shipment, email hello@zayvi.store and include your order reference.",
  },
  affiliate: {
    title: "Affiliate programme",
    body: "For affiliate enquiries, email hello@zayvi.store.",
  },
  terms: {
    title: "Terms of sale",
    body: "Terms for live purchases will be available before checkout opens. Preview draft orders do not take payment or begin fulfilment.",
  },
};

export function contentUrl(market: ContentMarket, slug?: string) {
  const path = slug ? `/read/${encodeURIComponent(slug)}` : "/read";
  return market === "NG" ? path + "?market=NG" : path;
}
