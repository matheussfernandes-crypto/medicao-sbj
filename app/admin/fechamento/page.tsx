import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { salvarConfigNotificacao, finalizarFechamentoMedicao, finalizarFechamentoVale, excluirFechamento } from "./actions";
import Topbar from "../../components/Topbar";
import ConfirmDeleteButton from "../../lancamentos/ConfirmDeleteButton";

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: { obra?: string; mes?: string; sucesso?: string; erro?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const obraSelecionada = searchParams.obra || obras?.[0]?.id || null;
  const mes = searchParams.mes || mesAtual();

  const { data: config } = await supabase.from("configuracoes_notificacao").select("email_1, email_2").eq("id", 1).single();

  const { data: historico } = await supabase
    .from("fechamentos")
    .select("id, obra_id, tipo, mes_referencia, fechado_em, email_enviado_para, pdf_path")
    .order("fechado_em", { ascending: false })
    .limit(30);

  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  // Gera links assinados (válidos por 1h) para os PDFs que ficaram salvos no Storage.
  const linksPdf: Record<string, string> = {};
  for (const h of historico ?? []) {
    if (h.pdf_path) {
      const { data: signed } = await supabase.storage
        .from("fechamentos-pdfs")
        .createSignedUrl(h.pdf_path, 3600);
      if (signed?.signedUrl) linksPdf[h.id] = signed.signedUrl;
    }
  }

  let previaMedicao: { qtdItens: number; somaPagar: number } | null = null;
  let previaVale: { qtdItens: number; somaGeral: number } | null = null;

  if (obraSelecionada) {
    // A Medição Complementar de um "Vale + Medição" não entra como item na prévia
    // de Medição (ela já é paga junto com o vale, no fechamento de Vale). Mas o
    // valor do vale (valor_vale_hibrido) continua descontando o total a pagar aqui,
    // como qualquer Vale Real, pois é um adiantamento para a próxima medição.
    const { data: medicoes } = await supabase
      .from("lancamentos")
      .select("total_reais, retencao_pct_usado, pessoa_id, vale_real, tipo")
      .eq("obra_id", obraSelecionada).eq("mes_referencia", mes).eq("tipo", "MEDICAO").eq("status", "APROVADO");
    const { data: valesReais } = await supabase
      .from("lancamentos")
      .select("total_reais, valor_vale_hibrido, tipo")
      .eq("obra_id", obraSelecionada).eq("mes_referencia", mes).eq("status", "APROVADO")
      .or("and(tipo.eq.VALE,vale_real.eq.true),tipo.eq.VALE_MEDICAO");

    if (medicoes && medicoes.length) {
      const somaTotal = medicoes.reduce((s, l) => s + Number(l.total_reais), 0);
      const somaRetido = medicoes.reduce((s, l) => s + Number(l.total_reais) * Number(l.retencao_pct_usado ?? 0), 0);
      const somaVale = (valesReais ?? []).reduce(
        (s, l) => s + (l.tipo === "VALE_MEDICAO" ? Number(l.valor_vale_hibrido ?? 0) : Number(l.total_reais)),
        0
      );
      previaMedicao = { qtdItens: medicoes.length, somaPagar: somaTotal - somaRetido - somaVale };
    }

    const { data: vales } = await supabase
      .from("lancamentos")
      .select("total_reais, valor_vale_hibrido, retencao_pct_usado, tipo")
      .eq("obra_id", obraSelecionada).eq("mes_referencia", mes).eq("status", "APROVADO")
      .in("tipo", ["VALE", "VALE_MEDICAO"]);
    if (vales && vales.length) {
      previaVale = {
        qtdItens: vales.length,
        somaGeral: vales.reduce((s, l) => {
          if (l.tipo === "VALE_MEDICAO") {
            const bruto = Number(l.total_reais);
            const liquido = bruto - bruto * Number(l.retencao_pct_usado ?? 0);
            return s + Number(l.valor_vale_hibrido ?? 0) + liquido;
          }
          return s + Number(l.total_reais);
        }, 0),
      };
    }
  }

  return (
    <main className="min-h-screen">
      <Topbar setor="ADMIN" />
      <div className="p-8 space-y-4">
        <h1 className="text-xl font-semibold text-primaryDark">Fechamento mensal — Medição e Vale</h1>
        <p className="text-sm text-gray-500 -mt-2">
          Ao finalizar, o relatório em PDF (com as três assinaturas — Mestre, Estagiário, Engenheiro) é gerado e
          enviado automaticamente por email para os endereços configurados abaixo.
        </p>

        {searchParams.sucesso && (
          <div className="card !p-3 !border-green-200 bg-green-50 text-sm text-green-700">{searchParams.sucesso}</div>
        )}
        {searchParams.erro && (
          <div className="card !p-3 !border-red-200 bg-red-50 text-sm text-red-700">{searchParams.erro}</div>
        )}

        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Emails de notificação (ADM)</h2>
          <p className="text-xs text-gray-400 mb-2">
            Os PDFs de medição e vale fechados são enviados para até 2 emails. Deixe em branco para não enviar.
          </p>
          <form action={salvarConfigNotificacao} className="flex flex-wrap gap-2">
            <input
              name="email1"
              type="email"
              placeholder="Email 1"
              defaultValue={config?.email_1 ?? ""}
              className="border rounded px-2 py-1 flex-1 min-w-[200px]"
            />
            <input
              name="email2"
              type="email"
              placeholder="Email 2 (opcional)"
              defaultValue={config?.email_2 ?? ""}
              className="border rounded px-2 py-1 flex-1 min-w-[200px]"
            />
            <button className="bg-gray-200 rounded px-4 py-2 text-sm">Salvar emails</button>
          </form>
        </div>

        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Selecionar obra e mês</h2>
          <form method="get" className="flex flex-wrap gap-2">
            <select name="obra" defaultValue={obraSelecionada ?? ""} className="border rounded px-3 py-2 flex-1 min-w-[160px]">
              {(obras ?? []).map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
            <input type="month" name="mes" defaultValue={mes} className="border rounded px-3 py-2" />
            <button className="bg-gray-200 rounded px-4 py-2">Ver</button>
          </form>
          {(!obras || obras.length === 0) && <p className="text-sm text-gray-400 mt-2">Nenhuma obra cadastrada ainda.</p>}
        </div>

        {obraSelecionada && (
          <>
            <div className="card">
              <h2 className="font-semibold text-primaryDark mb-2">Fechar medição do mês</h2>
              {previaMedicao ? (
                <>
                  <p className="text-sm mb-3">
                    {previaMedicao.qtdItens} item(ns) aprovado(s) — total a pagar estimado:{" "}
                    <span className="font-semibold">R$ {previaMedicao.somaPagar.toFixed(2)}</span>
                  </p>
                  <form action={finalizarFechamentoMedicao}>
                    <input type="hidden" name="obraId" value={obraSelecionada} />
                    <input type="hidden" name="mes" value={mes} />
                    <button className="bg-primary text-white rounded px-4 py-2">
                      Finalizar medição e enviar PDF por email
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-gray-400">Nenhuma medição aprovada nesse mês/obra ainda.</p>
              )}
            </div>

            <div className="card">
              <h2 className="font-semibold text-primaryDark mb-2">Fechar vale do mês</h2>
              {previaVale ? (
                <>
                  <p className="text-sm mb-3">
                    {previaVale.qtdItens} vale(s) aprovado(s) — total do mês:{" "}
                    <span className="font-semibold">R$ {previaVale.somaGeral.toFixed(2)}</span>
                  </p>
                  <form action={finalizarFechamentoVale}>
                    <input type="hidden" name="obraId" value={obraSelecionada} />
                    <input type="hidden" name="mes" value={mes} />
                    <button className="bg-primary text-white rounded px-4 py-2">
                      Finalizar vale e enviar PDF por email
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-gray-400">Nenhum vale aprovado nesse mês/obra ainda.</p>
              )}
            </div>
          </>
        )}

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-2">Histórico de fechamentos</h2>
          {historico && historico.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="p-1">Obra</th>
                  <th className="p-1">Tipo</th>
                  <th className="p-1">Mês</th>
                  <th className="p-1">Fechado em</th>
                  <th className="p-1">Email enviado para</th>
                  <th className="p-1">PDF</th>
                  <th className="p-1">Ações</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">{nomeObra[h.obra_id] ?? "—"}</td>
                    <td className="p-1">
                      <span className={"badge " + (h.tipo === "MEDICAO" ? "badge-aprovado" : "badge-pendente")}>
                        {h.tipo === "MEDICAO" ? "Medição" : "Vale"}
                      </span>
                    </td>
                    <td className="p-1">{h.mes_referencia}</td>
                    <td className="p-1">{new Date(h.fechado_em).toLocaleString("pt-BR")}</td>
                    <td className="p-1">{h.email_enviado_para || "—"}</td>
                    <td className="p-1">
                      {linksPdf[h.id] ? (
                        <a
                          href={linksPdf[h.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline text-xs"
                        >
                          Baixar PDF
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-1 whitespace-nowrap">
                      <form action={excluirFechamento} className="inline">
                        <input type="hidden" name="id" value={h.id} />
                        <ConfirmDeleteButton mensagemPersonalizada="Excluir este registro do histórico de fechamento? Isso NÃO desfaz o PDF já enviado por email, mas libera esse mês/obra/tipo para ser fechado de novo. Deseja continuar?" />
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Nenhum fechamento realizado ainda.</p>
          )}
        </div>
      </div>
    </main>
  );
}
