import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Salary & Income Tax Calculator (FY 2025-26 onward) — India",
  description: "Compare old vs new regime, flexi exemptions, and take-home using current statutory slabs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Script id="itax-theme-init" strategy="beforeInteractive">
          {`(function(){try{var k='itax-theme';var t=localStorage.getItem(k);var d=document.documentElement;if(t==='dark')d.classList.add('dark');else d.classList.remove('dark');}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
