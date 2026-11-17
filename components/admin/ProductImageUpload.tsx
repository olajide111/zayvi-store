"use client";

import { useRef, useState, type FormEvent } from "react";
import { adminAction, adminPrimaryAction } from "./AdminPageHeading";

type UploadResult = { key: string; url: string };

const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const maxImageBytes = 5 * 1024 * 1024;

export default function ProductImageUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setCopyStatus("");
    setUploaded(null);

    if (!supportedTypes.includes(file.type) || file.size < 1 || file.size > maxImageBytes) {
      setError("Choose a JPEG, PNG, WebP or AVIF image up to 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/product-images", { method: "POST", body: form });
      if (response.status === 401) {
        window.location.replace("/admin?next=product-images");
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url || !data?.key) {
        throw new Error([data?.error || "Upload failed. Try again.", data?.diagnostic].filter(Boolean).join(" "));
      }
      setUploaded({ key: data.key, url: data.url });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Image URL copied.");
    } catch {
      setCopyStatus("Copy the image URL from the link above.");
    }
  }

  return (
    <section aria-labelledby="upload-image-title" className="max-w-2xl space-y-4 rounded-xl border border-[#dfe6e1] bg-white p-4 sm:p-6">
      <h2 id="upload-image-title" className="font-semibold">Upload an image</h2>
      <form onSubmit={uploadImage} className="space-y-3">
        <label htmlFor="product-image" className="block text-sm font-medium">Choose product image</label>
        <input
          ref={fileRef}
          id="product-image"
          type="file"
          accept={supportedTypes.join(",")}
          aria-describedby="image-upload-formats"
          disabled={busy}
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); }}
          className="block w-full min-w-0 rounded-lg border border-[#dfe6e1] p-2 text-sm file:mr-3 file:rounded-md file:bg-[#edf4ee] file:px-3 file:py-2 file:font-semibold file:text-[#215241]"
        />
        <p id="image-upload-formats" className="text-xs text-[#52635b]">JPEG, PNG, WebP or AVIF. Up to 5 MB.</p>
        <button disabled={busy || !file} type="submit" className={adminPrimaryAction}>{busy ? "Uploading…" : "Upload image"}</button>
      </form>

      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {uploaded && (
        <div className="space-y-2 rounded-lg bg-[#edf4ee] p-4 text-sm">
          <p role="status" className="font-semibold">Image uploaded</p>
          <a href={uploaded.url} target="_blank" rel="noreferrer" className="block break-all text-[#215241] underline">{uploaded.url}</a>
          <p className="break-all text-xs text-[#52635b]">Storage key <code>{uploaded.key}</code></p>
          <button type="button" onClick={() => void copyUrl(uploaded.url)} className={adminAction}>Copy image URL</button>
          {copyStatus && <p role="status">{copyStatus}</p>}
        </div>
      )}
    </section>
  );
}
