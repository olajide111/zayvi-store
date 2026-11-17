"use client";

import { useId, useState, type FormEvent } from "react";
import { fulfilmentCarriers, ownDelivery } from "@/lib/fulfilment-carriers";
import { adminPrimaryAction } from "./AdminPageHeading";

type DispatchDetails = { carrier: string | null; trackingNumber: string | null };

const control = "min-h-11 w-full min-w-0 rounded-lg border border-[#9eafa3] bg-white px-3 text-sm";

export default function DispatchForm({ marketCode, disabled, onDispatch }: {
  marketCode: string;
  disabled: boolean;
  onDispatch: (details: DispatchDetails) => void;
}) {
  const id = useId();
  const [carrier, setCarrier] = useState("");
  const [other, setOther] = useState("");
  const [tracking, setTracking] = useState("");
  const options = fulfilmentCarriers[marketCode] ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onDispatch({
      carrier: (carrier === "other" ? other.trim() : carrier) || null,
      trackingNumber: tracking.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="grid w-full min-w-0 gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={id + "-carrier"} className="mb-1 block text-xs font-semibold">Delivery method</label>
          <select id={id + "-carrier"} value={carrier} onChange={(event) => setCarrier(event.target.value)} className={control} disabled={disabled}>
            <option value="">Choose carrier or method</option>
            {options.map((name) => <option key={name}>{name}</option>)}
            <option>{ownDelivery}</option>
            <option value="other">Other carrier</option>
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={id + "-tracking"} className="mb-1 block text-xs font-semibold">{carrier === ownDelivery ? "Handover reference (optional)" : "Tracking number (optional)"}</label>
          <input id={id + "-tracking"} value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={180} className={control} disabled={disabled} />
        </div>
        {carrier === "other" && (
          <div>
            <label htmlFor={id + "-other"} className="mb-1 block text-xs font-semibold">Carrier name</label>
            <input id={id + "-other"} value={other} onChange={(event) => setOther(event.target.value)} maxLength={120} className={control} disabled={disabled} required />
          </div>
        )}
      </div>
      <div>
        <button type="submit" disabled={disabled || !carrier || (carrier === "other" && !other.trim())} className={adminPrimaryAction}>
          {disabled ? "Saving…" : "Mark dispatched"}
        </button>
      </div>
    </form>
  );
}
