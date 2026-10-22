"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Printer } from "lucide-react";
import Folha, { dimensoes } from "../relatorio/Folha";
import { BlocoFachada3D, BlocoFachadaTabela } from "../relatorio/Blocos";
import { ChipsFiltro, PainelFiltros, chipsDeFiltros, normalizarFiltros } from "../relatorio/Filtros";
import Resumo from "../relatorio/Resumo";
import { LegendaRodape, MatrizOtim, geometria, montarAmbientes, montarFolhasOtimizadas, tituloFolhaOtim } from "../relatorio/otimizado";
import { FILTROS_VAZIOS, FORMATO_PADRAO, MONTAGEM_PADRAO, calcularEscopo, montarBlocos, montarCtx, status as statusDe, type Filtros, type Formato, type Montagem } from "../relatorio/modelo";
import { acumular, mapaApontamentos, montarIndice, pct, somaZero } from "../calculo";
import type { DadosAndamento } from "../types";

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

export default function OtimizadoClient({ dados }: { dados: DadosAndamento }) {
  const obra = dados.obra;
  const idx = useMemo(() => montarIndice(dados.categorias, dados.servicos, dados.vinculos), [dados]);
  const ap = useMemo(() => mapaApontamentos(dados.apontamentos), [dados.apontamentos]);
  const ctx = useMemo(() => montarCtx(dados, idx, ap), [dados, idx, ap]);

  // mesmos filtros e opções do relatório atual (guardados no navegador, por obra)
  const chaveSalva = `an-rel-v2-${obra.id}`;
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [fmt, setFmt] = useState<Formato>(FORMATO_PADRAO);
  const [mon, setMon] = useState<Montagem>(MONTAGEM_PADRAO);
  const [menu, setMenu] = useState<null | "filtros">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(chaveSalva) ?? "null");
      if (r) {
        setFiltros(normalizarFiltros(ctx, { ...FILTROS_VAZIOS, ...r.filtros }));
        setFmt({ ...FORMATO_PADRAO, ...r.fmt });
        setMon({ ...MONTAGEM_PADRAO, ...r.mon });
      }
    } catch {}
    setPronto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveSalva]);
  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(chaveSalva, JSON.stringify({ filtros, fmt, mon }));
    } catch {}
  }, [chaveSalva, filtros, fmt, mon, pronto]);

  const escopo = useMemo(() => calcularEscopo(ctx, filtros), [ctx, filtros]);
  const dim = dimensoes(fmt.folha);
  const chips = useMemo(() => chipsDeFiltros(ctx, filtros), [ctx, filtros]);
  const textoFiltros = chips.map((c) => c.texto).join(" · ");

  const pctEscopo = useMemo(() => {
    const s = somaZero();
    const somar = (alvo: string, catId: string) => (idx.servicosDaCat.get(catId) ?? []).forEach(({ servico, peso }) => escopo.servOk(servico) && acumular(s, peso, statusDe(ap, alvo, servico.id)));
    escopo.locais.forEach((l) => somar(l.id, l.categoria_id));
    escopo.itens.forEach((i) => somar(i.id, i.categoria_id));
    return pct(s);
  }, [escopo, idx, ap]);

  const ambientes = useMemo(() => montarAmbientes(ctx, escopo, mon), [ctx, escopo, mon]);
  const fachadas = useMemo(() => montarBlocos(ctx, escopo, fmt, mon).filter((b) => b.tipo === "fachada" || b.tipo === "fachada-tab") as any[], [ctx, escopo, fmt, mon]);
  const geo = useMemo(() => geometria(dim.larguraUtil, dim.alturaUtil, ambientes), [dim.larguraUtil, dim.alturaUtil, ambientes]);
  const folhas = useMemo(() => montarFolhasOtimizadas(ambientes, fachadas, geo), [ambientes, fachadas, geo]);

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
  const totalPaginas = (mon.resumo ? 1 : 0) + folhas.length;
  const legenda = <LegendaRodape />;

  const folhasRender: React.ReactNode[] = [];
  let numero = 0;
  if (mon.resumo) {
    numero++;
    folhasRender.push(
      <Folha key="resumo" folha={fmt.folha} obraNome={obra.nome} titulo={escopo.filtrado ? "Resumo do filtro" : "Resumo da obra"} filtros={textoFiltros || undefined} pct={pctEscopo} emitidoEm={emitidoEm} usuario={dados.usuario.nome} numero={numero} total={totalPaginas} legenda={legenda}>
        <Resumo ctx={ctx} escopo={escopo} fmt={fmt} largura={dim.larguraUtil} altura={dim.alturaUtil} />
      </Folha>
    );
  }
  folhas.forEach((f, fi) => {
    numero++;
    const fachada = f.itens[0]?.tipo === "fachada" ? f.itens[0] : null;
    folhasRender.push(
      <Folha
        key={"f" + fi}
        folha={fmt.folha}
        obraNome={obra.nome}
        titulo={fachada ? "Fachada" : tituloFolhaOtim(f)}
        filtros={textoFiltros || undefined}
        pct={pctEscopo}
        emitidoEm={emitidoEm}
        usuario={dados.usuario.nome}
        numero={numero}
        total={totalPaginas}
        primeiraSemResumo={!mon.resumo && fi === 0}
        fixa={!fachada}
        legenda={legenda}
      >
        {fachada ? (
          fachada.bloco.tipo === "fachada" ? (
            <BlocoFachada3D bloco={fachada.bloco} ctx={ctx} largura={dim.larguraUtil} altura={dim.alturaUtil} />
          ) : (
            <BlocoFachadaTabela bloco={fachada.bloco} ctx={ctx} fmt={fmt} />
          )
        ) : (
          f.itens.map((it, k) => (it.tipo === "matriz" ? <MatrizOtim key={k} item={it} ctx={ctx} g={geo} /> : null))
        )}
      </Folha>
    );
  });

  // ---------- impressão (quadro oculto só com as folhas) ----------
  const pilhaRef = useRef<HTMLDivElement>(null);
  function imprimir() {
    const pilha = pilhaRef.current;
    if (!pilha) return;
    const css = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join("\n");
    const quadro = document.createElement("iframe");
    quadro.setAttribute("aria-hidden", "true");
    quadro.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(quadro);
    const doc = quadro.contentDocument;
    const janela = quadro.contentWindow;
    if (!doc || !janela) {
      quadro.remove();
      setErro("Não foi possível preparar a impressão neste navegador.");
      return;
    }
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${obra.nome} — Andamento (modelo otimizado)</title><base href="${location.origin}/">${css}
<style>
@page { size: A3 ${fmt.folha === "h" ? "landscape" : "portrait"}; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rel-pilha { display: block !important; zoom: 1 !important; }
.rel-folha { break-after: page; page-break-after: always; margin: 0 !important; box-shadow: none !important; }
.rel-folha:last-child { break-after: auto; page-break-after: auto; }
</style></head><body>${pilha.outerHTML}</body></html>`);
    doc.close();
    const disparar = () =>
      setTimeout(() => {
        janela.focus();
        janela.print();
        setTimeout(() => quadro.remove(), 60000);
      }, 700);
    if (doc.readyState === "complete") disparar();
    else quadro.onload = disparar;
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

      <div className="card space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/andamento-novo/relatorio?obra=${obra.id}`} className="text-sm px-3 py-1.5 border border-border rounded-md flex items-center gap-1 bg-white">
            <ArrowLeft className="w-3.5 h-3.5" /> Relatório atual
          </Link>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/60 text-primaryDark">Modelo otimizado</span>
          <button className={`text-sm px-3 py-1.5 border rounded-md flex items-center gap-1 ${menu === "filtros" ? "bg-primary/10 border-primary" : "border-border bg-white"}`} onClick={() => setMenu(menu === "filtros" ? null : "filtros")}>
            Filtrar{qtdFiltros ? ` (${qtdFiltros})` : ""} <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-[200px]">
            <ChipsFiltro chips={chips} onRemover={(g) => setFiltros(normalizarFiltros(ctx, { ...filtros, [g]: [] }))} onLimpar={() => setFiltros(FILTROS_VAZIOS)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Seg valor={fmt.folha} onChange={(v) => setFmt((f0) => ({ ...f0, folha: v }))} opcoes={[["h", "A3 Horizontal"], ["v", "A3 Vertical"]]} />
          <Seg valor={fmt.fachada} onChange={(v) => setFmt((f0) => ({ ...f0, fachada: v }))} opcoes={[["3d", "Fachada 3D grande"], ["tab", "Fachada em tabela"]]} />
          <Chave ligada={mon.esconder} onChange={(v) => setMon((m0) => ({ ...m0, esconder: v }))} texto="Esconder o que não começou" />
          <Chave ligada={mon.resumo} onChange={(v) => setMon((m0) => ({ ...m0, resumo: v }))} texto="Página de resumo" />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-500">
              {totalPaginas} página{totalPaginas === 1 ? "" : "s"} · A3 {fmt.folha === "h" ? "horizontal" : "vertical"} · células de 5,5 mm
            </span>
            <button onClick={imprimir} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm">
              <Printer className="w-4 h-4" /> Imprimir / salvar PDF (A3)
            </button>
          </div>
        </div>
      </div>

      {menu === "filtros" && <PainelFiltros ctx={ctx} filtros={filtros} onChange={setFiltros} onFechar={() => setMenu(null)} />}

      <div ref={larguraRef} className="w-full">
        {!folhasRender.length ? (
          <div className="card text-sm text-ink-500">Nada para mostrar com estes filtros.</div>
        ) : (
          <div style={{ zoom: escalaTela }}>
            <div ref={pilhaRef} className="rel-pilha" style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" }}>
              {folhasRender}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
