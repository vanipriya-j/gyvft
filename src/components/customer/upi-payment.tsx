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
  const [qrMode, setQrMode] = useState<"request" | "merchant">("request");
  const [qrError, setQrError] = useState(false);
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
        href={qrError ? undefined : `upi://pay?${params.toString()}`}
        aria-disabled={qrError}
        className="mt-3 block rounded-full bg-action px-4 py-3 text-center text-sm text-white"
      >
        Pay via UPI app
      </a>
      <div className="my-4">
        <p className="text-sm font-medium">
          {qrMode === "request"
            ? "Amount-prefilled UPI QR"
            : "Saved merchant QR"}
        </p>
        {hasQR && (
          <div className="my-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="app-button min-h-11"
              aria-pressed={qrMode === "request"}
              onClick={() => {
                setQrMode("request");
                setQrError(false);
              }}
            >
              For this amount
            </button>
            <button
              type="button"
              className="app-button min-h-11"
              aria-pressed={qrMode === "merchant"}
              onClick={() => {
                setQrMode("merchant");
                setQrError(false);
              }}
            >
              Saved merchant QR
            </button>
          </div>
        )}
        {!qrError ? (
          <img
            key={qrMode}
            src={
              qrMode === "request"
                ? `/api/payment-qr/${id}?expected_amount_paise=${amount}`
                : "/api/upi-qr"
            }
            alt={
              qrMode === "request"
                ? `UPI QR for ₹${value} to ${payee}`
                : "GYVFT receiving account UPI QR"
            }
            width={208}
            height={208}
            className="mx-auto h-52 w-52 object-contain"
            onError={() => setQrError(true)}
          />
        ) : (
          <p className="text-sm" role="status">
            The payment QR is unavailable or the amount has changed. Refresh
            this page before paying.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-text">
          {qrMode === "request"
            ? "The amount is prefilled."
            : "Enter the amount shown above after scanning."}{" "}
          Check the payee and amount in your UPI app before confirming.
        </p>
      </div>
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
