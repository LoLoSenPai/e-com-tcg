import type { Metadata } from "next";
import { Bungee, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const display = Bungee({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nebula TCG - Boutique cartes Pokemon & One Piece",
  description:
    "Boutique TCG moderne avec produits Pokemon et One Piece, drops reguliers, protections premium et coffrets collectors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${body.variable} ${display.variable} antialiased`}>
        <CartProvider>
          <div className="min-h-screen">
            <SiteHeader />
            {children}
            <SiteFooter />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
