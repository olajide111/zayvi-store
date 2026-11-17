import type { ContentKind } from "./storefront-content";

export type EntrySummary = {
  slug: string;
  kind: ContentKind;
  title: string;
  revision: number;
  draft_changed: boolean;
  published_at: string | null;
};

export const setupPageSlugs = ["contact", "shipping", "returns", "privacy", "terms"] as const;

export async function requestContent<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (response.status === 401) window.location.replace("/admin");
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Content workspace unavailable.");
  return result;
}
