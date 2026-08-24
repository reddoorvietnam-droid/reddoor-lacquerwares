import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Red Door — Living Lacquer",
  description:
    "Nền tảng thương hiệu và vận hành sản phẩm sơn mài thủ công của Red Door Vietnam.",
};

export default function RedirectRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
