import "./globals.css";
import type { Metadata } from "next";
import PushRegistrar from "@/components/PushRegistrar";

export const metadata: Metadata = {
  title: "Engenharia SBJ",
  description: "Sistema de medição de empreiteiros — SBJ Construtora e Incorporadora.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* animação de entrada da logo SBJ (uma vez por sessão; ?intro na URL força de novo) */}
        <link rel="stylesheet" href="/intro-sbj/intro.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("sbjIntroVisto")&&location.search.indexOf("intro")<0)document.documentElement.classList.add("intro-done")}catch(e){}`,
          }}
        />
        <meta name="theme-color" content="#2c6975" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SBJ" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
      </head>
      <body>
        {/* o script da animação cria e remove o #intro sozinho; o React não mexe dentro desta caixa */}
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: '<div id="intro" aria-label="Carregando"></div>' }} />
        <script src="/intro-sbj/intro-data.js" />
        <script src="/intro-sbj/intro.js" />
        <PushRegistrar />
        {children}
      </body>
    </html>
  );
}
