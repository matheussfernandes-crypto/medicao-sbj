import "./globals.css";
import type { Metadata } from "next";
import PushRegistrar from "@/components/PushRegistrar";

export const metadata: Metadata = {
  title: "Medição SBJ",
  description: "Sistema de medição de empreiteiros — SBJ Construtora e Incorporadora.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#2c6975" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Medição SBJ" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
      </head>
      <body>
        <PushRegistrar />
        {children}
      </body>
    </html>
  );
}
