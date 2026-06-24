import { Inter, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { cn } from "@/lib/utils";

// The per-request CSP nonce (set in middleware.js) can only be stamped onto a page's
// scripts when that page is server-rendered per request. Force dynamic rendering app-wide
// so no page is statically prerendered without a nonce — otherwise its inline scripts would
// be blocked by the nonce-based script-src. This app is already almost entirely dynamic.
export const dynamic = 'force-dynamic';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} antialiased`}> 
        {children} 
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
