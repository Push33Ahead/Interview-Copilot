import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RouteTransition from "./RouteTransition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interview Copilot",
  description: "AI-Powered Technical Interview Simulator",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2322d3ee' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M19.07 4.93A10 10 0 0 0 6.99 3.34'/><path d='M4.03 14.53A10 10 0 0 0 16.05 20.66'/><path d='M16.92 7.08A5 5 0 0 0 11.05 5.25'/><path d='M8.05 16.48A5 5 0 0 0 13.91 18.25'/><circle cx='12' cy='12' r='2' stroke='%230ea5e9'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col"
      >
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
