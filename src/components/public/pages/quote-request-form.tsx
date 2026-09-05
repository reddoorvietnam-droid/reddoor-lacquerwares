"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  quoteRequestDeliveryTerms,
  quoteRequestTypes,
  type QuoteRequestDeliveryTerm,
  type QuoteRequestType,
} from "@/domains/quote-requests/contracts";
import type { PublicDictionary } from "@/lib/i18n/dictionary";

import type { PublicPageLink } from "./shared";

/**
 * The request-for-quotation form on the contact page. Two groups: who is
 * asking, and what they need — catalogue pieces picked from a searchable
 * list (or typed in), quantities, budget, deadline, delivery terms and a
 * free description. The hidden `website` field is the honeypot: humans
 * never see it, so a filled value marks a bot.
 */

export type QuoteRequestSubmitResult =
  | { status: "success"; requestCode: string }
  | { status: "error"; code: string };

export type QuoteRequestProductOption = {
  id: string;
  name: string;
};

export type QuoteRequestFormPayload = {
  locale: string;
  website: string;
  contact: {
    fullName: string;
    company: string;
    email: string;
    phone: string;
    country: string;
  };
  details: {
    requestType: string;
    items: {
      productId: string | null;
      productName: string;
      quantity: number | null;
    }[];
    estimatedQuantity: number | null;
    budget: string;
    deadline: string;
    deliveryTerms: string;
    destination: string;
    message: string;
  };
};

export type QuoteRequestFormProps = {
  dictionary: PublicDictionary;
  locale: string;
  products: readonly QuoteRequestProductOption[];
  /** Product ids to start with selected, e.g. from a product page's button. */
  preselectedProductIds: readonly string[];
  consentDescription: string;
  consentLink: PublicPageLink | null;
  submit: (input: QuoteRequestFormPayload) => Promise<QuoteRequestSubmitResult>;
};

type SelectedItem = {
  key: string;
  productId: string | null;
  name: string;
  quantity: string;
};

const fieldClassName =
  "border-burgundy/18 bg-ivory text-charcoal placeholder:text-charcoal/45 focus:border-lacquer focus:ring-lacquer/15 min-h-12 w-full rounded-[var(--radius-sm)] border px-4 py-3 text-base outline-none focus:ring-2";

const labelClassName = "text-burgundy grid gap-2 text-sm font-semibold";

const MAX_SUGGESTIONS = 8;

