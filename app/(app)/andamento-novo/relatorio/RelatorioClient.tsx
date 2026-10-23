"use client";

import "./relatorio.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Printer, Trash2 } from "lucide-react";
import * as acoesRel from "./acoesRel";
import { BlocoFachada3D } from "./Blocos";
import { Chave, Linha, Seg } from "./controles";
import { ChipsFiltro, PainelFiltros, chipsDeFiltros, normalizarFiltros } from "./Filtros";
import Folha, { dimensoes } from "./Folha";
import PainelFotos from "./PainelFotos";
import PainelMontar from "./PainelMontar";
import Resumo from "./Resumo";
import { bandaFachada, construir, fotosDe, limparMedidas, type Plano, type Resultado } from "./engine";
import { predefinicoesPadrao, type Predefinicao } from "./predefinicoes";
import {
  FILTROS_VAZIOS,
  FORMATO_PADRAO,
  MONTAGEM_NOVA,
  MONTAGEM_PADRAO,
  calcularEscopo,
  montarCtx,
  type Filtros,
  type Formato,
  type FotoRel,
  type FotosSel,
  type Montagem,
  type MontagemSalva,
} from "./modelo";
import { mapaApontamentos, montarIndice, pct } from "../calculo";
import { alvosDeItens, alvosDeLocais, somaRecorte } from "../fatias";
import type { DadosAndamento } from "../types";

const ROTULO_ST = ["Não iniciado", "Andamento", "Finalizado", "Ausência"];
const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Painel = null | "filtros" | "predef" | "formato" | "mont" | "fotos";

