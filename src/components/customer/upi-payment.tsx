"use client";
/* eslint-disable @next/next/no-img-element -- Merchant QR is a private session-protected image. */
import { useState } from "react";
export function UPIPayment({
  id,
  upiId,
  payee,
  amount,
  hasQR,
}: {
  id: string;
  upiId: string;
  payee: string;
  amount: number;
  hasQR: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const value = (amount / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: upiId,
    pn: payee,
    am: value,
    cu: "INR",
    tn: "GYVFT gift payment",
    tr: id,
  });
  return (
    <div className="my-4 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium">Direct UPI · ₹{value}</p>
      <a
        href={`upi://pay?${params.toString()}`}
        className="mt-3 block rounded-full bg-olive-dark px-4 py-3 text-center text-sm text-white"
      >
        Pay via UPI app
      </a>
      {hasQR && (
        <div className="my-4">
          <img
            src="/api/upi-qr"
            alt="GYVFT receiving account UPI QR"
            className="mx-auto max-h-64 w-52 object-contain"
          />
          <p className="mt-2 text-xs text-muted-text">
            Scan in your UPI app. Check the payee and amount before confirming.
          </p>
        </div>
      )}
      <p className="mt-3 break-all text-sm">{upiId}</p>
      <button
        type="button"
        className="mt-2 text-xs underline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(upiId);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy UPI ID"}
      </button>
      <p className="mt-3 text-xs text-muted-text">
        After payment, upload the screenshot and transaction reference below.
        Allow up to 24 hours for verification. Never share a UPI PIN.
      </p>
    </div>
  );
}