function toQuantity(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function QuoteRequestForm({
  dictionary,
  locale,
  products,
  preselectedProductIds,
  consentDescription,
  consentLink,
  submit,
}: QuoteRequestFormProps) {
  const copy = dictionary.contact;

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [requestType, setRequestType] = useState<QuoteRequestType | "">(
    preselectedProductIds.length > 0 ? "existing_products" : "",
  );
  const [items, setItems] = useState<SelectedItem[]>(() =>
    products
      .filter((product) => preselectedProductIds.includes(product.id))
      .map((product) => ({
        key: product.id,
        productId: product.id,
        name: product.name,
        quantity: "",
      })),
  );
  const [search, setSearch] = useState("");
  const [estimatedQuantity, setEstimatedQuantity] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState<
    QuoteRequestDeliveryTerm | ""
  >("");
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<QuoteRequestSubmitResult | null>(null);

  const query = search.trim().toLocaleLowerCase();
  const suggestions = useMemo(() => {
    const selected = new Set(items.map((item) => item.productId));
    return products
      .filter((product) => !selected.has(product.id))
      .filter(
        (product) =>
          query.length === 0 ||
          product.name.toLocaleLowerCase().includes(query),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [items, products, query]);
  const exactMatch = products.some(
    (product) => product.name.trim().toLocaleLowerCase() === query,
  );

  function addProduct(product: QuoteRequestProductOption) {
    setItems((current) => [
      ...current,
      {
        key: product.id,
        productId: product.id,
        name: product.name,
        quantity: "",
      },
    ]);
    setSearch("");
  }

  function addCustomItem() {
    const name = search.trim();
    if (!name) return;
    setItems((current) => [
      ...current,
      { key: `custom-${Date.now()}`, productId: null, name, quantity: "" },
    ]);
    setSearch("");
  }

  function updateQuantity(key: string, value: string) {
    const digits = value.replace(/[^0-9]/g, "");
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, quantity: digits } : item,
      ),
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function errorMessage(code: string): string {
    switch (code) {
      case "INVALID_INPUT":
        return copy.errorInvalid;
      case "RATE_LIMITED":
        return copy.errorRateLimited;
      default:
        return copy.errorUnavailable;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const outcome = await submit({
      locale,
      website,
      contact: { fullName, company, email, phone, country },
      details: {
        requestType,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.name,
          quantity: toQuantity(item.quantity),
        })),
        estimatedQuantity: toQuantity(estimatedQuantity),
        budget,
        deadline,
        deliveryTerms,
        destination,
        message,
      },
    });
    setPending(false);
    setResult(outcome);
  }

  if (result?.status === "success") {
    return (
      <div
        role="status"
        className="border-gold/45 bg-gold/10 mt-8 rounded-[var(--radius-lg)] border p-6 sm:p-8"
      >
        <h3 className="text-burgundy font-serif text-2xl">
          {copy.successTitle}
        </h3>
        <p className="text-charcoal/70 mt-3 leading-7">
          {copy.successDescription}
        </p>
        <p className="text-burgundy mt-4 text-sm font-semibold">
          {copy.requestCode}:{" "}
          <span className="font-mono tracking-[0.08em]">
            {result.requestCode}
          </span>
        </p>
      </div>
    );
  }

  const optionalMark = (
    <span className="text-charcoal/50 ml-1 text-xs font-normal">
      ({copy.optional})
    </span>
  );

  return (
    <form
      className="mt-9 space-y-9"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate={false}
    >
      {/* Who is asking */}
      <fieldset className="space-y-5">
        <legend className="text-gold-ink text-xs font-semibold tracking-[0.18em] uppercase">
          {copy.sectionContact}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClassName}>
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
          <label className={labelClassName}>
            <span>
              {copy.company}
              {optionalMark}
            </span>
            <input
              className={fieldClassName}
              type="text"
              name="company"
              autoComplete="organization"
              maxLength={200}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </label>
          <label className={labelClassName}>
            <span>{copy.email}</span>
            <input
              className={fieldClassName}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={200}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className={labelClassName}>
            <span>
              {copy.phone}
              {optionalMark}
            </span>
            <input
              className={fieldClassName}
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              maxLength={30}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label className={`${labelClassName} sm:col-span-2`}>
            <span>{copy.country}</span>
            <input
              className={fieldClassName}
              type="text"
              name="country"
              autoComplete="country-name"
              required
              maxLength={120}
              placeholder={copy.countryPlaceholder}
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            />
          </label>
        </div>
      </fieldset>

      {/* What they need */}
      <fieldset className="space-y-5">
        <legend className="text-gold-ink text-xs font-semibold tracking-[0.18em] uppercase">
          {copy.sectionRequest}
        </legend>

        <label className={labelClassName}>
          <span>{copy.requestType}</span>
          <select
            className={fieldClassName}
            name="requestType"
            required
            value={requestType}
            onChange={(event) =>
              setRequestType(event.target.value as QuoteRequestType | "")
            }
          >
            <option value="" disabled>
              {copy.requestTypeSelect}
            </option>
            {quoteRequestTypes.map((type) => (
              <option key={type} value={type}>
                {copy.requestTypes[type]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2">
          <span className="text-burgundy text-sm font-semibold">
            {copy.items}
            {optionalMark}
          </span>
          <p className="text-charcoal/60 text-xs leading-5">{copy.itemsHint}</p>
          {items.length > 0 ? (
            <ul className="border-burgundy/12 divide-burgundy/10 bg-ivory divide-y rounded-[var(--radius-sm)] border">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                >
                  <span className="text-charcoal min-w-0 flex-1 text-sm font-medium">
                    {item.name}
                  </span>
                  <label className="text-charcoal/60 flex items-center gap-2 text-xs">
                    {copy.itemQuantity}
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`${copy.itemQuantity}: ${item.name}`}
                      className="border-burgundy/18 text-charcoal focus:border-lacquer h-9 w-20 rounded-[var(--radius-sm)] border bg-white px-2 text-center text-sm outline-none"
                      maxLength={7}
                      value={item.quantity}
                      onChange={(event) =>
                        updateQuantity(item.key, event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-lacquer hover:text-burgundy text-xs font-semibold"
                  >
                    {copy.itemRemove}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            className={fieldClassName}
            type="search"
            name="productSearch"
            autoComplete="off"
            placeholder={copy.itemsSearch}
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const first = suggestions[0];
              if (first && (query.length === 0 || exactMatch))
                addProduct(first);
              else if (query.length > 0) addCustomItem();
            }}
          />
          {suggestions.length > 0 || query.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="border-burgundy/15 hover:border-gold/70 hover:bg-gold/10 text-charcoal rounded-full border px-3 py-1.5 text-xs transition-colors"
                >
                  + {product.name}
                </button>
              ))}
              {query.length > 0 && !exactMatch ? (
                <button
                  type="button"
                  onClick={addCustomItem}
                  className="border-burgundy/25 text-burgundy hover:border-burgundy/50 rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold"
                >
                  {copy.itemsAddCustom}: “{search.trim()}”
                </button>
              ) : null}
              {suggestions.length === 0 && query.length > 0 && exactMatch ? (
                <span className="text-charcoal/55 text-xs">
                  {copy.itemsEmpty}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClassName}>
            <span>
              {copy.estimatedQuantity}
              {optionalMark}
            </span>
            <input
              className={fieldClassName}
              type="text"
              name="estimatedQuantity"
              inputMode="numeric"
              maxLength={8}
              value={estimatedQuantity}
              onChange={(event) =>
                setEstimatedQuantity(event.target.value.replace(/[^0-9]/g, ""))
              }
            />
          </label>
          <label className={labelClassName}>
            <span>
              {copy.budget}
              {optionalMark}
            </span>
            <input
              className={fieldClassName}
              type="text"
              name="budget"
              maxLength={120}
              placeholder={copy.budgetPlaceholder}
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </label>
          <label className={labelClassName}>
            <span>
              {copy.deadline}
              {optionalMark}
            </span>
            <input
              className={fieldClassName}
              type="date"
              name="deadline"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
          <label className={labelClassName}>
            <span>
              {copy.deliveryTerms}
              {optionalMark}
            </span>
            <select
              className={fieldClassName}
              name="deliveryTerms"
              value={deliveryTerms}
              onChange={(event) =>
                setDeliveryTerms(
                  event.target.value as QuoteRequestDeliveryTerm | "",
                )
              }
            >
              <option value="">{copy.deliveryTermsSelect}</option>
              {quoteRequestDeliveryTerms.map((term) => (
                <option key={term} value={term}>
                  {copy.deliveryTermOptions[term]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClassName} sm:col-span-2`}>
            <span>
              {copy.destination}
              {optionalMark}
            </span>
            <input
              className={fieldClassName}
              type="text"
              name="destination"
              maxLength={200}
              placeholder={copy.destinationPlaceholder}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </label>
        </div>

        <label className={labelClassName}>
          <span>{copy.message}</span>
          <textarea
            className={`${fieldClassName} min-h-36 resize-y`}
            name="message"
            rows={6}
            required
            minLength={10}
            maxLength={5000}
            placeholder={copy.messagePlaceholder}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
      </fieldset>

      <label className="text-charcoal/68 flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          name="consent"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="accent-lacquer mt-1 size-4 shrink-0"
        />
        <span>
          {copy.consent} {consentDescription}
          {consentLink ? (
            <>
              {" "}
              <a
                href={consentLink.href}
                className="text-burgundy decoration-gold hover:text-lacquer underline underline-offset-4"
              >
                {consentLink.label}
              </a>
            </>
          ) : null}
        </span>
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