export default function RelatorioClient({
  dados,
  salvas,
  montagensIniciais,
  fotos,
  fotosIniciais,
}: {
  dados: DadosAndamento;
  salvas: Predefinicao[];
  montagensIniciais: MontagemSalva[];
  fotos: FotoRel[];
  fotosIniciais: FotosSel;
}) {
  const obra = dados.obra;
  const idx = useMemo(() => montarIndice(dados.categorias, dados.servicos, dados.vinculos), [dados]);
  const ap = useMemo(() => mapaApontamentos(dados.apontamentos), [dados.apontamentos]);
  const ctx = useMemo(() => montarCtx(dados, idx, ap), [dados, idx, ap]);

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [fmt, setFmt] = useState<Formato>(FORMATO_PADRAO);
  const [mon, setMon] = useState<Montagem>(MONTAGEM_PADRAO);
  const [painel, setPainel] = useState<Painel>(null);
  const [minhas, setMinhas] = useState<Predefinicao[]>(salvas);
  const [nomeNova, setNomeNova] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [fotosSimples, setFotosSimples] = useState<FotosSel>(fotosIniciais);
  const [montagens, setMontagens] = useState<MontagemSalva[]>(montagensIniciais);
  const [montId, setMontId] = useState<string | null>(montagensIniciais[0]?.id ?? null);
  const [modoMont, setModoMont] = useState(false);
  const [fotosOrigem, setFotosOrigem] = useState<"simples" | "mont">("simples");
  const [pronto, setPronto] = useState(false);
  const chaveSalva = `an-rel-v3-${obra.id}`;

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
    setPronto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveSalva]);
  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(chaveSalva, JSON.stringify({ filtros, fmt, mon }));
    } catch {}
  }, [chaveSalva, filtros, fmt, mon, pronto]);

  const padroes = useMemo(() => predefinicoesPadrao(ctx), [ctx]);
  const todasPredefs = useMemo(() => [...padroes, ...minhas], [padroes, minhas]);
  const montAtual = montagens.find((m) => m.id === montId) ?? null;
  const emMont = modoMont && !!montAtual;

  // ---------- gravação (com pequena espera) ----------
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const agendar = (chave: string, fn: () => Promise<unknown>) => {
    clearTimeout(timers.current[chave]);
    timers.current[chave] = setTimeout(() => fn().catch((e: any) => setErro(e.message ?? "Não foi possível salvar.")), 700);
  };
  const mudarFotosSimples = (fs: FotosSel) => {
    setFotosSimples(fs);
    agendar("fotos", () => acoesRel.salvarFotosRelatorio(obra.id, fs));
  };
  const mudarMontagem = (m: MontagemSalva) => {
    setMontagens((l) => l.map((x) => (x.id === m.id ? m : x)));
    agendar("m" + m.id, () => acoesRel.atualizarMontagem(m.id, m.nome, m.dados));
  };
  async function novaMontagem(base?: MontagemSalva) {
    try {
      const m = await acoesRel.criarMontagem(obra.id, base ? base.nome + " (cópia)" : "Nova montagem", base ? copia(base.dados) : MONTAGEM_NOVA(fotosSimples));
      setMontagens((l) => [...l, m]);
      setMontId(m.id);
    } catch (e: any) {
      setErro(e.message);
    }
  }
  async function excluirMontagem() {
    if (!montAtual || !window.confirm(`Excluir a montagem "${montAtual.nome}"?`)) return;
    try {
      await acoesRel.excluirMontagem(montAtual.id);
      const resto = montagens.filter((m) => m.id !== montAtual.id);
      setMontagens(resto);
      setMontId(resto[0]?.id ?? null);
      if (!resto.length) setModoMont(false);
    } catch (e: any) {
      setErro(e.message);
    }
  }

  // ---------- o que vai no relatório ----------
  const escopoSimples = useMemo(() => calcularEscopo(ctx, filtros), [ctx, filtros]);
  const escopoResumo = useMemo(() => (emMont ? calcularEscopo(ctx, FILTROS_VAZIOS) : escopoSimples), [ctx, emMont, escopoSimples]);
  const chips = useMemo(() => chipsDeFiltros(ctx, filtros), [ctx, filtros]);

  const plano: Plano = useMemo(
    () =>
      emMont
        ? { titulo: montAtual!.nome, folha: montAtual!.dados.folha, fill: montAtual!.dados.fill, titulos: montAtual!.dados.titulos, resumo: montAtual!.dados.resumo, sumario: montAtual!.dados.sumario, fotos: montAtual!.dados.fotos, fotosLista: fotos, secoes: montAtual!.dados.secoes, esconder: false }
        : { titulo: "", folha: fmt.folha, fill: fmt.fill, titulos: fmt.titulos, resumo: mon.resumo, sumario: false, fotos: fotosSimples, fotosLista: fotos, secoes: [{ nome: "", filtro: filtros, linhas: fmt.linhas, det: fmt.det }], esconder: mon.esconder },
    [emMont, montAtual, fotos, fmt, mon, fotosSimples, filtros]
  );

  const pctEscopo = useMemo(() => {
    const alvos = [...alvosDeLocais(escopoResumo.locais), ...alvosDeItens(escopoResumo.itens)];
    return pct(somaRecorte(ctx.fat, idx, ap, alvos, (s) => escopoResumo.servOk(s)));
  }, [escopoResumo, idx, ap, ctx.fat]);

  // ---------- montagem das folhas (mede no navegador) ----------
  const medRef = useRef<HTMLDivElement>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const chavePlano = useMemo(() => JSON.stringify({ ...plano, fotosLista: fotos.length }) + "|" + dados.apontamentos.length + "|" + obra.id, [plano, fotos.length, dados.apontamentos.length, obra.id]);
  useEffect(() => {
    let vivo = true;
    const rodar = () => {
      if (!vivo || !medRef.current) return;
      limparMedidas();
      try {
        setRes(construir(ctx, plano, medRef.current));
      } catch (e: any) {
        setErro("Não foi possível montar o relatório: " + (e?.message ?? e));
      }
    };
    // espera as fontes assentarem, para as medidas de texto saírem certas
    const f = (document as any).fonts?.ready as Promise<unknown> | undefined;
    if (f) f.then(rodar);
    else rodar();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePlano]);

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
  const dim = dimensoes(plano.folha);
  const escalaTela = Math.min(1, Math.max(0.2, (larguraTela - 4) / dim.w));
  const emitidoEm = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const lista = fotosDe(plano.fotos, fotos);
  const fotosResumo = lista.slice(0, plano.fotos.n);
  const subRel = plano.titulo ? plano.titulo : "Relatório de andamento de obra";

  const folhasRender: React.ReactNode[] = [];
  if (res) {
    const nsec = plano.secoes.length;
    res.seq.forEach((p, i) => {
      const comum = { folha: res.folha, obraNome: obra.nome, emitidoEm, usuario: dados.usuario.nome, numero: p.n, total: res.N };
      if (p.tipo === "resumo") {
        folhasRender.push(
          <Folha key={"p" + i} {...comum} sub={subRel} titulo={escopoResumo.filtrado && !emMont ? "RESUMO DO FILTRO" : "RESUMO DA OBRA"} pct={pctEscopo}>
            <Resumo ctx={ctx} escopo={escopoResumo} largura={res.IN} altura={res.LIVRE} fotos={fotosResumo} fotosMais={Math.max(0, lista.length - plano.fotos.n)} />
          </Folha>
        );
      } else if (p.tipo === "sumario") {
        folhasRender.push(
          <Folha key={"p" + i} {...comum} sub={subRel} titulo="SUMÁRIO" pct={null}>
            <div className="rel-sum">
              {res.sumario.map((l, k) => (
                <div key={k} className="rel-sum-r">
                  <span className="n">{l.n}</span>
                  <div>
                    <b>{l.titulo}</b>
                    <small>{l.sub}</small>
                  </div>
                  <span className="pg">{l.pg}</span>
                </div>
              ))}
            </div>
          </Folha>
        );
      } else if (p.tipo === "fotos") {
        const cols = res.folha === "v" ? 3 : 4;
        folhasRender.push(
          <Folha key={"p" + i} {...comum} sub={subRel} titulo="REGISTRO FOTOGRÁFICO" pct={null}>
            <div className="rel-fotos" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18 }}>
              {p.fotos.map((f) => (
                <figure key={f.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.legenda} />
                  <figcaption>
                    <span>{f.legenda}</span>
                    <small>{f.data}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Folha>
        );
      } else {
        const sub = emMont && nsec > 1 ? `${subRel} · Seção ${p.si + 1} de ${nsec}` : subRel;
        folhasRender.push(
          <Folha key={"p" + i} {...comum} sub={sub} titulo={p.titulo} pct={p.pct} fixa={!p.partes.some((pt) => "fach" in pt)}>
            <div className="rel-tab">
              {p.partes.map((pt, k) =>
                "html" in pt ? (
                  <div key={k} dangerouslySetInnerHTML={{ __html: pt.html }} />
                ) : (
                  <div key={k}>
                    <div dangerouslySetInnerHTML={{ __html: bandaFachada(ctx, pt.fach) }} />
                    <BlocoFachada3D servico={pt.fach.servico} ctx={ctx} largura={res.IN} altura={res.LIVRE - 40} />
                  </div>
                )
              )}
            </div>
          </Folha>
        );
      }
    });
  }

  // ---------- predefinições ----------
  function aplicarPredef(p: Predefinicao) {
    setFiltros(normalizarFiltros(ctx, p.filtros));
    setFmt({ ...FORMATO_PADRAO, ...p.formato });
    setMon({ ...MONTAGEM_PADRAO, ...(p.montagem ? { resumo: p.montagem.resumo ?? true, esconder: p.montagem.esconder ?? false } : {}) });
    setModoMont(false);
    setPainel(null);
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

  // ---------- impressão (quadro oculto só com as folhas; não depende de pop-up) ----------
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
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${obra.nome} — Andamento</title><base href="${location.origin}/">${css}
<style>
@page { size: A3 ${plano.folha === "h" ? "landscape" : "portrait"}; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rel-pilha { display: block !important; zoom: 1 !important; }
.rel-folha { break-after: page; page-break-after: always; margin: 0 !important; box-shadow: none !important; }
.rel-folha:last-child { break-after: auto; page-break-after: auto; }
</style></head><body>${pilha.outerHTML}</body></html>`);
    doc.close();
    const disparar = () => {
      // espera as fotos carregarem antes de imprimir
      const imgs = Array.from(doc.images);
      const pendentes = imgs.filter((i) => !i.complete);
      const fim = () =>
        setTimeout(() => {
          janela.focus();
          janela.print();
          setTimeout(() => quadro.remove(), 60000);
        }, 500);
      if (!pendentes.length) return fim();
      let falta = pendentes.length;
      const um = () => --falta <= 0 && fim();
      pendentes.forEach((i) => {
        i.addEventListener("load", um);
        i.addEventListener("error", um);
      });
      setTimeout(fim, 8000);
    };
    if (doc.readyState === "complete") disparar();
    else quadro.onload = disparar;
  }

  // ---------- CSV (segue os filtros) ----------
  function exportarCSV() {
    const linhas: string[][] = [["Pavimento / Sistema", "Local / Item", "Categoria", "Fase", "Serviço", "Status", "Observação"]];
    const faseNome = (s: { fase_id: string | null; grupo: string }) => (s.fase_id && ctx.faseOrdem.get(s.fase_id)?.nome) || s.grupo;
    const emitir = (onde: string, alvoId: string, alvoNome: string, catId: string) => {
      const cat = idx.catPorId.get(catId);
      (idx.servicosDaCat.get(catId) ?? []).forEach(({ servico }) => {
        if (!escopoSimples.servOk(servico)) return;
        const a = ap.get(alvoId + "|" + servico.id);
        linhas.push([onde, alvoNome, cat?.nome ?? "", faseNome(servico), servico.nome, ROTULO_ST[a?.status ?? 0], a?.observacao ?? ""]);
      });
    };
    escopoSimples.locais.forEach((l) => emitir(ctx.pavPorId.get(l.pavimento_id)?.nome ?? "", l.id, l.nome, l.categoria_id));
    escopoSimples.itens.forEach((i) => emitir(ctx.sisPorId.get(i.sistema_id)?.nome ?? "", i.id, i.nome, i.categoria_id));
    const csv = linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `andamento-${obra.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const qtdFiltros = chips.length;
  const botao = (id: Exclude<Painel, null>, texto: React.ReactNode) => (
    <button className={`text-sm px-3 py-1.5 border rounded-md flex items-center gap-1 ${painel === id ? "bg-primary/10 border-primary" : "border-border bg-white"}`} onClick={() => setPainel(painel === id ? null : id)} aria-expanded={painel === id}>
      {texto} <ChevronDown className="w-3.5 h-3.5" />
    </button>
  );
  const donoFotos = fotosOrigem === "mont" && montAtual ? `montagem "${montAtual.nome}"` : "relatório simples desta obra";
  const fsPainel = fotosOrigem === "mont" && montAtual ? montAtual.dados.fotos : fotosSimples;
  const mudarFsPainel = (fs: FotosSel) => (fotosOrigem === "mont" && montAtual ? mudarMontagem({ ...montAtual, dados: { ...montAtual.dados, fotos: fs } }) : mudarFotosSimples(fs));

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
          {!emMont && botao("filtros", <>Filtrar{qtdFiltros ? ` (${qtdFiltros})` : ""}</>)}
          {!emMont && (
            <div className="relative">
              {botao("predef", "Predefinições")}
              {painel === "predef" && (
                <div className="absolute z-30 mt-1 w-72 bg-white border border-border rounded-lg shadow-panel p-2 max-h-96 overflow-auto">
                  {todasPredefs.length === 0 && <p className="text-xs text-ink-500 px-2 py-1.5">Nenhuma predefinição ainda. Monte os filtros e salve abaixo.</p>}
                  {todasPredefs.map((p) => (
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
          )}
          {!emMont && botao("formato", "Formatação")}
          {botao("mont", "Montar relatório")}
          <button
            className={`text-sm px-3 py-1.5 border rounded-md flex items-center gap-1 ${painel === "fotos" ? "bg-primary/10 border-primary" : "border-border bg-white"}`}
            onClick={() => {
              setFotosOrigem(emMont ? "mont" : "simples");
              setPainel(painel === "fotos" ? null : "fotos");
            }}
            aria-expanded={painel === "fotos"}
          >
            Fotos do resumo <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {!emMont && (
            <div className="flex-1 min-w-[200px]">
              <ChipsFiltro chips={chips} onRemover={(g) => setFiltros(normalizarFiltros(ctx, { ...filtros, [g]: [] }))} onLimpar={() => setFiltros(FILTROS_VAZIOS)} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {!emMont && <Chave ligada={mon.resumo} onChange={(v) => setMon((m0) => ({ ...m0, resumo: v }))} texto="Página de resumo" />}
          {!emMont && <Chave ligada={mon.esconder} onChange={(v) => setMon((m0) => ({ ...m0, esconder: v }))} texto="Esconder o que não começou" />}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-500">
              {res
                ? `${res.N} página${res.N === 1 ? "" : "s"} · A3 ${res.folha === "h" ? "horizontal · 420 × 297" : "vertical · 297 × 420"} mm · tabelas a ${Math.round(res.k * 100)}% · células de ${Math.round(res.cw[0]) === Math.round(res.cw[1]) ? Math.round(res.cw[0]) : `${Math.round(res.cw[0])} a ${Math.round(res.cw[1])}`} px`
                : "montando…"}
            </span>
            {!emMont && (
              <button onClick={exportarCSV} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm bg-white">
                <Download className="w-4 h-4" /> CSV
              </button>
            )}
            <button onClick={imprimir} disabled={!res} className="flex items-center gap-1.5 px-3 py-2 bg-accent text-primaryDark font-semibold rounded-lg text-sm disabled:opacity-50">
              <Printer className="w-4 h-4" /> Gerar PDF (A3)
            </button>
          </div>
        </div>

        {painel === "formato" && !emMont && (
          <div className="space-y-2.5 border-t border-border pt-3">
            <Linha titulo="Folha">
              <Seg valor={fmt.folha} onChange={(v) => setFmt((f0) => ({ ...f0, folha: v }))} opcoes={[["v", "▯ Vertical"], ["h", "▭ Horizontal"]]} />
            </Linha>
            <Linha titulo="Nas linhas da tabela">
              <Seg valor={fmt.linhas} onChange={(v) => setFmt((f0) => ({ ...f0, linhas: v }))} opcoes={[["local", "Pavimentos e locais"], ["serv", "Serviços"]]} />
            </Linha>
            <Linha titulo="Títulos das colunas">
              <Seg valor={fmt.titulos} onChange={(v) => setFmt((f0) => ({ ...f0, titulos: v }))} opcoes={[["h", "Horizontal"], ["v", "Vertical"]]} />
            </Linha>
            <Linha titulo="Apartamentos e locais">
              <Seg valor={fmt.det} onChange={(v) => setFmt((f0) => ({ ...f0, det: v }))} opcoes={[["un", "Um por um"], ["ju", "Juntos por pavimento"]]} />
            </Linha>
            <Linha titulo="Tamanho">
              <Seg valor={fmt.fill ? "s" : "n"} onChange={(v) => setFmt((f0) => ({ ...f0, fill: v === "s" }))} opcoes={[["s", "Estender até ocupar a folha"], ["n", "Manter tamanho normal"]]} />
            </Linha>
            <p className="text-xs text-ink-500">As células têm sempre o mesmo tamanho e a escala é uma só para o relatório inteiro. "Estender" aumenta até a maior escala que ainda deixa cada bloco inteiro numa folha e alarga as colunas até a margem.</p>
          </div>
        )}

        {painel === "mont" && (
          <PainelMontar
            ctx={ctx}
            montagens={montagens}
            atualId={montId}
            predefs={todasPredefs}
            filtroAtual={filtros}
            fmtAtual={fmt}
            emPrevia={emMont}
            onSelecionar={(id) => setMontId(id)}
            onNova={() => novaMontagem()}
            onDuplicar={() => montAtual && novaMontagem(montAtual)}
            onExcluir={excluirMontagem}
            onMudar={mudarMontagem}
            onPrevia={() => {
              setModoMont(true);
              setPainel(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onSairPrevia={() => {
              setModoMont(false);
              setPainel(null);
            }}
            onEscolherFotos={() => {
              setFotosOrigem("mont");
              setPainel("fotos");
            }}
          />
        )}

        {painel === "fotos" && <PainelFotos fotos={fotos} fs={fsPainel} onChange={mudarFsPainel} dono={donoFotos} />}
      </div>

      {painel === "filtros" && !emMont && <PainelFiltros ctx={ctx} filtros={filtros} onChange={setFiltros} onFechar={() => setPainel(null)} />}

      {emMont && montAtual && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e9c868] px-4 py-2.5 text-sm print:hidden" style={{ background: "#fbf3d7" }}>
          <span>
            Prévia da montagem <b>{montAtual.nome}</b>
          </span>
          <span className="flex-1" />
          <button className="text-xs px-2.5 py-1 border border-border rounded-md bg-white" onClick={() => setPainel("mont")}>
            Editar montagem
          </button>
          <button className="text-xs px-2.5 py-1 border border-border rounded-md bg-white" onClick={() => setModoMont(false)}>
            Voltar ao relatório simples
          </button>
        </div>
      )}

      {/* prévia das folhas */}
      <div ref={larguraRef} className="w-full">
        {!res ? (
          <div className="card text-sm text-ink-500">Montando o relatório…</div>
        ) : folhasRender.length === 0 ? (
          <div className="card text-sm text-ink-500">Nada para mostrar com estes filtros.</div>
        ) : (
          <div style={{ zoom: escalaTela }}>
            <div ref={pilhaRef} className="rel-pilha" style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" }}>
              {folhasRender}
            </div>
          </div>
        )}
      </div>

      {/* área de medição das tabelas (fora da tela) */}
      <div ref={medRef} aria-hidden className="rel-tab rel-meas" />
    </div>
  );
}
