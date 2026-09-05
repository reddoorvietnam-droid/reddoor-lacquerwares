"use client";

import { useState, type FormEvent } from "react";

import type { PublicDictionary } from "@/lib/i18n/dictionary";

/**
 * The guest order form on a shop item page. One item, a quantity, and the
 * customer's contact details. The hidden `website` field is the honeypot:
 * humans never see it, so a filled value marks a bot.
 */

export type ShopOrderSubmitResult =
  { status: "success"; orderCode: string } | { status: "error"; code: string };

export type ShopOrderFormProps = {
  dictionary: PublicDictionary;
  itemId: string;
  locale: string;
  maxQuantity: number;
  submit: (input: {
    itemId: string;
    locale: string;
    quantity: number;
    website: string;
    customer: {
      fullName: string;
      phone: string;
      email: string;
      address: string;
      note: string;
    };
  }) => Promise<ShopOrderSubmitResult>;
};

const fieldClassName =
  "border-burgundy/18 bg-white text-charcoal placeholder:text-charcoal/40 focus:border-lacquer focus:ring-lacquer/15 min-h-12 w-full rounded-xl border px-4 text-base outline-none focus:ring-2";

export function ShopOrderForm({
  dictionary,
  itemId,
  locale,
  maxQuantity,
  submit,
}: ShopOrderFormProps) {
  const copy = dictionary.shop;
  const [quantity, setQuantity] = useState("1");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ShopOrderSubmitResult | null>(null);

  function errorMessage(code: string): string {
    switch (code) {
      case "SOLD_OUT":
      case "ITEM_NOT_LIVE":
        return copy.errorSoldOut;
      case "INSUFFICIENT_STOCK":
        return copy.errorInsufficientStock;
      case "RATE_LIMITED":
        return copy.errorRateLimited;
      case "INVALID_INPUT":
        return copy.errorInvalid;
      default:
        return copy.errorUnavailable;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const outcome = await submit({
      itemId,
      locale,
      quantity: Number(quantity || "1"),
      website,
      customer: { fullName, phone, email, address, note },
    });
    setPending(false);
    setResult(outcome);
  }

  if (result?.status === "success") {
    return (
      <div
        role="status"
        className="border-gold/45 bg-gold/10 rounded-[var(--radius-lg)] border p-6 sm:p-8"
      >
        <h3 className="text-burgundy font-serif text-2xl">
          {copy.successTitle}
        </h3>
        <p className="text-charcoal/70 mt-3 leading-7">
          {copy.successDescription}
        </p>
        <p className="text-burgundy mt-4 text-sm font-semibold">
          {copy.orderCode}:{" "}
          <span className="font-mono tracking-[0.08em]">
            {result.orderCode}
          </span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-burgundy grid gap-2 text-sm font-semibold">
          <span>{copy.quantity}</span>
          <input
            className={fieldClassName}
            type="number"
            name="quantity"
            min={1}
            max={maxQuantity}
            required
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value.replace(/[^0-9]/g, ""))
            }
          />
        </label>
        <label className="text-burgundy grid gap-2 text-sm font-semibold">
          <span>{copy.fullName}</span>
          <input
            className={fieldClassName}
            type="text"
            name="fullName"
            autoComplete="name"
            required
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
        <label className="text-burgundy grid gap-2 text-sm font-semibold">
          <span>{copy.phone}</span>
          <input
            className={fieldClassName}
            type="tel"
            name="phone"
            autoComplete="tel"
            required
            maxLength={30}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="text-burgundy grid gap-2 text-sm font-semibold">
          <span>{copy.email}</span>
          <input
            className={fieldClassName}
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={200}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      </div>
      <label className="text-burgundy grid gap-2 text-sm font-semibold">
        <span>{copy.address}</span>
        <textarea
          className={`${fieldClassName} min-h-24 py-3`}
          name="address"
          autoComplete="street-address"
          required
          maxLength={500}
          rows={3}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </label>
      <label className="text-burgundy grid gap-2 text-sm font-semibold">
        <span>{copy.note}</span>
        <textarea
          className={`${fieldClassName} min-h-24 py-3`}
          name="note"
          maxLength={2000}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {/* Honeypot: visually and semantically hidden, never autofilled. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>
      <p className="text-charcoal/60 text-sm leading-6">{copy.shippingNote}</p>
      {result?.status === "error" ? (
        <p role="alert" className="text-lacquer text-sm font-semibold">
          {errorMessage(result.code)}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-12 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)] transition-colors disabled:pointer-events-none disabled:opacity-45"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
