"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parseSocialLinks, socialPlatforms, socialProfiles, type SocialLinks } from "@/lib/social-links";

const endpoint = "/api/admin/social-links";

export default function SocialLinksForm() {
  const [links, setLinks] = useState<SocialLinks | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load social links.");
        setLinks(parseSocialLinks(data.links));
      } catch (error) {
        if (!controller.signal.aborted) setError((error as Error).message);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!links || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: parseSocialLinks(links) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save social links.");
      setLinks(parseSocialLinks(data.links));
      setNotice("Social links saved.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Store social profiles" className="max-w-2xl rounded-2xl border border-[#dfe6e1] bg-white p-5 sm:p-6">
      {links ? (
        <form onSubmit={save}>
          <p className="mb-5 text-sm text-[#52635b]">Leave a field blank to hide that platform. These links appear on every market storefront.</p>
          <fieldset disabled={saving} className="grid gap-4">
            <legend className="sr-only">Social profile URLs</legend>
            {socialPlatforms.map((platform) => (
              <label key={platform} className="grid gap-1.5 text-sm font-medium">
                {socialProfiles[platform].label}
                <input type="url" autoComplete="off" maxLength={2048}
                  className="min-h-11 rounded-lg border border-[#dfe6e1] px-3 font-normal"
                  value={links[platform] ?? ""} placeholder={socialProfiles[platform].example}
                  onChange={(event) => {
                    setLinks({ ...links, [platform]: event.target.value });
                    setNotice("");
                  }} />
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={saving}
            className="mt-5 min-h-11 rounded-lg bg-[#215241] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save social links"}
          </button>
        </form>
      ) : !error && <p role="status" className="text-sm text-[#52635b]">Loading social links…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-[#215241]">{notice}</p>}
    </section>
  );
}
