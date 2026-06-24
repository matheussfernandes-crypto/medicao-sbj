import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sistema de Medição de Empreiteiros — SBJ",
  description: "Medição, retenção e aprovação de cadastros para a SBJ Construtora e Incorporadora.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
