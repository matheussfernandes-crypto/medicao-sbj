/** @type {import('next').NextConfig} */
const nextConfig = {
  // o módulo Pós-obra (public/pos-obra) abre em /pos-obra/ com barra no fim; o middleware.ts
  // refaz o redirecionamento de barra para o resto do site
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
    // geração do PDF do relatório de andamento no servidor (Chromium sem tela) e PDFs do fechamento
    serverComponentsExternalPackages: ["@react-pdf/renderer", "@sparticuz/chromium", "puppeteer-core"],
    outputFileTracingIncludes: {
      "/api/andamento-novo/relatorio": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
  },
};

module.exports = nextConfig;
