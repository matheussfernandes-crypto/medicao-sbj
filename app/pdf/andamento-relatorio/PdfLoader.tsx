"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { DadosAndamento } from "@/app/(app)/andamento-novo/types";
import type { FotoRel, FotosSel } from "@/app/(app)/andamento-novo/relatorio/modelo";

// só no navegador: a configuração do relatório chega por window.__RELATORIO_CFG__ antes da página abrir
const Relatorio = dynamic(() => import("@/app/(app)/andamento-novo/relatorio/RelatorioClient"), { ssr: false });

export default function PdfLoader({ dados, fotos, fotosIniciais }: { dados: DadosAndamento; fotos: FotoRel[]; fotosIniciais: FotosSel }) {
  useEffect(() => {
    if (!(window as any).__RELATORIO_CFG__) document.documentElement.setAttribute("data-erro", "Configuração do relatório não recebida.");
  }, []);
  return <Relatorio dados={dados} salvas={[]} montagensIniciais={[]} fotos={fotos} fotosIniciais={fotosIniciais} modoPdf />;
}
