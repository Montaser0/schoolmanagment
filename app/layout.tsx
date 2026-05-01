import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import RouteLoadingOverlay from "@/components/route-loading-overlay";
import logo from "@/app/images/logo.png";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "نظام ادارة المدارس",
  description: "نظام ادارة المدارس",
  icons: {
    icon: logo.src,
    shortcut: logo.src,
    apple: logo.src,
  },
};

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={ibmPlexSansArabic.variable}>
      <body className="font-sans antialiased">
        <RouteLoadingOverlay />
        {children}
      </body>
    </html>
  );
}
