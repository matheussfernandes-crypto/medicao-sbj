"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Printer, Trash2 } from "lucide-react";
import * as acoesRel from "./acoesRel";
import { BlocoFachada3D, BlocoFachadaTabela, BlocoGradeView, medidaFatias } from "./Blocos";
import Folha, { dimensoes } from "./Folha";
import { ChipsFiltro, PainelFiltros, chipsDeFiltros, normalizarFiltros } from "./Filtros";
import Resumo from "./Resumo";
import { predefinicoesPadrao, type Predefinicao } from "./predefinicoes";
import {
  FILTROS_VAZIOS,
  FORMATO_PADRAO,
  MONTAGEM_PADRAO,
  agruparPorFase,
  calcularEscopo,
  montarBlocos,
  montarCtx,
  paginar,
  tituloDaFolha,
  type Bloco,
  type Filtros,
  type Folha as FolhaPag,
  type Formato,
  type Medida,
  type Montagem,
} from "./modelo";
import { acumular, mapaApontamentos, montarIndice, pct, somaZero } from "../calculo";
import type { DadosAndamento } from "../types";
import { status as statusDe } from "./modelo";

const ROTULO_ST = ["Não iniciado", "Andamento", "Finalizado", "Ausência"];

function Seg<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex border border-border rounded-md overflow-hidden">
      {opcoes.map(([v, nome]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`px-2.5 py-1.5 text-xs ${valor === v ? "bg-primaryDark text-white" : "bg-white hover:bg-surface-subtle"}`}>
          {nome}
        </button>
      ))}
    </div>
  );
}

function Chave({ ligada, onChange, texto }: { ligada: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <span className={`relative w-9 h-5 rounded-full transition ${ligada ? "bg-primary" : "bg-gray-300"}`} onClick={() => onChange(!ligada)}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ligada ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {texto}
    </label>
  );
}

