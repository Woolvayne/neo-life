import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "NovaCity: Urban Response",
    template: "%s | NovaCity",
  },
  description:
    "Enter NovaCity, an original browser-based open-world multiplayer roleplay experience with careers, emergency services, vehicles and a living fictional city.",
  applicationName: "NovaCity: Urban Response",
  keywords: ["browser game", "open world", "roleplay", "emergency services", "NovaCity"],
  icons: {
    icon: "/novacity-mark.svg",
    shortcut: "/novacity-mark.svg",
  },
  openGraph: {
    title: "NovaCity: Urban Response",
    description: "Live your life. Answer the call. Play the original open world directly in your browser.",
    type: "website",
    images: [{ url: "/images/novacity-hero.jpg", width: 1536, height: 1024, alt: "The fictional NovaCity skyline" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05070c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#05070c] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
