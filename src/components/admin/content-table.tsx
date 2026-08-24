"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import type {
  RevisionWorkflowStatus,
  TranslationStatus,
} from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

export type ContentTableRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  placement: string;
  status: RevisionWorkflowStatus;
  translations: ReadonlyArray<{
    locale: Locale;
    status: TranslationStatus;
  }>;
  updatedAt: string;
  editHref: Route;
};

type ContentTableProps = {
  locale: AdminLocale;
  rows: readonly ContentTableRow[];
};

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, ContentTableRow>();

function statusVariant(
  status: RevisionWorkflowStatus | TranslationStatus,
): "lacquer" | "gold" | "neutral" {
  if (status === "published") return "lacquer";
  if (status === "inReview" || status === "needsUpdate") return "gold";
  return "neutral";
}

export function ContentTable({ locale, rows }: ContentTableProps) {
  const copy = getAdminDictionary(locale);
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    if (!normalizedQuery) return [...rows];

    return rows.filter((row) =>
      [row.code, row.title, row.type, row.placement]
        .join(" ")
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery),
    );
  }, [locale, query, rows]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("title", {
          header: copy.content.columns.entry,
          cell: ({ row }) => (
            <div className="min-w-48">
              <p className="text-burgundy font-semibold">
                {row.original.title}
              </p>
              <p className="text-charcoal/55 mt-1 font-mono text-xs">
                {row.original.code} · {row.original.type}
              </p>
            </div>
          ),
        }),
        columnHelper.accessor("placement", {
          header: copy.content.columns.placement,
          cell: ({ getValue }) => (
            <span className="text-charcoal/75">{getValue()}</span>
          ),
        }),
        columnHelper.accessor("status", {
          header: copy.content.columns.workflow,
          cell: ({ getValue }) => {
            const status = getValue();
            return (
              <Badge variant={statusVariant(status)}>
                {copy.workflow[status]}
              </Badge>
            );
          },
        }),
        columnHelper.display({
          id: "translations",
          header: copy.content.columns.translations,
          cell: ({ row }) => {
            const published = row.original.translations.filter(
              (translation) => translation.status === "published",
            ).length;

            return (
              <div>
                <p className="font-semibold tabular-nums">
                  {published}/{row.original.translations.length}
                </p>
                <p className="text-charcoal/55 mt-1 text-xs">
                  {copy.content.translationProgress}
                </p>
              </div>
            );
          },
        }),
        columnHelper.accessor("updatedAt", {
          header: copy.content.columns.updated,
          cell: ({ getValue }) => (
            <time dateTime={getValue()} className="whitespace-nowrap">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
              }).format(new Date(getValue()))}
            </time>
          ),
        }),
        columnHelper.display({
          id: "action",
          header: copy.content.columns.action,
          cell: ({ row }) => (
            <Link
              href={row.original.editHref}
              className="border-burgundy/20 text-burgundy hover:bg-burgundy hover:text-ivory inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
            >
              {copy.content.edit}
            </Link>
          ),
        }),
      ]),
    [copy, locale],
  );

  const table = useTable({
    features,
    columns,
    data: filteredRows,
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-5">
      <div className="max-w-xl">
        <label
          htmlFor="content-search"
          className="text-burgundy text-sm font-semibold"
        >
          {copy.content.searchLabel}
        </label>
        <input
          id="content-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={copy.content.searchPlaceholder}
          className="border-burgundy/20 placeholder:text-charcoal/40 mt-2 min-h-11 w-full rounded-xl border bg-white px-4 text-sm"
        />
      </div>
      <div className="border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.06)]">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="text-burgundy bg-[#eee5d8] text-[0.68rem] tracking-[0.12em] uppercase">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    scope="col"
                    key={header.id}
                    className="px-5 py-4 font-bold"
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-burgundy/10 divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-[#fbf7f0]">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-5">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 ? (
          <p role="status" className="text-charcoal/60 px-6 py-12 text-center">
            {copy.content.empty}
          </p>
        ) : null}
      </div>
    </div>
  );
}
