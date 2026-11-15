import type { Metadata } from "next";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sinavigator · lunar atlas",
  description: "An educational lunar atlas: when the Sun and Earth are visible at the Apollo 15 and 17 sites. A NASA Space Apps 2026 project, not affiliated with NASA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
