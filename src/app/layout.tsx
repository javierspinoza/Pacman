import type { Metadata } from "next";
import { Press_Start_2P, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Press_Start_2P({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display-next",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans-next",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-next",
  display: "swap",
});

export const metadata: Metadata = {
  title: "test-demo",
  description: "Un laberinto multijugador elegante sobre LAN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
