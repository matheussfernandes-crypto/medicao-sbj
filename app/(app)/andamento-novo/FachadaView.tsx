"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Minus, Plus, X } from "lucide-react";
import * as acoes from "./acoesAndamento";
import Grade, { type LinhaGrade } from "./Grade";
import Predio3D, { NOME_FACE, NOME_PARTE, type Destaque, type Face, type Parte } from "./Predio3D";
import { Barra, BotoesStatus, Legenda, fmtPct, fmtPct0 } from "./ui";
import { acumular, chaveAp, COR_STATUS, pct, somaZero, somarAlvo, type Indice, type Soma } from "./calculo";
import { calcularNiveis, chaveItemFachada, descidasDoServico, itensDoServico, mapaItensFachada } from "./fachada";
import type { Apontamento, DadosAndamento, Local, Pavimento, Sistema, SistemaItem, Status } from "./types";

type Props = {
  dados: DadosAndamento;
  idx: Indice;
  ap: Map<string, Apontamento>;
  sistema: Sistema;
  itens: SistemaItem[];
  pavs: Pavimento[];
  locaisPorPav: Map<string, Local[]>;
  soma: Soma;
  podeApontar: boolean;
  aplicar: (cels: { alvo: string; servico: string }[], status: Status) => void;
  modoSel: boolean;
  alternarModoSel: () => void;
  sel: Set<string>;
  setSel: (s: Set<string>) => void;
  abrirCelula: (e: React.MouseEvent, alvoId: string, servicoId: string) => void;
  somaPorAlvo: Map<string, Soma>;
};

const FACES: Face[] = ["N", "S", "L", "O"];
const PARTES: Parte[] = ["emb", "tor", "res"];

