import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medição SBJ",
  description: "Sistema de medição de empreiteiros — SBJ Construtora e Incorporadora.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Medição SBJ",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/icon-192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#2c6975" />
      </head>
      <body>{children}</body>
    </html>
  );
}
