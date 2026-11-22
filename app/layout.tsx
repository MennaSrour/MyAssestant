import "@fontsource-variable/manrope";
import "@fontsource-variable/cairo";
import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Hayati OS — Your personal workspace",
  description:
    "A personal workspace for habits, study, teaching, and projects.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Hayati OS", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#f7f8fa" };
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
