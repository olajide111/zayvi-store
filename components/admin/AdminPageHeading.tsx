import type { ReactNode } from "react";

export const adminAction = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#dbe5dd] bg-white px-3.5 text-sm font-semibold text-[#215241] hover:bg-[#edf4ee] disabled:opacity-50";
export const adminPrimaryAction = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#215241] px-3.5 text-sm font-semibold text-white hover:bg-[#173a2e] disabled:opacity-50";

export default function AdminPageHeading({ section, title, description, children }: {
  section: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-[#dfe6e1] bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-7 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#52635b]">{section}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#172a21] sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#52635b]">{description}</p>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
