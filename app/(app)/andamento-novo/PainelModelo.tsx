"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as acoes from "./actions";
import type { AplicacaoModelo, DadosConfig, OpcoesModelo, ResultadoAplicacao, ResumoAplicacao, ResumoModelo } from "./types";

const btn = "text-xs px-2.5 py-1.5 border border-border rounded-md bg-white hover:bg-surface-subtle disabled:opacity-50";
const btnPri = "text-xs px-3 py-1.5 rounded-md bg-primary text-white font-medium disabled:opacity-50";
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// texto da prévia/resultado de uma obra
export function descreverResumo(r: ResumoAplicacao, op: OpcoesModelo): string[] {
  const p: string[] = [];
  if (r.servicos_novos) p.push(`+${pl(r.servicos_novos, "serviço", "serviços")}`);
  if (r.servicos_restaurados) p.push(`${pl(r.servicos_restaurados, "serviço do modelo volta", "serviços do modelo voltam")} a aparecer`);
  if (r.ordem_alterada) p.push(`ordem de ${pl(r.ordem_alterada, "serviço alterada", "serviços alterada")}`.replace("serviços alterada", "serviços alterada"));
  if (r.fatias_atualizadas) p.push(`fatias atualizadas (${r.fatias_atualizadas})`);
  if (r.servicos_arquivados) p.push(`${pl(r.servicos_arquivados, "serviço sem status que o modelo não tem sai", "serviços sem status que o modelo não tem saem")}`);
  if (r.fora_do_modelo)
    p.push(
      `${pl(r.fora_do_modelo, "serviço com status que não está no modelo (fica mantido, fatia 0%)", "serviços com status que não estão no modelo (ficam mantidos, fatia 0%)")}: ${r.fora_lista
        .slice(0, 5)
        .map((x) => x.nome)
        .join(", ")}${r.fora_lista.length > 5 ? "…" : ""}`
    );
  if (r.sistemas_criados) p.push(`${pl(r.sistemas_criados, "sistema novo", "sistemas novos")}`);
  if (r.itens_criados) p.push(`+${pl(r.itens_criados, "item de sistema", "itens de sistemas")}`);
  if (r.itens_removidos) p.push(`-${pl(r.itens_removidos, "item de sistema", "itens de sistemas")} (sem status)`);
  if (r.itens_bloqueados) p.push(`${pl(r.itens_bloqueados, "item não é removido", "itens não são removidos")} por já ter${r.itens_bloqueados === 1 ? "" : "m"} status`);
  if (r.trechos_antes !== r.trechos_depois && r.trechos_antes) p.push(`trechos da fachada: ${r.trechos_antes} → ${r.trechos_depois}`);
  if (r.descidas_mantidas_por_status) p.push(`${pl(r.descidas_mantidas_por_status, "descida mantida", "descidas mantidas")} por já ter${r.descidas_mantidas_por_status === 1 ? "" : "m"} status`);
  if (op.pavimentos) {
    if (r.substituicao === "feita") p.push("estrutura de pavimentos substituída pela do modelo");
    else if (r.substituicao === "bloqueada") p.push("não foi possível substituir a estrutura de pavimentos: a obra tem status lançado");
    if (r.pavimentos_criados || r.locais_criados || r.locais_recategorizados)
      p.push(`pavimentos: +${pl(r.pavimentos_criados, "pavimento", "pavimentos")}, +${pl(r.locais_criados, "local", "locais")}${r.locais_recategorizados ? `, ${pl(r.locais_recategorizados, "local com categoria ajustada", "locais com categoria ajustada")}` : ""}`);
    else p.push("pavimentos já combinam com o modelo");
    if (r.locais_pulados) p.push(`${pl(r.locais_pulados, "local ignorado", "locais ignorados")} (categoria não existe na obra)`);
  } else p.push("pavimentos não alterados");
  return p;
}

