/** @type {import('next').NextConfig} */
const nextConfig = {
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
