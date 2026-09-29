import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces } from "next/font/google";
import "./globals.css";

const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Bouquet Cipher",
  description: "Type a message, grow a bouquet, and send it to someone. The flowers keep your words secret.",
};

export const viewport: Viewport = {
  themeColor: "#3E4F57",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${hand.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
