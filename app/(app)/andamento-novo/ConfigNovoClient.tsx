"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronUp, Copy, Lock, LockOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import * as acoes from "./actions";
import {
  gerarEstrutura,
  previaEstrutura,
  type Categoria,
  type DadosConfig,
  type Fase,
  type ParamsObraNova,
  type Servico,
} from "./types";

// ---------- peças pequenas ----------

function Texto({ valor, onSalvar, className = "" }: { valor: string; onSalvar: (v: string) => void; className?: string }) {
  const [rascunho, setRascunho] = useState(valor);
  useEffect(() => setRascunho(valor), [valor]);
  return (
    <input
      value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        const v = rascunho.trim();
        if (v && v !== valor) onSalvar(v);
        else setRascunho(valor);
      }}
      onKeyDown={(e) => {
        const el = e.target as HTMLInputElement;
        if (e.key === "Enter") el.blur();
        if (e.key === "Escape") {
          setRascunho(valor);
          el.blur();
        }
      }}
      className={`bg-transparent outline-none border-b border-transparent hover:border-border focus:border-primary ${className}`}
    />
  );
}

function Secao({
  titulo,
  resumo,
  aberta,
  onAlternar,
  acoes,
  children,
}: {
  titulo: string;
  resumo?: string;
  aberta: boolean;
  onAlternar: () => void;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onAlternar} className="flex items-center gap-2 flex-1 text-left">
          {aberta ? <ChevronDown className="w-4 h-4 text-ink-400" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
          <h2 className="font-semibold text-primaryDark">{titulo}</h2>
          {!aberta && resumo && <span className="text-xs text-ink-500 truncate">{resumo}</span>}
        </button>
        {aberta && acoes}
      </div>
      {aberta && <div className="mt-3">{children}</div>}
    </div>
  );
}

const btn = "text-xs px-2.5 py-1.5 border border-border rounded-md bg-white hover:bg-surface-subtle disabled:opacity-50";
const btnPri = "text-xs px-3 py-1.5 rounded-md bg-primary text-white font-medium disabled:opacity-50";
const fmt = (v: number) => v.toFixed(1).replace(".", ",");

type Confirmacao = { texto: string; destinos?: Categoria[]; onConfirmar: (destino: string | null) => void } | null;

