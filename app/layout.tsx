import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Outrank Audit | A3 Brands",
  description:
    "Drop your dealership URL. Saggy finds the rooftops outranking you in your trade area — and tells you exactly what it's costing you every month.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Lato:wght@400;700;900&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
