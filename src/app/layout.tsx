import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Planazo CMS",
    template: "%s | Planazo CMS",
  },
  description: "Panel interno para generar y publicar contenido de Planazo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