export default function FachadaView(p: Props) {
  const router = useRouter();
  const { idx, ap, sistema, itens, pavs, locaisPorPav } = p;
  const cat = p.dados.categorias.find((c) => c.chave === "fach");
  const servicos = useMemo(() => (cat ? (idx.servicosDaCat.get(cat.id) ?? []).map((x) => x.servico) : []), [cat, idx]);
  const [servId, setServId] = useState<string>(() => servicos.find((s) => s.nome === "Reboco externo")?.id ?? servicos[0]?.id ?? "");
  const [foco, setFoco] = useState<string | null>(null);
  const [abre3d, setAbre3d] = useState(true);
  const [abreFluxo, setAbreFluxo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modoLista, setModoLista] = useState(false);
  const [lp, setLp] = useState<Parte>("tor");
  const [lf, setLf] = useState<Face>("N");
  const [ld, setLd] = useState(1);
  useEffect(() => {
    if (window.innerWidth < 760) setModoLista(true);
  }, []);

  const niveis = useMemo(() => calcularNiveis(pavs, locaisPorPav, idx), [pavs, locaisPorPav, idx]);
  // cada serviço da fachada tem as suas descidas e os seus trechos (descida × pavimento)
  const descidas = useMemo(() => descidasDoServico(sistema, servId), [sistema, servId]);
  const itensServ = useMemo(() => itensDoServico(itens, servId), [itens, servId]);
  const porChave = useMemo(() => mapaItensFachada(itensServ), [itensServ]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const serv = servicos.find((s) => s.id === servId);
  const [copiarDe, setCopiarDe] = useState("");
  useEffect(() => setFoco(null), [servId]);

  const statusDe = (itemId: string, sid: string) => (ap.get(chaveAp(itemId, sid))?.status ?? 0) as Status;
  const itemDe = (parte: Parte, face: Face, d: number, nivelId: string) => porChave.get(chaveItemFachada(parte, face, d, nivelId));

  const cor = (parte: Parte, face: Face, d: number, nivelId: string) => {
    const it = itemDe(parte, face, d, nivelId);
    return it && serv ? COR_STATUS[statusDe(it.id, serv.id)] : "#e3e7e9";
  };
  const destaque = (parte: Parte, face: Face, d: number, nivelId: string): Destaque => {
    const it = itemDe(parte, face, d, nivelId);
    if (!it) return null;
    if (p.modoSel) return serv && p.sel.has(chaveAp(it.id, serv.id)) ? "sel" : null;
    return foco === it.id ? "foco" : null;
  };
  const clicarCelula = (parte: Parte, face: Face, d: number, nivelId: string) => {
    const it = itemDe(parte, face, d, nivelId);
    if (!it || !serv) return;
    if (p.modoSel) {
      const k = chaveAp(it.id, serv.id);
      const prox = new Set(p.sel);
      prox.has(k) ? prox.delete(k) : prox.add(k);
      p.setSel(prox);
    } else setFoco(it.id);
  };
  // clique no nome de um pavimento (só no modo Selecionar várias): marca aquele andar em todas as fachadas
  const clicarNivel = (nivelId: string) => {
    if (!p.modoSel || !serv) return;
    const chaves = itensServ.filter((i) => (i.pavimento_id ?? "res") === nivelId).map((i) => chaveAp(i.id, serv.id));
    const todas = chaves.length > 0 && chaves.every((k) => p.sel.has(k));
    const prox = new Set(p.sel);
    chaves.forEach((k) => (todas ? prox.delete(k) : prox.add(k)));
    p.setSel(prox);
  };

  // % do serviço por fachada e por parte
  const { porFace, porParte } = useMemo(() => {
    const pf: Record<Face, Soma> = { N: somaZero(), S: somaZero(), L: somaZero(), O: somaZero() };
    const pp: Record<Parte, Soma> = { emb: somaZero(), tor: somaZero(), res: somaZero() };
    if (serv)
      itensServ.forEach((i) => {
        if (!i.face || !i.parte) return;
        const st = statusDe(i.id, serv.id);
        acumular(pf[i.face], 1, st);
        acumular(pp[i.parte], 1, st);
      });
    return { porFace: pf, porParte: pp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensServ, serv, ap]);

  async function mudarDescidas(parte: Parte, face: Face, n: number) {
    try {
      await acoes.definirDescidas(sistema.id, servId, parte, face, Math.max(0, Math.min(40, n)));
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }
  async function copiarDescidas() {
    if (!copiarDe || copiarDe === servId) return;
    try {
      await acoes.copiarDescidas(sistema.id, copiarDe, servId);
      setCopiarDe("");
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    }
  }

  if (!cat || !servicos.length) return <div className="card text-sm text-ink-500">A categoria "Fachada – descida" não tem serviços. Configure em "Pavimentos e serviços".</div>;

  const itemFoco = foco ? itemPorId.get(foco) : null;
  const linhasFluxo: LinhaGrade[] = itensServ.map((i) => ({ alvoId: i.id, rotulo: i.nome }));

  const botaoSel = (
    <button
      type="button"
      onClick={p.alternarModoSel}
      disabled={!p.podeApontar}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border ${p.modoSel ? "bg-primaryDark text-white border-primaryDark" : "bg-white border-border text-ink-700"}`}
    >
      {p.modoSel ? <X className="w-3.5 h-3.5" /> : null}
      {p.modoSel ? "Sair da seleção" : "☐ Selecionar várias"}
    </button>
  );

  return (
    <div className="space-y-3">
      {erro && <div className="card bg-red-50 border-red-200 text-danger text-sm">{erro}</div>}
      <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-3 min-w-0">
          <div className="card">
            <button className="flex items-center gap-2 w-full text-left" onClick={() => setAbre3d((v) => !v)}>
              {abre3d ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <h2 className="font-semibold text-primaryDark">Prédio em 3D</h2>
              <span className="text-xs text-ink-500">{fmtPct(pct(p.soma))}% da fachada</span>
            </button>
            {abre3d && modoLista && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-ink-500">
                    Parte
                    <select value={lp} onChange={(e) => { setLp(e.target.value as Parte); setLd(1); }} className="w-full h-12 border border-border rounded-lg px-2 text-base bg-white">
                      {PARTES.map((pt) => (
                        <option key={pt} value={pt}>{NOME_PARTE[pt]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-ink-500">
                    Fachada
                    <select value={lf} onChange={(e) => { setLf(e.target.value as Face); setLd(1); }} className="w-full h-12 border border-border rounded-lg px-2 text-base bg-white">
                      {FACES.map((f2) => (
                        <option key={f2} value={f2}>{NOME_FACE[f2]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-ink-500">
                    Descida
                    <select value={Math.min(ld, Math.max(1, descidas[lp][lf]))} onChange={(e) => setLd(parseInt(e.target.value, 10))} className="w-full h-12 border border-border rounded-lg px-2 text-base bg-white">
                      {Array.from({ length: Math.max(1, descidas[lp][lf]) }, (_, i) => (
                        <option key={i + 1} value={i + 1}>D{i + 1}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-ink-500">
                    Serviço
                    <select value={servId} onChange={(e) => setServId(e.target.value)} className="w-full h-12 border border-border rounded-lg px-2 text-base bg-white">
                      {servicos.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-[11px] text-ink-500">Os pavimentos desta descida, de cima para baixo (como o balancim desce).</p>
                {niveis[lp].map((nv) => {
                  const it = itemDe(lp, lf, Math.min(ld, Math.max(1, descidas[lp][lf])), nv.id);
                  if (!it || !serv) return null;
                  const st = statusDe(it.id, serv.id);
                  return (
                    <div key={nv.id} className="bg-white border border-border rounded-lg p-3" style={{ borderLeft: `6px solid ${st === 3 ? "#cbd5e1" : COR_STATUS[st]}` }}>
                      <p className="font-medium text-sm mb-2">{lp === "res" ? "Reservatório" : nv.nome}</p>
                      <BotoesStatus grande atual={st} incluirAusencia={false} onSet={(s2) => p.aplicar([{ alvo: it.id, servico: serv.id }], s2)} />
                    </div>
                  );
                })}
                <button className="text-xs underline text-primary" onClick={() => setModoLista(false)}>Ver o prédio em 3D</button>
              </div>
            )}
            {abre3d && !modoLista && (
              <div className="mt-3">
                <button className="text-xs underline text-primary mb-2 md:hidden" onClick={() => setModoLista(true)}>Usar a lista (celular)</button>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <label className="text-xs text-ink-500">
                    Serviço
                    <select value={servId} onChange={(e) => setServId(e.target.value)} className="ml-2 border border-border rounded-md px-2 py-1 text-sm bg-white">
                      {servicos.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Legenda />
                  <div className="ml-auto">{botaoSel}</div>
                </div>
                {p.modoSel && <p className="text-xs text-ink-500 mb-2">Cada clique marca ou desmarca a célula. Clique no nome de um pavimento para marcar o andar em todas as fachadas.</p>}
                <div className="grid md:grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs font-semibold text-center text-primaryDark">Vista Norte + Leste</p>
                    <Predio3D vista="NE" descidas={descidas} niveis={niveis} cor={cor} destaque={destaque} onCelula={clicarCelula} onNivel={clicarNivel} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-center text-primaryDark">Vista Sul + Oeste</p>
                    <Predio3D vista="SW" descidas={descidas} niveis={niveis} cor={cor} destaque={destaque} onCelula={clicarCelula} onNivel={clicarNivel} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <button className="flex items-center gap-2 w-full text-left" onClick={() => setAbreFluxo((v) => !v)}>
              {abreFluxo ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <h2 className="font-semibold text-primaryDark">Fluxograma das descidas</h2>
              <span className="text-xs text-ink-500">{itensServ.length} trechos de {serv?.nome}</span>
            </button>
            {abreFluxo && (
              <div className="mt-3">
                <Grade linhas={linhasFluxo} colunas={serv ? [serv] : servicos} ap={ap} somaPorAlvo={p.somaPorAlvo} modoSel={p.modoSel} sel={p.sel} setSel={p.setSel} onCelula={p.abrirCelula} tituloLinha="Descida" />
              </div>
            )}
          </div>
        </div>

        {/* painel fixo à direita (não cobre o desenho) */}
        <div className="space-y-3 xl:sticky xl:top-2">
          {itemFoco && !p.modoSel && (
            <div className="card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-[11px] uppercase text-ink-500">Célula selecionada</p>
                  <p className="font-semibold text-primaryDark text-sm">{itemFoco.nome}</p>
                </div>
                <button onClick={() => setFoco(null)} className="text-xs px-2 py-1 border border-border rounded-md">
                  Fechar
                </button>
              </div>
              <div className="space-y-3">
                {(serv ? [serv] : []).map((s) => (
                  <div key={s.id}>
                    <p className="text-xs font-medium mb-1">{s.nome}</p>
                    <BotoesStatus atual={statusDe(itemFoco.id, s.id)} onSet={(st) => p.aplicar([{ alvo: itemFoco.id, servico: s.id }], st)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-sm font-semibold text-primaryDark mb-2">{serv?.nome} por fachada</h3>
            <div className="space-y-1.5">
              {FACES.map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs">
                  <span className="w-12">{NOME_FACE[f]}</span>
                  <div className="flex-1">
                    <Barra s={porFace[f]} h={9} />
                  </div>
                  <b className="w-10 text-right tabular-nums">{fmtPct0(pct(porFace[f]))}%</b>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-border flex gap-3 text-xs text-ink-500 flex-wrap">
              {PARTES.map((pt) => (
                <span key={pt}>
                  {NOME_PARTE[pt]}: <b className="text-ink-900">{fmtPct0(pct(porParte[pt]))}%</b>
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-primaryDark mb-1">Descidas por fachada</h3>
            <label className="block text-[11px] text-ink-500 mb-2">
              Serviço
              <select value={servId} onChange={(e) => setServId(e.target.value)} className="mt-0.5 w-full border border-border rounded-md px-2 py-1 text-sm bg-white text-ink-900">
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-ink-500 mb-2">Cada serviço tem as suas descidas de balancim (nº por parte e fachada). O desenho e os trechos só deste serviço se atualizam; os apontamentos que continuam existindo são mantidos.</p>
            {servicos.length > 1 && p.podeApontar && (
              <div className="flex items-center gap-1.5 mb-2">
                <select value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)} className="flex-1 min-w-0 border border-border rounded-md px-2 py-1 text-xs bg-white">
                  <option value="">Copiar descidas de…</option>
                  {servicos
                    .filter((s) => s.id !== servId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                </select>
                <button className="text-xs px-2 py-1 border border-border rounded-md bg-white disabled:opacity-50" disabled={!copiarDe} onClick={copiarDescidas}>
                  Copiar
                </button>
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="pb-1" />
                  {PARTES.map((pt) => (
                    <th key={pt} className="pb-1 text-center font-medium">
                      {NOME_PARTE[pt]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FACES.map((f) => (
                  <tr key={f} className="border-t border-border/60">
                    <td className="py-1 font-medium">{NOME_FACE[f]}</td>
                    {PARTES.map((pt) => (
                      <td key={pt} className="py-1 text-center">
                        <span className="inline-flex items-center gap-0.5">
                          <button disabled={!p.podeApontar} className="w-5 h-5 border border-border rounded flex items-center justify-center" onClick={() => mudarDescidas(pt, f, descidas[pt][f] - 1)}>
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            key={descidas[pt][f]}
                            defaultValue={descidas[pt][f]}
                            disabled={!p.podeApontar}
                            inputMode="numeric"
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (Number.isFinite(v) && v !== descidas[pt][f]) mudarDescidas(pt, f, v);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            className="w-8 text-center border border-border rounded py-0.5 tabular-nums"
                          />
                          <button disabled={!p.podeApontar} className="w-5 h-5 border border-border rounded flex items-center justify-center" onClick={() => mudarDescidas(pt, f, descidas[pt][f] + 1)}>
                            <Plus className="w-3 h-3" />
                          </button>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
