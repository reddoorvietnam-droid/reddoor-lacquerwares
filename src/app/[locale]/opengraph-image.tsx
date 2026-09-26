import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const alt = "Red Door — Ha Thai Lacquerware, Vietnam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The lattice mark from the favicon, so a shared link carries the same
// emblem people see in the browser tab and on the signboard.
const markSrc = `data:image/png;base64,${await readFile(
  join(process.cwd(), "src/app/icon.png"),
  "base64",
)}`;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeValue } = await params;
  const locale = isLocale(localeValue) ? localeValue : defaultLocale;
  const dictionary = await getDictionary(locale);

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#190807",
        color: "#f4e9d2",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: "64px 84px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          border: "2px solid #b67b2c",
          display: "flex",
          // Satori sizes an absolute box from width/height only; `inset`
          // (or four offsets) collapsed this frame into a stray dot.
          top: 36,
          left: 36,
          width: size.width - 72,
          height: size.height - 72,
          position: "absolute",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
      <img
        src={markSrc}
        alt=""
        width={84}
        height={84}
        style={{ borderRadius: 12, marginBottom: 26 }}
      />
      <div
        style={{
          color: "#c79747",
          display: "flex",
          fontSize: 24,
          letterSpacing: "0.3em",
          marginBottom: 24,
        }}
      >
        RED DOOR · HANOI, VIETNAM
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 66,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.08,
          maxWidth: 940,
          textAlign: "center",
        }}
      >
        {dictionary.meta.siteTitle}
      </div>
      <div
        style={{
          color: "#d9c7a7",
          display: "flex",
          fontSize: 24,
          lineHeight: 1.4,
          marginTop: 26,
          maxWidth: 880,
          textAlign: "center",
        }}
      >
        {dictionary.meta.siteDescription}
      </div>
    </div>,
    size,
  );
}
