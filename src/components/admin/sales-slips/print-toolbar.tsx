"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { Capabilities } from "@/domains/sales-slips/contracts";
import {
  buttonClass,
  ghostButtonClass,
} from "@/components/admin/sample-progress-shared";
import { downloadExport } from "./api";
import { alertClass } from "./shared";

/** Buttons above the print sheet; hidden on paper by `print.css`. */
export function PrintToolbar({
  slipId,
  backHref,
  capabilities,
}: {
  slipId: string;
  backHref: Route;
  capabilities: Pick<Capabilities, "print" | "export">;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const download = async (format: "pdf" | "xlsx") => {
    setError("");
    setBusy(format);
    try {
      await downloadExport(slipId, format);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể xuất file.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="sales-slip-print-toolbar mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className={ghostButtonClass}>
          ← Quay lại phiếu
        </Link>
        <div className="ml-auto flex flex-wrap gap-3">
          {capabilities.print ? (
            <button
              type="button"
              className={buttonClass}
              onClick={() => window.print()}
            >
              In
            </button>
          ) : null}
          {capabilities.export ? (
            <>
              <button
                type="button"
                className={ghostButtonClass}
                disabled={busy !== null}
                onClick={() => void download("pdf")}
              >
                {busy === "pdf" ? "Đang tạo PDF..." : "Xuất PDF"}
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                disabled={busy !== null}
                onClick={() => void download("xlsx")}
              >
                {busy === "xlsx" ? "Đang tạo Excel..." : "Xuất Excel"}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className={alertClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