// ============================================================================
// Janela "Aplicar o modelo padrão a outras obras"
function AplicarModeloModal({ dados, somenteObra, onFechar }: { dados: DadosConfig; somenteObra?: string; onFechar: () => void }) {
  const router = useRouter();
  const versao = dados.versoes[0];
  const origem = dados.modelo.origem_id ?? null;
  const [sel, setSel] = useState<Set<string>>(() => new Set(somenteObra ? [somenteObra] : dados.obras.filter((o) => o.id !== origem).map((o) => o.id)));
  const [op, setOp] = useState<OpcoesModelo>({ categorias: true, fatias: true, sist_servicos: true, sist_itens: true, pavimentos: false, substituir: false });
  const [previa, setPrevia] = useState<ResultadoAplicacao | null>(null);
  const [res, setRes] = useState<ResultadoAplicacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const info = useMemo(() => new Map(dados.infoObras.map((i) => [i.obra_id, i])), [dados.infoObras]);
  const comStatus = dados.obras.filter((o) => sel.has(o.id) && (info.get(o.id)?.status ?? 0) > 0);
  const substituirBloqueado = comStatus.length > 0;

  const mudou = () => {
    setPrevia(null);
    setConfirmando(false);
  };
  const alternarObra = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
    mudou();
  };
  const defOp = (k: keyof OpcoesModelo, v: boolean) => {
    const n = { ...op, [k]: v };
    if (k === "pavimentos" && !v) n.substituir = false;
    setOp(n);
    mudou();
  };
  async function rodar(simular: boolean) {
    setErro(null);
    setCarregando(true);
    try {
      const r = await acoes.aplicarModelo(versao.id, Array.from(sel), op, simular);
      if (simular) setPrevia(r);
      else {
        setRes(r);
        router.refresh();
      }
    } catch (e: any) {
      setErro(e.message ?? "Erro.");
    } finally {
      setCarregando(false);
      setConfirmando(false);
    }
  }

  const caixa = (k: keyof OpcoesModelo, titulo: string, extra?: React.ReactNode, desabilitada?: boolean) => (
    <label className={`flex items-start gap-2 text-sm ${desabilitada ? "opacity-60" : ""}`}>
      <input type="checkbox" className="mt-0.5" checked={op[k]} disabled={desabilitada} onChange={(e) => defOp(k, e.target.checked)} />
      <span>
        {titulo}
        {extra}
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-6 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="font-semibold text-primaryDark text-lg">{somenteObra ? "Atualizar esta obra com o Modelo padrão" : "Aplicar o Modelo padrão a outras obras"}</h2>
            <p className="text-xs text-ink-500">
              Versão {versao.numero} do modelo · salva em {dataHora(versao.criado_em)} {versao.criado_por_nome ? `por ${versao.criado_por_nome}` : ""} a partir de {versao.obra_origem_nome ?? "—"}. Nenhum status lançado é apagado.
            </p>
          </div>
          <button className={btn} onClick={onFechar}>
            Fechar
          </button>
        </div>

        {res ? (
          <div className="space-y-3">
            <p className="font-semibold text-primaryDark">Modelo aplicado.</p>
            {res.obras.map((o) => (
              <div key={o.obra_id} className="border border-border rounded-lg p-3 text-sm">
                <b>{o.obra_nome}</b>
                {o.erro ? <p className="text-danger">{o.erro}</p> : <ul className="list-disc ml-5 text-ink-700">{descreverResumo(o.resumo!, op).map((t, i) => <li key={i}>{t}</li>)}</ul>}
              </div>
            ))}
            <p className="text-xs text-ink-500">Cada aplicação ficou registrada no Histórico do modelo, com o botão "Desfazer" (disponível por 30 dias).</p>
            <button className={btnPri} onClick={onFechar}>
              Pronto
            </button>
          </div>
        ) : (
          <>
            {!somenteObra && (
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-sm font-semibold">Quais obras</h3>
                  <button className="text-xs underline text-primary" onClick={() => { setSel(new Set(dados.obras.filter((o) => o.id !== origem).map((o) => o.id))); mudou(); }}>
                    Marcar todas
                  </button>
                  <button className="text-xs underline text-primary" onClick={() => { setSel(new Set()); mudou(); }}>
                    Desmarcar
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                  {dados.obras.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={sel.has(o.id)} onChange={() => alternarObra(o.id)} />
                      <span>
                        {o.nome}
                        {o.id === origem && <span className="text-xs text-ink-500"> (gerou o modelo)</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-1">O que aplicar</h3>
              <div className="space-y-1.5">
                {caixa("categorias", "Categorias e serviços (incluindo ordem e fases)")}
                {caixa("fatias", "Fatias da obra")}
                {caixa("sist_servicos", "Sistemas: serviços, fases e pesos")}
                {caixa("sist_itens", "Sistemas: quantidade de itens e descidas da fachada")}
                {caixa(
                  "pavimentos",
                  "Pavimentos e locais",
                  <span className="block text-xs text-ink-500">Obra sem pavimentos recebe a estrutura inteira; obra que já tem recebe só o que combina pelo nome. Nada é apagado.</span>
                )}
                <div className="ml-6">
                  {caixa(
                    "substituir",
                    "Substituir toda a estrutura de pavimentos",
                    <span className="block text-xs text-ink-500">
                      {substituirBloqueado
                        ? `Desativado: ${comStatus.map((o) => o.nome).join(", ")} ${comStatus.length === 1 ? "tem" : "têm"} status lançado.`
                        : !op.pavimentos
                          ? "Marque \"Pavimentos e locais\" para usar. Só vale para obra sem nenhum status lançado."
                          : "Apaga os pavimentos e locais atuais da obra (que não têm status) e copia os do modelo."}
                    </span>,
                    substituirBloqueado || !op.pavimentos
                  )}
                </div>
              </div>
            </div>

            {previa && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Prévia (nada foi gravado ainda)</h3>
                {previa.obras.map((o) => (
                  <div key={o.obra_id} className="border border-border rounded-lg p-3 text-sm">
                    <b>{o.obra_nome}</b>
                    {o.erro ? <p className="text-danger">{o.erro}</p> : <p className="text-ink-700">{descreverResumo(o.resumo!, op).join(" · ")}.</p>}
                  </div>
                ))}
              </div>
            )}
            {erro && <p className="text-danger text-sm">{erro}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button className={btn} disabled={carregando || sel.size === 0} onClick={() => rodar(true)}>
                {carregando && !previa ? "Calculando…" : "Ver prévia"}
              </button>
              {!confirmando ? (
                <button className={btnPri} disabled={carregando || !previa || sel.size === 0} onClick={() => setConfirmando(true)} title={previa ? "" : "Veja a prévia antes de aplicar"}>
                  Aplicar
                </button>
              ) : (
                <>
                  <span className="text-sm text-danger">Aplicar o modelo em {pl(sel.size, "obra", "obras")}?</span>
                  <button className="px-3 py-1.5 bg-danger text-white rounded-md text-xs font-semibold disabled:opacity-50" disabled={carregando} onClick={() => rodar(false)}>
                    {carregando ? "Aplicando…" : "Confirmar"}
                  </button>
                  <button className={btn} onClick={() => setConfirmando(false)}>
                    Cancelar
                  </button>
                </>
              )}
              {!previa && <span className="text-xs text-ink-500">Veja a prévia antes de aplicar.</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Painel do Modelo padrão no topo da obra: situação, salvar, aplicar e histórico
export default function PainelModelo({ dados }: { dados: DadosConfig }) {
  const router = useRouter();
  const { obra, modelo, versoes, aplicacoes } = dados;
  const [modal, setModal] = useState<null | "todas" | "esta">(null);
  const [verDif, setVerDif] = useState(false);
  const [verHist, setVerHist] = useState(false);
  const [salvar, setSalvar] = useState<null | { resumo: ResumoModelo | null }>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(fn: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await fn();
      router.refresh();
    } catch (e: any) {
      setErro(e.message ?? "Erro.");
    } finally {
      setOcupado(false);
    }
  }
  async function abrirSalvar() {
    setErro(null);
    setSalvar({ resumo: null });
    try {
      setSalvar({ resumo: await acoes.resumoModelo(obra.id) });
    } catch (e: any) {
      setErro(e.message ?? "Erro.");
      setSalvar(null);
    }
  }

  const extras = modelo.extras ?? [];
  const faltando = modelo.faltando ?? [];
  const partes: string[] = [];
  if (extras.length) partes.push(`${extras.length} ${extras.length === 1 ? "serviço que o modelo não tem" : "serviços que o modelo não tem"}`);
  if (faltando.length) partes.push(`${faltando.length} ${faltando.length === 1 ? "serviço do modelo que a obra não tem" : "serviços do modelo que a obra não tem"}`);
  if ((modelo.fatias_diferentes ?? 0) > 0) partes.push("fatias diferentes");
  if ((modelo.ordem_ou_nome_diferente ?? 0) > 0) partes.push("ordem ou nomes diferentes");
  const ehOrigem = modelo.origem_id === obra.id;

  return (
    <div className="card space-y-2 text-sm print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-primaryDark">Modelo padrão</h2>
        {!modelo.tem_modelo ? (
          <span className="text-ink-500">Ainda não há modelo salvo. Abra a obra de referência (ex.: Ilha de Capri) e salve-a como modelo padrão.</span>
        ) : modelo.igual ? (
          <span className="text-ink-700">
            Esta obra segue o Modelo padrão (versão de {dataBR(modelo.versao_em!)}){ehOrigem ? " — é a obra que gerou o modelo" : ""}.
          </span>
        ) : (
          <span className="text-ink-700">
            <b className="text-primaryDark">Esta obra está diferente do Modelo padrão</b> (versão de {dataBR(modelo.versao_em!)}): {partes.join(", ")}.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} disabled={ocupado} onClick={abrirSalvar}>
          Salvar esta obra como modelo padrão
        </button>
        <button className={btn} disabled={ocupado || !modelo.tem_modelo} onClick={() => setModal("todas")}>
          Aplicar o modelo padrão a outras obras
        </button>
        {modelo.tem_modelo && !modelo.igual && (
          <>
            <button className={btn} onClick={() => setVerDif((v) => !v)}>
              {verDif ? "Esconder diferenças" : "Ver diferenças"}
            </button>
            <button className={btnPri} disabled={ocupado} onClick={() => setModal("esta")}>
              Atualizar esta obra com o modelo
            </button>
          </>
        )}
        <button className={`${btn} ml-auto`} onClick={() => setVerHist((v) => !v)}>
          {verHist ? "Fechar histórico do modelo" : "Histórico do modelo"}
        </button>
      </div>
      {erro && <p className="text-danger">{erro}</p>}

      {salvar && (
        <div className="border border-border rounded-lg p-3 bg-surface-subtle space-y-2">
          <p className="font-semibold">O que vai entrar no Modelo padrão (a partir de {obra.nome})</p>
          {!salvar.resumo ? (
            <p className="text-ink-500">Calculando…</p>
          ) : (
            <ul className="list-disc ml-5 text-ink-700">
              <li>
                {salvar.resumo.categorias} categorias, {salvar.resumo.fases} fases e {salvar.resumo.servicos} serviços (com a ordem, as fases e as fatias: serviços somam {String(salvar.resumo.fatia_servicos).replace(".", ",")}%)
              </li>
              <li>
                Sistemas: {salvar.resumo.sistemas.map((s) => `${s.nome} (${String(s.fatia).replace(".", ",")}%${s.tipo === "fachada" ? `, ${s.descidas} descidas` : `, ${s.itens} ${s.itens === 1 ? "item" : "itens"}`})`).join("; ") || "nenhum"}
              </li>
              <li>
                Pavimentos: {salvar.resumo.pavimentos} pavimentos com {salvar.resumo.locais} locais (e a categoria de cada local)
              </li>
            </ul>
          )}
          <p className="text-xs text-ink-500">Fica guardada a data e quem salvou; as versões anteriores continuam no histórico e dá para voltar a uma delas. As obras só mudam quando o modelo for aplicado.</p>
          <div className="flex gap-2">
            <button
              className={btnPri}
              disabled={ocupado || !salvar.resumo}
              onClick={() =>
                executar(async () => {
                  await acoes.salvarModeloCompleto(obra.id);
                  setSalvar(null);
                })
              }
            >
              Confirmar e salvar
            </button>
            <button className={btn} onClick={() => setSalvar(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {verDif && modelo.tem_modelo && !modelo.igual && (
        <div className="border border-border rounded-lg p-3 space-y-2">
          {extras.length > 0 && (
            <div>
              <p className="font-semibold">Serviços que a obra tem e o modelo não tem ({extras.length})</p>
              <ul className="list-disc ml-5 text-ink-700">
                {extras.map((e) => (
                  <li key={e.id}>
                    {e.nome} {e.status > 0 ? <span className="text-xs text-ink-500">— {pl(e.status, "status lançado", "status lançados")}; fica na obra como "fora do modelo", com fatia 0%</span> : <span className="text-xs text-ink-500">— sem status</span>}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 mt-2">
                <button className={btn} disabled={ocupado} onClick={() => executar(() => acoes.incluirNoModelo(obra.id, extras.map((e) => e.id)))}>
                  Incluir esses serviços no modelo padrão
                </button>
                <button className={btn} disabled={ocupado} onClick={() => executar(() => acoes.manterSoNestaObra(obra.id, extras.map((e) => e.id)))}>
                  Manter só nesta obra
                </button>
              </div>
            </div>
          )}
          {faltando.length > 0 && (
            <div>
              <p className="font-semibold">Serviços do modelo que a obra não tem ({faltando.length})</p>
              <p className="text-ink-700">{faltando.join(", ")}</p>
            </div>
          )}
          {(modelo.fatias_diferentes ?? 0) > 0 && <p className="text-ink-700">{pl(modelo.fatias_diferentes!, "fatia diferente", "fatias diferentes")} da do modelo.</p>}
          {(modelo.ordem_ou_nome_diferente ?? 0) > 0 && <p className="text-ink-700">{pl(modelo.ordem_ou_nome_diferente!, "serviço com ordem ou nome diferente", "serviços com ordem ou nome diferentes")}.</p>}
        </div>
      )}

      {verHist && <HistoricoModelo versoes={versoes} aplicacoes={aplicacoes} ocupado={ocupado} executar={executar} />}

      {modal && <AplicarModeloModal dados={dados} somenteObra={modal === "esta" ? obra.id : undefined} onFechar={() => setModal(null)} />}
    </div>
  );
}

function HistoricoModelo({ versoes, aplicacoes, ocupado, executar }: { versoes: DadosConfig["versoes"]; aplicacoes: AplicacaoModelo[]; ocupado: boolean; executar: (fn: () => Promise<unknown>) => void }) {
  // só a aplicação mais recente de cada obra (e não desfeita) pode ser desfeita
  const maisRecente = new Map<string, string>();
  aplicacoes.forEach((a) => {
    if (!a.desfeita_em && !maisRecente.has(a.obra_id)) maisRecente.set(a.obra_id, a.id);
  });
  const trinta = Date.now() - 30 * 24 * 3600 * 1000;
  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <div>
        <p className="font-semibold mb-1">Versões do modelo</p>
        {versoes.length === 0 ? (
          <p className="text-ink-500">Nenhuma versão salva ainda.</p>
        ) : (
          <ul className="space-y-1">
            {versoes.map((v, i) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span>
                  <b>Versão {v.numero}</b>
                  {i === 0 && <span className="text-xs text-success"> (atual)</span>} · {dataHora(v.criado_em)} · {v.criado_por_nome ?? "—"} · de {v.obra_origem_nome ?? "—"} · {v.resumo?.servicos ?? "?"} serviços, {v.resumo?.pavimentos ?? "?"} pavimentos
                </span>
                {i > 0 && (
                  <button className={btn} disabled={ocupado} onClick={() => executar(() => acoes.restaurarVersaoModelo(v.id))}>
                    Voltar para esta versão
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-semibold mb-1">Aplicações do modelo nas obras</p>
        {aplicacoes.length === 0 ? (
          <p className="text-ink-500">Nenhuma aplicação registrada.</p>
        ) : (
          <ul className="space-y-1.5">
            {aplicacoes.map((a) => {
              const pode = !a.desfeita_em && maisRecente.get(a.obra_id) === a.id && new Date(a.criado_em).getTime() > trinta;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span className={a.desfeita_em ? "text-ink-400 line-through" : ""}>
                    {dataHora(a.criado_em)} · <b>{a.obra_nome}</b> · versão {a.versao_numero ?? "?"} · por {a.por_nome ?? "—"} · {descreverResumo(a.resumo, a.opcoes).slice(0, 3).join(" · ")}
                  </span>
                  {a.desfeita_em ? (
                    <span className="text-xs text-ink-500">desfeita em {dataHora(a.desfeita_em)}</span>
                  ) : (
                    <button className={btn} disabled={ocupado || !pode} title={pode ? "" : "Só a aplicação mais recente da obra, em até 30 dias"} onClick={() => confirm(`Desfazer a aplicação do modelo em ${a.obra_nome}? A obra volta ao que era antes.`) && executar(() => acoes.desfazerAplicacao(a.id))}>
                      Desfazer
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
