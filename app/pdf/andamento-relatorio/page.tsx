import { carregarRelatorio } from "@/app/(app)/andamento-novo/relatorio/dadosRelatorio";
import PdfLoader from "./PdfLoader";

export const dynamic = "force-dynamic";

// Página que o servidor abre (num Chromium sem tela) para gerar o PDF do relatório: só as folhas, na configuração recebida.
// Roda com o login de quem pediu (cookies repassados), então as regras de acesso do banco valem como na tela.
export default async function PdfAndamentoRelatorio({ searchParams }: { searchParams: { obra?: string } }) {
  const r = await carregarRelatorio(searchParams.obra);
  if (!r) return <div data-erro-pagina>Obra não encontrada.</div>;
  return <PdfLoader dados={r.dados} fotos={r.fotos} fotosIniciais={r.fotosCfg} />;
}
