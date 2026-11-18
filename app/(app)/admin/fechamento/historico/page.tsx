import Link from "next/link";
import { FileDown } from "lucide-react";
import { redirect } from "next/navigation";
import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import { createClient } from "@/lib/supabase/server";
import TabelaFiltravel from "@/components/ui/TabelaFiltravel";
import { fasesDasObras } from "@/lib/cadastro/fases";

// Histórico completo de fechamentos (medição e vale) de TODAS as obras, inclusive as já concluídas.
// Só leitura: não altera nada. A exclusão de um registro continua na tela de Fechamento.
export const dynamic = "force-dynamic";

export default async function HistoricoFechamentos() {
  const supabase = createClient();
  const user = await getUsuarioAtual();
  const { data: meuPerfil } = await perfilDaRequisicao(user!.id);
  if (meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const [{ data: obras }, { data: hist }, fases] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("fechamentos").select("id, obra_id, tipo, mes_referencia, fechado_em, email_enviado_para, pdf_path").order("fechado_em", { ascending: false }).limit(5000),
    fasesDasObras(supabase),
  ]);
  const nomeObra: Record<string, string> = {};
  (obras ?? []).forEach((o) => (nomeObra[o.id] = o.nome));

  // links assinados dos PDFs (válidos por 1h), todos de uma vez
  const caminhos = (hist ?? []).map((h) => h.pdf_path).filter(Boolean) as string[];
  const linksPorCaminho: Record<string, string> = {};
  for (let i = 0; i < caminhos.length; i += 500) {
    const { data } = await supabase.storage.from("fechamentos-pdfs").createSignedUrls(caminhos.slice(i, i + 500), 3600);
    (data ?? []).forEach((s) => s.path && s.signedUrl && (linksPorCaminho[s.path] = s.signedUrl));
  }

  const rotuloObra = (id: string) => {
    const n = nomeObra[id] ?? "—";
    return fases.porObraGeral.get(id) === "entregue" ? `${n} (concluída)` : n;
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/fechamento" className="text-xs text-primary hover:underline">← Fechamento</Link>
        <h1 className="text-xl font-semibold text-primaryDark">Histórico de fechamentos</h1>
        <p className="text-sm text-ink-500">Todos os fechamentos de medição e vale, de todas as obras, inclusive as concluídas. Use os filtros para achar um mês ou uma obra.</p>
      </div>
      <div className="card">
        {hist && hist.length > 0 ? (
          <TabelaFiltravel
            por={20}
            className="w-full text-sm"
            filtros={[
              { tipo: "busca", chaves: ["obra", "mes"], rotulo: "Buscar", placeholder: "Obra ou mês (ex.: Ibiza, 2026-03)…" },
              { tipo: "selecao", chave: "obra", rotulo: "Obra" },
              { tipo: "selecao", chave: "tipo", rotulo: "Tipo" },
              { tipo: "periodo", chave: "data", rotulo: "Fechado em" },
            ]}
            cabecalho={
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="p-1">Obra</th>
                  <th className="p-1">Tipo</th>
                  <th className="p-1">Mês</th>
                  <th className="p-1">Fechado em</th>
                  <th className="p-1">Email enviado para</th>
                  <th className="p-1">PDF</th>
                </tr>
              </thead>
            }
            itens={(hist ?? []).map((h, i) => ({
              id: String(h.id ?? i),
              d: {
                obra: rotuloObra(h.obra_id),
                tipo: h.tipo === "MEDICAO" ? "Medição" : "Vale",
                mes: String(h.mes_referencia ?? ""),
                data: new Date(h.fechado_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
              },
              linha: (
                <tr key={i} className="border-t">
                  <td className="p-1">{rotuloObra(h.obra_id)}</td>
                  <td className="p-1">
                    <span className={"badge " + (h.tipo === "MEDICAO" ? "badge-aprovado" : "badge-pendente")}>{h.tipo === "MEDICAO" ? "Medição" : "Vale"}</span>
                  </td>
                  <td className="p-1">{h.mes_referencia}</td>
                  <td className="p-1">{new Date(h.fechado_em).toLocaleString("pt-BR")}</td>
                  <td className="p-1">{h.email_enviado_para || "—"}</td>
                  <td className="p-1">
                    {h.pdf_path && linksPorCaminho[h.pdf_path] ? (
                      <a href={linksPorCaminho[h.pdf_path]} target="_blank" rel="noopener noreferrer" className="btn-acao-pdf" title="Baixar PDF" aria-label="Baixar PDF"><FileDown className="w-4 h-4" aria-hidden /></a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ),
            }))}
          />
        ) : (
          <p className="text-sm text-gray-400">Nenhum fechamento realizado ainda.</p>
        )}
      </div>
    </div>
  );
}
