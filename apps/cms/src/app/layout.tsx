import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Content CMS",
    template: "%s | Content CMS",
  },
  description: "Panel interno para generar y publicar contenido de la-mira y Planazo.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Content CMS",
  },
  other: {
    // iOS < 17.4 solo respeta el meta prefijado, no el genérico que Next ya
    // emite via appleWebApp — se manda ambos para cubrir versiones viejas.
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#fd690d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${instrumentSans.variable} ${jetBrainsMono.variable}`}>
      <body className="min-h-screen antialiased">
        {/* beforeInteractive: corre antes de hidratar, para no mostrar el
            tema claro un instante y luego saltar a oscuro (flash). */}
        <Script id="theme-init" strategy="beforeInteractive">
          {"try{if(localStorage.getItem('planazo-cms-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}"}
        </Script>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