export default function ConfigNovoClient({ dados }: { dados: DadosConfig }) {
  const router = useRouter();
  const { obra, obras, fases, categorias, servicos, vinculos, pavimentos, locais, sistemas, itens, percentuais, contagens } = dados;

  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [destino, setDestino] = useState<string>("");
  const [aberta, setAberta] = useState({ obra: true, matriz: false, pesos: true, pavs: true, sis: true });
  const alternar = (k: keyof typeof aberta) => setAberta((a) => ({ ...a, [k]: !a[k] }));
  const [novaObraAberta, setNovaObraAberta] = useState(false);

  async function exec(fn: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await fn();
      router.refresh();
    } catch (e: any) {
      setErro(e.message ?? "Erro ao salvar.");
    } finally {
      setOcupado(false);
    }
  }

  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const vinc = useMemo(() => new Map(vinculos.map((v) => [v.categoria_id + "|" + v.servico_id, v])), [vinculos]);
  const pctPav = useMemo(() => new Map(percentuais.filter((p) => p.nivel === "pavimento").map((p) => [p.ref_id, p.pct])), [percentuais]);
  const pctSis = useMemo(() => new Map(percentuais.filter((p) => p.nivel === "sistema").map((p) => [p.ref_id, p.pct])), [percentuais]);
  const pctObra = percentuais.find((p) => p.nivel === "obra")?.pct ?? 0;
  const faseDe = useMemo(() => new Map(fases.map((f) => [f.id, f])), [fases]);
  const locaisPorCat = useMemo(() => {
    const m = new Map<string, number>();
    [...locais, ...itens].forEach((l) => m.set(l.categoria_id, (m.get(l.categoria_id) ?? 0) + 1));
    return m;
  }, [locais, itens]);

  if (categorias.length === 0) {
    return (
      <div className="card text-sm space-y-3">
        <p>Esta obra ainda não tem categorias e serviços no modelo novo.</p>
        <button className={btnPri} disabled={ocupado} onClick={() => exec(() => acoes.prepararObra(obra.id))}>
          Carregar o Modelo padrão SBJ nesta obra
        </button>
        {erro && <p className="text-danger">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erro && (
        <div className="card bg-red-50 border-red-200 text-danger text-sm flex items-center justify-between">
          <span>{erro}</span>
          <button className="text-xs underline" onClick={() => setErro(null)}>
            fechar
          </button>
        </div>
      )}

      {confirmacao && (
        <div className="card bg-red-50 border-red-200 text-sm flex flex-wrap items-center gap-3">
          <span className="text-danger">{confirmacao.texto}</span>
          {confirmacao.destinos && (
            <select value={destino} onChange={(e) => setDestino(e.target.value)} className="border border-border rounded-md px-2 py-1 text-sm bg-white">
              <option value="">Mover os locais para…</option>
              {confirmacao.destinos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              className="px-3 py-1.5 bg-danger text-white rounded-md text-xs font-semibold disabled:opacity-50"
              disabled={ocupado || (!!confirmacao.destinos && !destino)}
              onClick={() => {
                const c = confirmacao;
                setConfirmacao(null);
                c.onConfirmar(destino || null);
              }}
            >
              Confirmar
            </button>
            <button className={btn} onClick={() => setConfirmacao(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* seletor de obra */}
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="block text-xs text-ink-500 mb-1">Obra</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm min-w-[220px] bg-white"
            value={obra.id}
            onChange={(e) => router.push(`/andamento-novo/config?obra=${e.target.value}`)}
          >
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        <button className={btn} onClick={() => setNovaObraAberta((v) => !v)}>
          {novaObraAberta ? "Fechar cadastro" : "+ Cadastrar nova obra"}
        </button>
        <span className="text-xs text-ink-500 ml-auto">
          Andamento geral (em andamento = 0,5): <b className="text-ink-900">{fmt(pctObra)}%</b>
        </span>
      </div>

      {novaObraAberta && (
        <NovaObra
          obras={obras}
          contagens={contagens}
          ocupado={ocupado}
          onCriar={(input) =>
            exec(async () => {
              const id = await acoes.criarObraNova(input);
              setNovaObraAberta(false);
              router.push(`/andamento-novo/config?obra=${id}`);
            })
          }
        />
      )}

      {/* 1. dados da obra */}
      <Secao
        titulo="Dados da obra"
        resumo={`Início: ${obra.data_inicio ?? "—"} · Entrega: ${obra.data_entrega_prevista ?? "—"}`}
        aberta={aberta.obra}
        onAlternar={() => alternar("obra")}
      >
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-ink-500 mb-1">Início da obra</label>
            <input
              type="date"
              defaultValue={obra.data_inicio ?? ""}
              onBlur={(e) => e.target.value !== (obra.data_inicio ?? "") && exec(() => acoes.salvarDatasObra(obra.id, e.target.value || null, obra.data_entrega_prevista))}
              className="border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Entrega prevista</label>
            <input
              type="date"
              defaultValue={obra.data_entrega_prevista ?? ""}
              onBlur={(e) => e.target.value !== (obra.data_entrega_prevista ?? "") && exec(() => acoes.salvarDatasObra(obra.id, obra.data_inicio, e.target.value || null))}
              className="border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-ink-500 max-w-sm">Usadas no resumo do relatório (prazo decorrido x obra executada).</p>
        </div>
      </Secao>

      {/* 2. categorias e serviços */}
      <MatrizCard
        aberta={aberta.matriz}
        onAlternar={() => alternar("matriz")}
        obraId={obra.id}
        fases={fases}
        categorias={categorias}
        servicos={servicos}
        vinc={vinc}
        faseDe={faseDe}
        ocupado={ocupado}
        exec={exec}
        pedirConfirmacao={(c) => {
          setDestino("");
          setConfirmacao(c);
        }}
        locaisPorCat={locaisPorCat}
      />

      {/* 3. pesos */}
      <PesosCard
        aberta={aberta.pesos}
        onAlternar={() => alternar("pesos")}
        categorias={categorias}
        servicos={servicos}
        fases={fases}
        vinc={vinc}
        ocupado={ocupado}
        exec={exec}
      />

      {/* 4. pavimentos */}
      <EstruturaCard
        tipo="pav"
        titulo="Pavimentos (de cima para baixo)"
        aberta={aberta.pavs}
        onAlternar={() => alternar("pavs")}
        obraId={obra.id}
        categorias={categorias}
        catPorId={catPorId}
        grupos={pavimentos.map((p) => ({
          id: p.id,
          nome: p.nome,
          pct: pctPav.get(p.id),
          filhos: locais.filter((l) => l.pavimento_id === p.id).map((l) => ({ id: l.id, nome: l.nome, categoria_id: l.categoria_id })),
        }))}
        ocupado={ocupado}
        exec={exec}
      />

      {/* 5. sistemas */}
      <EstruturaCard
        tipo="sis"
        titulo="Sistemas"
        aberta={aberta.sis}
        onAlternar={() => alternar("sis")}
        obraId={obra.id}
        categorias={categorias}
        catPorId={catPorId}
        grupos={sistemas.map((s) => ({
          id: s.id,
          nome: s.nome,
          pct: pctSis.get(s.id),
          fachada: s.tipo === "fachada",
          filhos: itens.filter((i) => i.sistema_id === s.id).map((i) => ({ id: i.id, nome: i.nome, categoria_id: i.categoria_id })),
        }))}
        ocupado={ocupado}
        exec={exec}
      />

      {ocupado && <div className="fixed bottom-4 right-4 bg-primaryDark text-white text-xs rounded-lg px-3 py-2 shadow-panel">Salvando…</div>}
    </div>
  );
}

// ============================================================================
// Categorias e serviços (matriz)

function MatrizCard(props: {
  aberta: boolean;
  onAlternar: () => void;
  obraId: string;
  fases: Fase[];
  categorias: Categoria[];
  servicos: Servico[];
  vinc: Map<string, { peso: number }>;
  faseDe: Map<string, Fase>;
  locaisPorCat: Map<string, number>;
  ocupado: boolean;
  exec: (fn: () => Promise<unknown>) => void;
  pedirConfirmacao: (c: Confirmacao) => void;
}) {
  const { obraId, fases, categorias, servicos, vinc, ocupado, exec } = props;
  const [editando, setEditando] = useState(false);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [novaCat, setNovaCat] = useState("");
  const [novoServ, setNovoServ] = useState<Record<string, string>>({});
  const [novaFase, setNovaFase] = useState("");
  const [fasesAbertas, setFasesAbertas] = useState(false);

  const grupos = useMemo(() => {
    const m = new Map<string, Servico[]>();
    [...servicos].sort((a, b) => a.ordem - b.ordem).forEach((s) => m.set(s.grupo, [...(m.get(s.grupo) ?? []), s]));
    return Array.from(m.entries());
  }, [servicos]);

  return (
    <Secao
      titulo="Categorias e serviços"
      resumo={`${categorias.length} categorias · ${servicos.length} serviços`}
      aberta={props.aberta}
      onAlternar={props.onAlternar}
      acoes={
        <div className="flex gap-2">
          <button
            className={btn}
            onClick={() => setFechados(fechados.size ? new Set() : new Set(grupos.map(([g]) => g)))}
          >
            {fechados.size ? "Abrir todos os grupos" : "Fechar todos os grupos"}
          </button>
          <button className={editando ? btnPri : btn} onClick={() => setEditando((v) => !v)}>
            <Pencil className="w-3 h-3 inline mr-1" />
            {editando ? "Concluir edição" : "Editar"}
          </button>
        </div>
      }
    >
      <p className="text-xs text-ink-500 mb-2">Marque em quais categorias cada serviço existe. A categoria do local define os serviços (e os pesos) dele.</p>
      <div className="overflow-auto border border-border rounded-lg" style={{ maxHeight: "70vh" }}>
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-surface-subtle text-left px-3 py-2 border-b border-r border-border min-w-[260px]">Serviço</th>
              {editando && <th className="sticky top-0 z-20 bg-surface-subtle px-2 py-2 border-b border-r border-border min-w-[120px]">Fase</th>}
              {categorias.map((c) => (
                <th
                  key={c.id}
                  className="sticky top-0 z-20 px-1.5 py-2 border-b border-r border-border align-bottom"
                  style={{ background: `color-mix(in srgb, ${c.cor} 12%, white)`, borderTop: `4px solid ${c.cor}`, minWidth: 74 }}
                >
                  {editando ? (
                    <div className="space-y-1">
                      <Texto valor={c.nome} onSalvar={(v) => exec(() => acoes.renomearCategoria(c.id, v))} className="w-full text-[11px] font-semibold text-center" />
                      <button
                        title="Excluir categoria"
                        className="text-danger bg-red-50 rounded p-0.5"
                        onClick={() =>
                          props.pedirConfirmacao({
                            texto: props.locaisPorCat.get(c.id)
                              ? `Excluir a categoria "${c.nome}"? ${props.locaisPorCat.get(c.id)} local(is) usam ela — escolha para onde movê-los. Os apontamentos não são apagados.`
                              : `Excluir a categoria "${c.nome}"?`,
                            destinos: props.locaisPorCat.get(c.id) ? categorias.filter((x) => x.id !== c.id) : undefined,
                            onConfirmar: (d) => exec(() => acoes.excluirCategoria(c.id, d)),
                          })
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="block text-[11px] font-semibold text-ink-900 text-center leading-tight">{c.nome}</span>
                  )}
                </th>
              ))}
              {editando && (
                <th className="sticky top-0 z-20 bg-surface-subtle px-2 py-2 border-b border-border min-w-[150px]">
                  <div className="flex gap-1">
                    <input
                      value={novaCat}
                      onChange={(e) => setNovaCat(e.target.value)}
                      placeholder="Nova categoria"
                      className="border border-border rounded px-1.5 py-1 text-[11px] w-24"
                    />
                    <button className={btn} disabled={!novaCat.trim() || ocupado} onClick={() => { exec(() => acoes.criarCategoria(obraId, novaCat)); setNovaCat(""); }}>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {grupos.map(([grupo, lista]) => {
              const fechado = fechados.has(grupo);
              return (
                <GrupoLinhas key={grupo}>
                  <tr>
                    <td
                      colSpan={categorias.length + 1 + (editando ? 2 : 0)}
                      className="sticky left-0 bg-surface-subtle px-3 py-1.5 border-b border-border font-semibold text-primaryDark cursor-pointer"
                      onClick={() => setFechados((f) => { const n = new Set(f); n.has(grupo) ? n.delete(grupo) : n.add(grupo); return n; })}
                    >
                      {fechado ? <ChevronRight className="w-3.5 h-3.5 inline mr-1" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-1" />}
                      {grupo} <span className="text-ink-400 font-normal">({lista.length})</span>
                    </td>
                  </tr>
                  {!fechado &&
                    lista.map((s) => (
                      <tr key={s.id} className="hover:bg-accent/20">
                        <td className="sticky left-0 z-10 bg-white px-3 py-1 border-b border-r border-border whitespace-nowrap">
                          {editando ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                title="Excluir serviço"
                                className="text-danger"
                                onClick={() =>
                                  props.pedirConfirmacao({
                                    texto: `Excluir o serviço "${s.nome}"? Ele sai de todas as categorias desta obra; os apontamentos já feitos ficam guardados.`,
                                    onConfirmar: () => exec(() => acoes.excluirServico(s.id)),
                                  })
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <Texto valor={s.nome} onSalvar={(v) => exec(() => acoes.renomearServico(s.id, v))} className="w-full" />
                            </span>
                          ) : (
                            s.nome
                          )}
                        </td>
                        {editando && (
                          <td className="px-1 py-1 border-b border-r border-border">
                            <select
                              value={s.fase_id ?? ""}
                              onChange={(e) => exec(() => acoes.definirFaseServico(s.id, e.target.value || null))}
                              className="border border-border rounded px-1 py-0.5 text-[11px] w-full bg-white"
                            >
                              <option value="">(grupo)</option>
                              {fases.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.nome}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        {categorias.map((c) => (
                          <td
                            key={c.id}
                            title={`${s.nome} · ${c.nome}`}
                            className="text-center border-b border-r border-border"
                            style={{ background: `color-mix(in srgb, ${c.cor} 6%, white)` }}
                          >
                            <input
                              type="checkbox"
                              checked={vinc.has(c.id + "|" + s.id)}
                              disabled={ocupado}
                              onChange={(e) => exec(() => acoes.servicoNaCategoria(c.id, s.id, e.target.checked))}
                            />
                          </td>
                        ))}
                        {editando && <td className="border-b border-border" />}
                      </tr>
                    ))}
                  {editando && !fechado && (
                    <tr>
                      <td colSpan={categorias.length + 3} className="sticky left-0 bg-white px-3 py-1.5 border-b border-border">
                        <span className="flex gap-2">
                          <input
                            value={novoServ[grupo] ?? ""}
                            onChange={(e) => setNovoServ((n) => ({ ...n, [grupo]: e.target.value }))}
                            placeholder={`Novo serviço em ${grupo}`}
                            className="border border-border rounded px-2 py-1 text-xs w-64"
                          />
                          <button
                            className={btn}
                            disabled={!(novoServ[grupo] ?? "").trim() || ocupado}
                            onClick={() => {
                              exec(() => acoes.criarServico(obraId, grupo, novoServ[grupo]));
                              setNovoServ((n) => ({ ...n, [grupo]: "" }));
                            }}
                          >
                            + Adicionar serviço
                          </button>
                        </span>
                      </td>
                    </tr>
                  )}
                </GrupoLinhas>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <div className="mt-3 border border-border rounded-lg p-3">
          <button className="text-sm font-medium text-primaryDark flex items-center gap-1" onClick={() => setFasesAbertas((v) => !v)}>
            {fasesAbertas ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} Fases do relatório
          </button>
          {fasesAbertas && (
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              {fases.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1 border border-border rounded-full pl-1 pr-2 py-0.5 text-xs bg-white">
                  <button disabled={i === 0} onClick={() => exec(() => acoes.moverFase(f.id, -1))} title="Mover para antes">
                    ◀
                  </button>
                  <button disabled={i === fases.length - 1} onClick={() => exec(() => acoes.moverFase(f.id, 1))} title="Mover para depois">
                    ▶
                  </button>
                  <Texto valor={f.nome} onSalvar={(v) => exec(() => acoes.renomearFase(f.id, v))} className="w-28" />
                  <button
                    className="text-danger"
                    title="Excluir fase"
                    onClick={() =>
                      props.pedirConfirmacao({
                        texto: `Excluir a fase "${f.nome}"? Os serviços dela passam a aparecer pelo nome do grupo.`,
                        onConfirmar: () => exec(() => acoes.excluirFase(f.id)),
                      })
                    }
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input value={novaFase} onChange={(e) => setNovaFase(e.target.value)} placeholder="Nova fase" className="border border-border rounded px-2 py-1 text-xs w-32" />
              <button className={btn} disabled={!novaFase.trim() || ocupado} onClick={() => { exec(() => acoes.criarFase(obraId, novaFase)); setNovaFase(""); }}>
                + Adicionar fase
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
        <span>Obras novas puxam do <b>Modelo padrão SBJ</b>.</span>
        <button
          className={btn}
          disabled={ocupado}
          onClick={() =>
            props.pedirConfirmacao({
              texto: "Salvar a configuração desta obra (categorias, serviços, fases, pesos e marcas) como Modelo padrão SBJ? Isso substitui o modelo atual para as próximas obras. As obras que já existem não mudam.",
              onConfirmar: () => exec(() => acoes.salvarComoModelo(obraId)),
            })
          }
        >
          Salvar como modelo padrão
        </button>
      </div>
    </Secao>
  );
}

function GrupoLinhas({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ============================================================================
// Pesos

function PesosCard(props: {
  aberta: boolean;
  onAlternar: () => void;
  categorias: Categoria[];
  servicos: Servico[];
  fases: Fase[];
  vinc: Map<string, { peso: number; peso_fixo: boolean }>;
  ocupado: boolean;
  exec: (fn: () => Promise<unknown>) => void;
}) {
  const { categorias, servicos, fases, vinc, ocupado, exec } = props;
  const [catId, setCatId] = useState(categorias[0]?.id ?? "");
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const cat = categorias.find((c) => c.id === catId) ?? categorias[0];

  const linhas = useMemo(() => {
    if (!cat) return [];
    return servicos.filter((s) => vinc.has(cat.id + "|" + s.id));
  }, [cat, servicos, vinc]);

  const porFase = useMemo(() => {
    const ordem = [...fases].sort((a, b) => a.ordem - b.ordem);
    const m = new Map<string, { titulo: string; itens: Servico[] }>();
    ordem.forEach((f) => m.set(f.id, { titulo: f.nome, itens: [] }));
    linhas.forEach((s) => {
      const chave = s.fase_id && m.has(s.fase_id) ? s.fase_id : "g:" + s.grupo;
      if (!m.has(chave)) m.set(chave, { titulo: s.grupo, itens: [] });
      m.get(chave)!.itens.push(s);
    });
    return Array.from(m.values()).filter((g) => g.itens.length);
  }, [linhas, fases]);

  if (!cat) return null;
  const peso = (s: Servico) => vinc.get(cat.id + "|" + s.id)?.peso ?? 0;
  const soma = linhas.reduce((a, s) => a + peso(s), 0);
  const somaOk = Math.abs(soma - 100) < 0.05;

  function confirmar(s: Servico) {
    const txt = rascunho[s.id];
    if (txt === undefined) return;
    setRascunho((r) => {
      const { [s.id]: _, ...resto } = r;
      return resto;
    });
    const n = parseFloat(txt.replace("%", "").replace(",", ".").trim());
    if (!Number.isFinite(n) || Math.abs(n - peso(s)) < 0.05) return;
    exec(() => acoes.definirPeso(cat.id, s.id, n));
  }

  return (
    <Secao titulo="Pesos dos serviços" resumo={`${categorias.length} categorias`} aberta={props.aberta} onAlternar={props.onAlternar}>
      <p className="text-xs text-ink-500 mb-2">
        Cada serviço vale um % dentro da categoria (soma 100%). Ao editar um, os que não estão com cadeado se reajustam; o editado fica fixo (🔒).
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {categorias.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatId(c.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${c.id === cat.id ? "bg-primary/10 border-primary font-semibold" : "bg-white border-border"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.cor }} />
            {c.nome}
          </button>
        ))}
      </div>

      <table className="w-full max-w-2xl text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase text-ink-400">
            <th className="pb-1">Serviço</th>
            <th className="pb-1 text-right pr-3">% do total</th>
            <th className="pb-1 text-center">Fixo</th>
            <th className="pb-1 text-center" title="Vale para o pavimento inteiro (ex.: Estrutura)">
              Pav. inteiro
            </th>
          </tr>
        </thead>
        <tbody>
          {porFase.map((g) => (
            <GrupoLinhas key={g.titulo}>
              <tr>
                <td colSpan={4} className="pt-3 pb-1 text-xs font-semibold text-primaryDark border-b border-border">
                  {g.titulo} <span className="text-ink-400 font-normal">· {fmt(g.itens.reduce((a, s) => a + peso(s), 0))}%</span>
                </td>
              </tr>
              {g.itens.map((s) => {
                const v = vinc.get(cat.id + "|" + s.id)!;
                return (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-1 pr-2">{s.nome}</td>
                    <td className="py-1 pr-3 text-right whitespace-nowrap">
                      <input
                        inputMode="decimal"
                        value={rascunho[s.id] ?? fmt(v.peso)}
                        disabled={ocupado}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setRascunho((r) => ({ ...r, [s.id]: e.target.value }))}
                        onBlur={() => confirmar(s)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className={`w-16 border rounded px-1.5 py-0.5 text-right tabular-nums ${v.peso_fixo ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}
                      />
                      <span className="text-xs text-ink-500 ml-0.5">%</span>
                    </td>
                    <td className="py-1 text-center">
                      <button
                        title={v.peso_fixo ? "Fixo: clique para soltar" : "Solto: clique para fixar"}
                        onClick={() => exec(() => acoes.alternarFixo(cat.id, s.id, !v.peso_fixo))}
                        className={v.peso_fixo ? "text-primary" : "text-ink-300"}
                      >
                        {v.peso_fixo ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-1 text-center">
                      <input
                        type="checkbox"
                        checked={s.vale_pavimento_inteiro}
                        disabled={ocupado}
                        onChange={(e) => exec(() => acoes.definirPavInteiro(s.id, e.target.checked))}
                      />
                    </td>
                  </tr>
                );
              })}
            </GrupoLinhas>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btn} disabled={ocupado} onClick={() => exec(() => acoes.igualarPesos(cat.id))}>
          Dividir igualmente entre todos
        </button>
        <button className={btn} disabled={ocupado} onClick={() => exec(() => acoes.pesosPadrao(cat.id))}>
          Voltar ao padrão SBJ
        </button>
        <span className={`text-xs ml-2 ${somaOk ? "text-ink-500" : "text-danger font-semibold"}`}>
          Soma: <b>{fmt(soma)}%</b>
          {!somaOk && " (deveria ser 100%)"}
        </span>
      </div>
    </Secao>
  );
}

// ============================================================================
// Pavimentos e Sistemas (mesma estrutura: grupo > filhos)

type GrupoItem = {
  id: string;
  nome: string;
  pct?: number;
  fachada?: boolean;
  filhos: { id: string; nome: string; categoria_id: string }[];
};

function EstruturaCard(props: {
  tipo: "pav" | "sis";
  titulo: string;
  aberta: boolean;
  onAlternar: () => void;
  obraId: string;
  categorias: Categoria[];
  catPorId: Map<string, Categoria>;
  grupos: GrupoItem[];
  ocupado: boolean;
  exec: (fn: () => Promise<unknown>) => void;
}) {
  const { tipo, obraId, categorias, catPorId, grupos, ocupado, exec } = props;
  const pav = tipo === "pav";
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoFilho, setNovoFilho] = useState<Record<string, { nome: string; cat: string }>>({});
  const nomeGrupo = pav ? "pavimento" : "sistema";
  const nomeFilho = pav ? "local" : "item";

  return (
    <Secao
      titulo={props.titulo}
      resumo={`${grupos.length} ${pav ? "pavimentos" : "sistemas"} · ${grupos.reduce((a, g) => a + g.filhos.length, 0)} ${pav ? "locais" : "itens"}`}
      aberta={props.aberta}
      onAlternar={props.onAlternar}
      acoes={
        <button className={editando ? btnPri : btn} onClick={() => { setEditando((v) => !v); setConfirmando(null); }}>
          <Pencil className="w-3 h-3 inline mr-1" />
          {editando ? "Concluir edição" : pav ? "Editar estrutura" : "Editar"}
        </button>
      }
    >
      {!editando && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500 mb-3">
          {categorias.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.cor }} />
              {c.nome}
            </span>
          ))}
        </div>
      )}

      {editando && (
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder={pav ? "Nome do novo pavimento" : "Nome do novo sistema"}
            className="border border-border rounded px-2 py-1 text-xs w-56"
          />
          {pav ? (
            <>
              <button className={btn} disabled={ocupado} onClick={() => { exec(() => acoes.criarPavimento(obraId, "topo", novoNome)); setNovoNome(""); }}>
                + Adicionar no topo
              </button>
              <button className={btn} disabled={ocupado} onClick={() => { exec(() => acoes.criarPavimento(obraId, "fim", novoNome)); setNovoNome(""); }}>
                + Adicionar embaixo
              </button>
            </>
          ) : (
            <button className={btn} disabled={ocupado} onClick={() => { exec(() => acoes.criarSistema(obraId, novoNome)); setNovoNome(""); }}>
              + Novo sistema
            </button>
          )}
        </div>
      )}

      <div className="divide-y divide-border">
        {grupos.map((g, i) => {
          const nf = novoFilho[g.id] ?? { nome: "", cat: categorias[0]?.id ?? "" };
          return (
            <div key={g.id} className="py-2">
              <div className="flex items-center gap-2 flex-wrap">
                {editando && pav && (
                  <span className="flex">
                    <button disabled={i === 0 || ocupado} onClick={() => exec(() => acoes.moverPavimento(g.id, -1))} title="Subir">
                      <ChevronUp className="w-4 h-4 text-ink-400" />
                    </button>
                    <button disabled={i === grupos.length - 1 || ocupado} onClick={() => exec(() => acoes.moverPavimento(g.id, 1))} title="Descer">
                      <ChevronDown className="w-4 h-4 text-ink-400" />
                    </button>
                  </span>
                )}
                {editando ? (
                  <Texto
                    valor={g.nome}
                    onSalvar={(v) => exec(() => (pav ? acoes.renomearPavimento(g.id, v) : acoes.renomearSistema(g.id, v)))}
                    className="font-semibold text-sm w-44"
                  />
                ) : (
                  <span className="font-semibold text-sm w-44">{g.nome}</span>
                )}
                {g.pct != null && <span className="text-xs tabular-nums text-primaryDark bg-primary/10 rounded-full px-2 py-0.5">{fmt(g.pct)}%</span>}
                {g.fachada && <span className="text-[11px] text-ink-500">(itens gerados pelas descidas — Fase 4)</span>}
                {editando && (
                  <span className="flex items-center gap-2 ml-auto">
                    {pav && (
                      <button title="Duplicar pavimento (com os locais, sem status)" disabled={ocupado} onClick={() => exec(() => acoes.duplicarPavimento(g.id))}>
                        <Copy className="w-4 h-4 text-primary" />
                      </button>
                    )}
                    {confirmando === g.id ? (
                      <span className="flex gap-1">
                        <button
                          className="text-xs px-2 py-0.5 bg-danger text-white rounded"
                          onClick={() => { setConfirmando(null); exec(() => (pav ? acoes.excluirPavimento(g.id) : acoes.excluirSistema(g.id))); }}
                        >
                          Excluir?
                        </button>
                        <button className="text-xs px-1" onClick={() => setConfirmando(null)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button title={`Excluir ${nomeGrupo}`} className="text-danger" onClick={() => setConfirmando(g.id)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-1.5 pl-1">
                {g.filhos.map((f) => {
                  const c = catPorId.get(f.categoria_id);
                  return editando ? (
                    <span key={f.id} className="flex items-center gap-1 border border-border rounded px-1.5 py-0.5 bg-white">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c?.cor }} />
                      <Texto
                        valor={f.nome}
                        onSalvar={(v) => exec(() => (pav ? acoes.renomearLocal(f.id, v) : acoes.renomearItem(f.id, v)))}
                        className="text-xs w-28"
                      />
                      <select
                        value={f.categoria_id}
                        onChange={(e) => exec(() => (pav ? acoes.trocarCategoriaLocal(f.id, e.target.value) : acoes.trocarCategoriaItem(f.id, e.target.value)))}
                        className="text-[11px] border border-border rounded px-0.5 bg-white max-w-[110px]"
                      >
                        {categorias.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nome}
                          </option>
                        ))}
                      </select>
                      {confirmando === f.id ? (
                        <button
                          className="text-[11px] px-1.5 bg-danger text-white rounded"
                          onClick={() => { setConfirmando(null); exec(() => (pav ? acoes.excluirLocal(f.id) : acoes.excluirItem(f.id))); }}
                        >
                          Excluir?
                        </button>
                      ) : (
                        <button className="text-danger" title={`Excluir ${nomeFilho}`} onClick={() => setConfirmando(f.id)}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ) : (
                    <span key={f.id} className="flex items-center gap-1 text-xs border border-border rounded-full px-2 py-0.5 bg-white">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c?.cor }} />
                      {f.nome}
                    </span>
                  );
                })}
                {editando && !g.fachada && (
                  <span className="flex items-center gap-1">
                    <input
                      value={nf.nome}
                      onChange={(e) => setNovoFilho((m) => ({ ...m, [g.id]: { ...nf, nome: e.target.value } }))}
                      placeholder={pav ? "Novo local" : "Novo item"}
                      className="border border-dashed border-border rounded px-1.5 py-0.5 text-xs w-28"
                    />
                    <select
                      value={nf.cat}
                      onChange={(e) => setNovoFilho((m) => ({ ...m, [g.id]: { ...nf, cat: e.target.value } }))}
                      className="text-[11px] border border-border rounded px-0.5 bg-white max-w-[110px]"
                    >
                      {categorias.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      className={btn}
                      disabled={!nf.nome.trim() || ocupado}
                      onClick={() => {
                        exec(() => (pav ? acoes.criarLocal(g.id, nf.cat, nf.nome) : acoes.criarItem(g.id, nf.cat, nf.nome)));
                        setNovoFilho((m) => ({ ...m, [g.id]: { nome: "", cat: nf.cat } }));
                      }}
                    >
                      + Adicionar
                    </button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Secao>
  );
}

// ============================================================================
// Cadastro de obra nova

function NovaObra(props: {
  obras: DadosConfig["obras"];
  contagens: DadosConfig["contagens"];
  ocupado: boolean;
  onCriar: (input: { nome: string; base: string | null; inicio: string | null; entrega: string | null; params: ParamsObraNova }) => void;
}) {
  const [nome, setNome] = useState("");
  const [base, setBase] = useState<string>("modelo");
  const [inicio, setInicio] = useState("");
  const [entrega, setEntrega] = useState("");
  const [params, setParams] = useState<ParamsObraNova>({ tipos: 10, aptos: 4, garagens: 2, elev: 2, lazerOnde: "proprio", cxSup: "cxf", cxInf: true });
  const set = <K extends keyof ParamsObraNova>(k: K, v: ParamsObraNova[K]) => setParams((p) => ({ ...p, [k]: v }));
  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, parseInt(v, 10) || 0));

  const est = useMemo(() => gerarEstrutura(params), [params]);
  const previa = useMemo(() => previaEstrutura(est, props.contagens[base] ?? {}), [est, props.contagens, base]);

  const campo = "border border-border rounded-lg px-3 py-2 text-sm bg-white w-full";
  return (
    <div className="card">
      <h2 className="font-semibold text-primaryDark mb-3">Cadastrar nova obra</h2>
      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 text-xs text-ink-500">
            Nome da obra
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Ex.: ILHA DE LIPARI" />
          </label>
          <label className="text-xs text-ink-500">
            Pavimentos tipo
            <input type="number" min={0} max={60} value={params.tipos} onChange={(e) => set("tipos", num(e.target.value, 0, 60))} className={campo} />
          </label>
          <label className="text-xs text-ink-500">
            Apartamentos por pavimento
            <input type="number" min={1} max={20} value={params.aptos} onChange={(e) => set("aptos", num(e.target.value, 1, 20))} className={campo} />
          </label>
          <label className="text-xs text-ink-500">
            Pavimentos de garagem
            <input type="number" min={0} max={10} value={params.garagens} onChange={(e) => set("garagens", num(e.target.value, 0, 10))} className={campo} />
          </label>
          <label className="text-xs text-ink-500">
            Elevadores
            <input type="number" min={0} max={10} value={params.elev} onChange={(e) => set("elev", num(e.target.value, 0, 10))} className={campo} />
          </label>
          <label className="text-xs text-ink-500">
            Onde fica o lazer
            <select value={params.lazerOnde} onChange={(e) => set("lazerOnde", e.target.value as ParamsObraNova["lazerOnde"])} className={campo}>
              <option value="proprio">Pavimento próprio</option>
              <option value="cobertura">Na cobertura</option>
              <option value="terreo">No térreo</option>
              <option value="tipo">Junto com o último pavimento tipo</option>
              <option value="nao">Não tem</option>
            </select>
          </label>
          <label className="text-xs text-ink-500">
            Reservatório superior
            <select value={params.cxSup} onChange={(e) => set("cxSup", e.target.value as "cxf" | "cxc")} className={campo}>
              <option value="cxf">Fibra</option>
              <option value="cxc">Concreto armado</option>
            </select>
          </label>
          <label className="text-xs text-ink-500 flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={params.cxInf} onChange={(e) => set("cxInf", e.target.checked)} />
            Tem reservatório inferior (concreto armado)
          </label>
          <label className="text-xs text-ink-500">
            Início da obra (opcional)
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
          </label>
          <label className="text-xs text-ink-500">
            Entrega prevista (opcional)
            <input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className={campo} />
          </label>
          <label className="sm:col-span-2 text-xs text-ink-500">
            Categorias, serviços, fases e pesos
            <select value={base} onChange={(e) => setBase(e.target.value)} className={campo}>
              <option value="modelo">Modelo padrão SBJ</option>
              {props.obras.map((o) => (
                <option key={o.id} value={o.id}>
                  Copiar da obra {o.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="bg-surface-subtle rounded-lg p-3 text-sm self-start">
          <p className="text-xs font-semibold uppercase text-ink-500 mb-2">Prévia do que será criado</p>
          <ul className="space-y-1">
            <li>
              <b>{previa.pavimentos}</b> pavimentos
            </li>
            <li>
              <b>{previa.locais}</b> locais
            </li>
            <li>
              <b>{previa.sistemas}</b> sistemas ({previa.itens} itens)
            </li>
            <li>
              <b>{previa.etapas.toLocaleString("pt-BR")}</b> etapas de acompanhamento
            </li>
          </ul>
          <p className="text-[11px] text-ink-500 mt-2">Copia só a configuração, nunca os status de outra obra.</p>
        </div>
      </div>
      <div className="mt-4">
        <button
          className={btnPri}
          disabled={props.ocupado || !nome.trim()}
          onClick={() => props.onCriar({ nome, base: base === "modelo" ? null : base, inicio: inicio || null, entrega: entrega || null, params })}
        >
          Criar obra
        </button>
      </div>
    </div>
  );
}