export default function RelatorioClient({ dados, salvas }: { dados: DadosAndamento; salvas: Predefinicao[] }) {
  const obra = dados.obra;
  const idx = useMemo(() => montarIndice(dados.categorias, dados.servicos, dados.vinculos), [dados]);
  const ap = useMemo(() => mapaApontamentos(dados.apontamentos), [dados.apontamentos]);
  const ctx = useMemo(() => montarCtx(dados, idx, ap), [dados, idx, ap]);

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [fmt, setFmt] = useState<Formato>(FORMATO_PADRAO);
  const [mon, setMon] = useState<Montagem>(MONTAGEM_PADRAO);
  const [menu, setMenu] = useState<null | "filtros" | "predef" | "formato">(null);
  const [minhas, setMinhas] = useState<Predefinicao[]>(salvas);
  const [nomeNova, setNomeNova] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const chaveSalva = `an-rel-${obra.id}`;

  // última configuração usada (por obra) fica guardada neste navegador
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(chaveSalva) ?? "null");
      if (r) {
        setFiltros(normalizarFiltros(ctx, { ...FILTROS_VAZIOS, ...r.filtros }));
        setFmt({ ...FORMATO_PADRAO, ...r.fmt });
        setMon({ ...MONTAGEM_PADRAO, ...r.mon });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveSalva]);
  useEffect(() => {
    try {
      localStorage.setItem(chaveSalva, JSON.stringify({ filtros, fmt, mon }));
    } catch {}
  }, [chaveSalva, filtros, fmt, mon]);

  const padroes = useMemo(() => predefinicoesPadrao(ctx), [ctx]);
  const escopo = useMemo(() => calcularEscopo(ctx, filtros), [ctx, filtros]);
  const blocos = useMemo(() => montarBlocos(ctx, escopo, fmt, mon), [ctx, escopo, fmt, mon]);
  const dim = dimensoes(fmt.folha);
  const chips = useMemo(() => chipsDeFiltros(ctx, filtros), [ctx, filtros]);
  const textoFiltros = chips.map((c) => c.texto).join(" · ");

  const pctEscopo = useMemo(() => {
    const s = somaZero();
    const somar = (alvo: string, catId: string) =>
      (idx.servicosDaCat.get(catId) ?? []).forEach(({ servico, peso }) => escopo.servOk(servico) && acumular(s, peso, statusDe(ap, alvo, servico.id)));
    escopo.locais.forEach((l) => somar(l.id, l.categoria_id));
    escopo.itens.forEach((i) => somar(i.id, i.categoria_id));
    return pct(s);
  }, [escopo, idx, ap]);

  // ---------- medição e paginação ----------
  const medRef = useRef<HTMLDivElement>(null);
  const chaveMedida = useMemo(() => blocos.map((b) => b.id).join("|") + JSON.stringify(fmt) + JSON.stringify(mon.esconder) + dim.w + "|" + dados.apontamentos.length + "|" + obra.id, [blocos, fmt, mon.esconder, dim.w, dados.apontamentos.length, obra.id]);
  const [medidas, setMedidas] = useState<{ chave: string; lista: Medida[] } | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const raiz = medRef.current;
      if (!raiz) return;
      const lista: Medida[] = blocos.map((b) => {
        const el = raiz.querySelector(`[data-medida="${b.id}"]`) as HTMLElement | null;
        const total = el ? el.getBoundingClientRect().height : 0;
        const fatias = el ? Array.from(el.querySelectorAll("[data-fatia]")).map((f) => f.getBoundingClientRect().height) : [];
        const cab = Math.max(0, total - fatias.reduce((a, x) => a + x, 0));
        return { id: b.id, altura: b.tipo === "fachada" ? dim.alturaUtil : total, cabecalho: cab, fatias: b.tipo === "fachada" ? [] : fatias };
      });
      setMedidas({ chave: chaveMedida, lista });
    };
    medir();
    const t = setTimeout(medir, 250); // depois que fontes/imagens assentam
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveMedida]);

  const folhas: FolhaPag[] | null = useMemo(() => (medidas && medidas.chave === chaveMedida ? paginar(medidas.lista, dim.alturaUtil, fmt.fit) : null), [medidas, chaveMedida, dim.alturaUtil, fmt.fit]);
  const blocoPorId = useMemo(() => new Map(blocos.map((b) => [b.id, b])), [blocos]);
  const medidaPorId = useMemo(() => new Map((medidas?.lista ?? []).map((m) => [m.id, m])), [medidas]);

  // ---------- escala da prévia na tela ----------
  const larguraRef = useRef<HTMLDivElement>(null);
  const [larguraTela, setLarguraTela] = useState(1100);
  useEffect(() => {
    const el = larguraRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLarguraTela(el.clientWidth));
    ro.observe(el);
    setLarguraTela(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const escalaTela = Math.min(1, Math.max(0.2, (larguraTela - 4) / dim.w));

  const emitidoEm = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const nomeBloco = (b: Bloco) => (b.tipo === "grade" ? (b.id.startsWith("pav:") ? b.titulo.split(" · ")[0] : b.titulo) : "Fachada");

  function renderBloco(b: Bloco, fatias: number[] | null, continuacao: boolean, escala: number, comMargem = true) {
    return (
      <div key={b.id + (continuacao ? "-c" : "") + (fatias ? fatias.join(",") : "")} style={{ zoom: escala, marginBottom: comMargem ? 14 : 0 }}>
        {b.tipo === "grade" && <BlocoGradeView bloco={b} ctx={ctx} fmt={fmt} largura={dim.larguraUtil / escala} fatias={fatias} continuacao={continuacao} />}
        {b.tipo === "fachada" && <BlocoFachada3D bloco={b} ctx={ctx} largura={dim.larguraUtil} altura={dim.alturaUtil} />}
        {b.tipo === "fachada-tab" && <BlocoFachadaTabela bloco={b} ctx={ctx} fmt={fmt} />}
      </div>
    );
  }

  const totalPaginas = (mon.resumo ? 1 : 0) + (folhas?.length ?? 0);
  const folhasRender: React.ReactNode[] = [];
  let numero = 0;
  if (mon.resumo) {
    numero++;
    folhasRender.push(
      <Folha key="resumo" folha={fmt.folha} obraNome={obra.nome} titulo={escopo.filtrado ? "Resumo do filtro" : "Resumo da obra"} filtros={textoFiltros || undefined} pct={pctEscopo} emitidoEm={emitidoEm} usuario={dados.usuario.nome} numero={numero} total={totalPaginas}>
        <Resumo ctx={ctx} escopo={escopo} fmt={fmt} largura={dim.larguraUtil} altura={dim.alturaUtil} />
      </Folha>
    );
  }
  (folhas ?? []).forEach((f, fi) => {
    numero++;
    const blocosDaFolha = f.itens.map((it) => blocoPorId.get(it.blocoId)!).filter(Boolean);
    const usado = f.itens.reduce((a, it) => {
      const m = medidaPorId.get(it.blocoId);
      return a + (m ? (it.fatias ? m.cabecalho + it.fatias.reduce((s, i) => s + (m.fatias[i] ?? 0), 0) : m.altura) * it.escala : 0) + 14;
    }, 0);
    const temFachada3d = blocosDaFolha.some((b) => b.tipo === "fachada");
    const escalaFill = fmt.fill && !temFachada3d && usado > 0 ? Math.min(1.6, (dim.alturaUtil / usado) * 0.96) : 1;
    folhasRender.push(
      <Folha
        key={"f" + fi}
        folha={fmt.folha}
        obraNome={obra.nome}
        titulo={tituloDaFolha(blocosDaFolha.map(nomeBloco))}
        filtros={textoFiltros || undefined}
        pct={pctEscopo}
        emitidoEm={emitidoEm}
        usuario={dados.usuario.nome}
        numero={numero}
        total={totalPaginas}
        primeiraSemResumo={!mon.resumo && fi === 0}
        escala={escalaFill > 1.02 ? escalaFill : 1}
      >
        {f.itens.map((it) => renderBloco(blocoPorId.get(it.blocoId)!, it.fatias, it.continuacao, it.escala))}
      </Folha>
    );
  });

  // ---------- predefinições ----------
  function aplicarPredef(p: Predefinicao) {
    setFiltros(normalizarFiltros(ctx, p.filtros));
    if (p.formato) setFmt((f) => ({ ...f, ...p.formato }));
    if (p.montagem) setMon((m) => ({ ...m, ...p.montagem }));
    setMenu(null);
  }
  async function salvarAtual() {
    const nome = nomeNova.trim();
    if (!nome) return;
    try {
      const d = await acoesRel.salvarPredefinicao(obra.id, nome, filtros, fmt, mon);
      setMinhas((m) => [...m, { id: d.id, nome: d.nome, filtros: d.filtros as Filtros, formato: d.formatacao as Formato, montagem: d.montagem as Montagem }]);
      setNomeNova("");
    } catch (e: any) {
      setErro(e.message);
    }
  }
  async function excluirPredef(id: string) {
    try {
      await acoesRel.excluirPredefinicao(id);
      setMinhas((m) => m.filter((x) => x.id !== id));
    } catch (e: any) {
      setErro(e.message);
    }
  }

  // ---------- impressão (janela própria, só com as folhas) ----------
  const pilhaRef = useRef<HTMLDivElement>(null);
  function imprimir() {
    const pilha = pilhaRef.current;
    if (!pilha) return;
    const w = window.open("", "_blank");
    if (!w) {
      setErro("O navegador bloqueou a janela de impressão. Permita pop-ups para este site.");
      return;
    }
    const css = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join("\n");
    const html = pilha.outerHTML.replace(/zoom:\s*[\d.]+;?/g, (m, i) => m); // mantém o zoom interno das folhas
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${obra.nome} — Andamento</title><base href="${location.origin}/">${css}
<style>
@page { size: A3 ${fmt.folha === "h" ? "landscape" : "portrait"}; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rel-pilha { display: block !important; zoom: 1 !important; }
.rel-folha { break-after: page; page-break-after: always; margin: 0 !important; box-shadow: none !important; }
.rel-folha:last-child { break-after: auto; page-break-after: auto; }
</style></head><body>${html}</body></html>`);
    w.document.close();
    const disparar = () => setTimeout(() => { w.focus(); w.print(); }, 500);
    if (w.document.readyState === "complete") disparar();
    else w.onload = disparar;
  }

  // ---------- CSV (segue os filtros) ----------
  function exportarCSV() {
    const linhas: string[][] = [["Pavimento / Sistema", "Local / Item", "Categoria", "Fase", "Serviço", "Status", "Observação"]];
    const faseNome = (s: { fase_id: string | null; grupo: string }) => (s.fase_id && ctx.faseOrdem.get(s.fase_id)?.nome) || s.grupo;
    const emitir = (onde: string, alvoId: string, alvoNome: string, catId: string) => {
      const cat = idx.catPorId.get(catId);
      (idx.servicosDaCat.get(catId) ?? []).forEach(({ servico }) => {
        if (!escopo.servOk(servico)) return;
        const a = ap.get(alvoId + "|" + servico.id);
        linhas.push([onde, alvoNome, cat?.nome ?? "", faseNome(servico), servico.nome, ROTULO_ST[a?.status ?? 0], a?.observacao ?? ""]);
      });
    };
    escopo.locais.forEach((l) => emitir(ctx.pavPorId.get(l.pavimento_id)?.nome ?? "", l.id, l.nome, l.categoria_id));
    escopo.itens.forEach((i) => emitir(ctx.sisPorId.get(i.sistema_id)?.nome ?? "", i.id, i.nome, i.categoria_id));
    const csv = linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `andamento-${obra.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const qtdFiltros = chips.length;

  return (
    <div className="space-y-3">
      {erro && (
        <div className="card bg-red-50 border-red-200 text-danger text-sm flex justify-between">
          <span>{erro}</span>
          <button className="underline text-xs" onClick={() => setErro(null)}>
            fechar
          </button>
        </div>
      )}

      {/* barra de controles */}
      <div className="card space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2 relative">
          <button className={`text-sm px-3 py-1.5 border rounded-md flex items-center gap-1 ${menu === "filtros" ? "bg-primary/10 border-primary" : "border-border bg-white"}`} onClick={() => setMenu(menu === "filtros" ? null : "filtros")}>
            Filtrar{qtdFiltros ? ` (${qtdFiltros})` : ""} <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button className={`text-sm px-3 py-1.5 border rounded-md flex items-center gap-1 ${menu === "predef" ? "bg-primary/10 border-primary" : "border-border bg-white"}`} onClick={() => setMenu(menu === "predef" ? null : "predef")}>
              Predefinições <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {menu === "predef" && (
              <div className="absolute z-30 mt-1 w-72 bg-white border border-border rounded-lg shadow-panel p-2 max-h-96 overflow-auto">
                {[...padroes, ...minhas].map((p) => (
                  <div key={p.id} className="flex items-center gap-1 hover:bg-surface-subtle rounded">
                    <button className="flex-1 text-left text-sm px-2 py-1.5" onClick={() => aplicarPredef(p)}>
                      {p.nome}
                    </button>
                    {!p.padrao && (
                      <button className="p-1 text-danger" title="Excluir" onClick={() => excluirPredef(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="border-t border-border mt-1 pt-2 flex gap-1">
                  <input value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} placeholder="+ Salvar filtro atual como…" className="flex-1 border border-border rounded px-2 py-1 text-xs" />
                  <button className="text-xs px-2 py-1 bg-primary text-white rounded disabled:opacity-50" disabled={!nomeNova.trim()} onClick={salvarAtual}>
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className={`text-sm px-3 py-1.5 border rounded-md flex items-center gap-1 ${menu === "formato" ? "bg-primary/10 border-primary" : "border-border bg-white"}`} onClick={() => setMenu(menu === "formato" ? null : "formato")}>
              Formatação <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {menu === "formato" && (
              <div className="absolute z-30 mt-1 w-[420px] max-w-[92vw] bg-white border border-border rounded-lg shadow-panel p-3 space-y-2.5">
                {(
                  [
                    ["Folha", <Seg key="a" valor={fmt.folha} onChange={(v) => setFmt({ ...fmt, folha: v })} opcoes={[["h", "A3 Horizontal"], ["v", "A3 Vertical"]]} />],
                    ["Nas linhas da tabela", <Seg key="b" valor={fmt.linhas} onChange={(v) => setFmt({ ...fmt, linhas: v })} opcoes={[["serv", "Serviços"], ["local", "Pavimentos / locais"]]} />],
                    ["Texto do topo das colunas", <Seg key="c" valor={fmt.texto} onChange={(v) => setFmt({ ...fmt, texto: v })} opcoes={[["h", "Horizontal"], ["v", "Vertical"]]} />],
                    ["Apartamentos e locais", <Seg key="d" valor={fmt.det} onChange={(v) => setFmt({ ...fmt, det: v })} opcoes={[["ju", "Juntos por pavimento"], ["un", "Um por um"]]} />],
                    ["Ocupar a folha toda", <Seg key="e" valor={fmt.fill ? "s" : "n"} onChange={(v) => setFmt({ ...fmt, fill: v === "s" })} opcoes={[["n", "Não"], ["s", "Sim"]]} />],
                    ["Fachada", <Seg key="f" valor={fmt.fachada} onChange={(v) => setFmt({ ...fmt, fachada: v })} opcoes={[["3d", "Prédio em 3D grande"], ["tab", "Tabela"]]} />],
                    ["Bloco grande", <Seg key="g" valor={fmt.fit} onChange={(v) => setFmt({ ...fmt, fit: v })} opcoes={[["cont", "Continua na outra folha"], ["enc", "Encolhe pra caber"]]} />],
                    ["Tamanho da letra", <Seg key="h" valor={fmt.letra} onChange={(v) => setFmt({ ...fmt, letra: v })} opcoes={[["n", "Normal"], ["c", "Compacta"]]} />],
                  ] as [string, React.ReactNode][]
                ).map(([t, c]) => (
                  <div key={t}>
                    <div className="text-[11px] uppercase text-ink-500 mb-1">{t}</div>
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-[200px]">
            <ChipsFiltro
              chips={chips}
              onRemover={(g) => setFiltros(normalizarFiltros(ctx, { ...filtros, [g]: [] }))}
              onLimpar={() => setFiltros(FILTROS_VAZIOS)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Seg valor={mon.modo} onChange={(v) => setMon({ ...mon, modo: v })} opcoes={[["tipo", "Folha por tipo de local"], ["pav", "Folha por pavimento"]]} />
          <Chave ligada={mon.esconder} onChange={(v) => setMon({ ...mon, esconder: v })} texto="Esconder o que não começou" />
          <Chave ligada={mon.resumo} onChange={(v) => setMon({ ...mon, resumo: v })} texto="Página de resumo" />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-500">
              {folhas ? `${totalPaginas} página${totalPaginas === 1 ? "" : "s"}` : "montando…"} · A3 {fmt.folha === "h" ? "horizontal" : "vertical"} · {fmt.folha === "h" ? "420 × 297" : "297 × 420"} mm
            </span>
            <button onClick={exportarCSV} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm bg-white">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={imprimir} disabled={!folhas} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50">
              <Printer className="w-4 h-4" /> Imprimir / salvar PDF (A3)
            </button>
          </div>
        </div>
      </div>

      {menu === "filtros" && <PainelFiltros ctx={ctx} filtros={filtros} onChange={setFiltros} onFechar={() => setMenu(null)} />}

      {/* prévia das folhas */}
      <div ref={larguraRef} className="w-full">
        {blocos.length === 0 && !mon.resumo ? (
          <div className="card text-sm text-ink-500">Nada para mostrar com estes filtros.</div>
        ) : (
          <div style={{ zoom: escalaTela }}>
            <div ref={pilhaRef} className="rel-pilha" style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" }}>
              {folhasRender}
            </div>
          </div>
        )}
      </div>

      {/* medidor invisível: mede cada bloco na largura real da folha */}
      <div ref={medRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0, width: dim.larguraUtil, visibility: "hidden", pointerEvents: "none" }}>
        {blocos.map((b) => (
          <div key={b.id} data-medida={b.id}>
            {b.tipo === "grade" && <BlocoGradeView bloco={b} ctx={ctx} fmt={fmt} largura={dim.larguraUtil} />}
            {b.tipo === "fachada" && <div style={{ height: 10 }} />}
            {b.tipo === "fachada-tab" && <BlocoFachadaTabela bloco={b} ctx={ctx} fmt={fmt} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export { medidaFatias, agruparPorFase };
