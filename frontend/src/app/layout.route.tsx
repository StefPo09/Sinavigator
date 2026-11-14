import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sinavigator",
  description: "Your personal observatory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-space text-[#f4f6f8]">{children}</body>
    </html>
  );
}
