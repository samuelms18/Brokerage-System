import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: { default: "StayNear: student rooms", template: "%s · StayNear" },
  description: "Find verified student rooms near your college.",
  // Shared links show a generic preview only (PV-2): no property details for signed-out users.
  openGraph: { title: "StayNear: student rooms", description: "Log in to view this property." },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0f7668", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
