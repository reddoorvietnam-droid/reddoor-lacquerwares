import { ImageResponse } from "next/og";

import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const alt = "Red Door Lacquerwares — DEMO";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        padding: "84px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          border: "2px solid #b67b2c",
          display: "flex",
          inset: "36px",
          position: "absolute",
        }}
      />
      <div
        style={{
          color: "#c79747",
          display: "flex",
          fontSize: 26,
          letterSpacing: "0.3em",
          marginBottom: 30,
        }}
      >
        RED DOOR · DEMO
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
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
          fontSize: 28,
          lineHeight: 1.4,
          marginTop: 34,
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
