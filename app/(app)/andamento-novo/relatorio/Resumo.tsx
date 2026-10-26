"use client";

import { useMemo } from "react";
import { COR_STATUS, acumular, partes, pct, somaZero, type Soma } from "../calculo";
import { alvosDeItens, alvosDeLocais, somaRecorte, type AlvoR } from "../fatias";
import { calcularNiveis, chaveItemFachada, descidasDoServico, itensDoServico, mapaItensFachada } from "../fachada";
import Predio3D, { NOME_FACE, NOME_PARTE, type Face, type Parte } from "../Predio3D";
import { Barra, fmtPct, fmtPct0 } from "../ui";
import { agruparPorFase, status, type Ctx, type Escopo, type FotoRel } from "./modelo";
import type { Servico, Sistema } from "../types";

const VERDE = COR_STATUS[2];
const LARANJA = COR_STATUS[1];

function Quadro({ titulo, children, className = "" }: { titulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-white p-3 ${className}`} style={{ breakInside: "avoid" }}>
      <h3 className="font-semibold text-[13px] mb-2" style={{ color: "#1f4a52" }}>
        {titulo}
      </h3>
      {children}
    </div>
  );
}

function Rosca({ s, tam = 130 }: { s: Soma; tam?: number }) {
  const p = partes(s);
  const r = 50;
  const c = 2 * Math.PI * r;
  const fin = (Math.min(100, p.fin) / 100) * c;
  const and = (Math.min(100 - Math.min(100, p.fin), p.and) / 100) * c;
  return (
    <svg viewBox="0 0 130 130" width={tam} height={tam} style={{ flexShrink: 0 }}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="#e3e7e9" strokeWidth="16" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={LARANJA} strokeWidth="16" strokeDasharray={`${fin + and} ${c}`} transform="rotate(-90 65 65)" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={VERDE} strokeWidth="16" strokeDasharray={`${fin} ${c}`} transform="rotate(-90 65 65)" />
      <text x="65" y="66" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1f4a52">
        {fmtPct0(pct(s))}%
      </text>
      <text x="65" y="83" textAnchor="middle" fontSize="10" fill="#65707d">
        concluído
      </text>
    </svg>
  );
}

const BarraLinha = ({ nome, s, cor }: { nome: string; s: Soma; cor?: string }) => (
  <div className="flex items-center gap-2 text-[12px] mb-1">
    <span style={{ width: 96 }} className="truncate">
      {nome}
    </span>
    <div className="flex-1">
      <Barra s={s} h={9} cor={cor} />
    </div>
    <b style={{ width: 38, textAlign: "right" }}>{fmtPct0(pct(s))}%</b>
  </div>
);

const DIA = 86400000;
const parseData = (v: string | null) => (v ? new Date(v + "T00:00:00") : null);

type Etapa = { nome: string; s: Soma; tem: boolean };

// fotos escolhidas na aba Fotos: 4 (ou 6) lado a lado, altura fixa, legenda à esquerda e data à direita
function FotosResumo({ fotos, mais, vertical }: { fotos: FotoRel[]; mais: number; vertical: boolean }) {
  if (!fotos.length) return null;
  const n = fotos.length;
  const colunas = vertical && n <= 4 ? Math.min(4, n) : n <= 4 ? 4 : 3;
  const fh = vertical ? (n > 4 ? 190 : 200) : 180;
  return (
    <Quadro
      titulo={
        <>
          Fotos da obra <small style={{ fontWeight: 400, color: "#5f7076", fontSize: 11 }}>· escolhidas na aba Fotos{mais > 0 ? ` · mais ${mais} no Registro fotográfico` : ""}</small>
        </>
      }
    >
      <div className="rel-fotos rs" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)`, ["--fh" as string]: `${fh}px` }}>
        {fotos.map((f) => (
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
    </Quadro>
  );
}

// uma fachada em miniatura (duas vistas centralizadas) com os % por fachada e por parte, para UM serviço
function MiniFachada({ ctx, sis, servico, niveis, titulo }: { ctx: Ctx; sis: Sistema; servico: Servico; niveis: ReturnType<typeof calcularNiveis>; titulo: boolean }) {
  const itens = useMemo(() => itensDoServico(ctx.itensPorSis.get(sis.id) ?? [], servico.id), [ctx, sis.id, servico.id]);
  const descidas = useMemo(() => descidasDoServico(sis, servico.id), [sis, servico.id]);
  const porChave = useMemo(() => mapaItensFachada(itens), [itens]);
  const pf: Record<Face, Soma> = { N: somaZero(), S: somaZero(), L: somaZero(), O: somaZero() };
  const pp: Record<Parte, Soma> = { emb: somaZero(), tor: somaZero(), res: somaZero() };
  const total = somaZero();
  itens.forEach((i) => {
    if (!i.face || !i.parte) return;
    const st = status(ctx.ap, i.id, servico.id);
    acumular(pf[i.face], 1, st);
    acumular(pp[i.parte], 1, st);
    acumular(total, 1, st);
  });
  return (
    <div>
      {titulo && (
        <div className="flex items-center justify-between text-[12px] font-bold mb-1" style={{ color: "#1f4a52" }}>
          <span>{servico.nome}</span>
          <span>{fmtPct0(pct(total))}%</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1" style={{ justifyItems: "center" }}>
        {(["NE", "SW"] as const).map((v) => (
          <div key={v} style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <Predio3D
              vista={v}
              descidas={descidas}
              niveis={niveis}
              rotulos={false}
              alturaMax={titulo ? 120 : 150}
              cor={(parte, face, d, nivelId) => {
                const it = porChave.get(chaveItemFachada(parte, face, d, nivelId));
                return it ? COR_STATUS[status(ctx.ap, it.id, servico.id)] : "#e3e7e9";
              }}
            />
          </div>
        ))}
      </div>
      {(["N", "S", "L", "O"] as Face[]).map((f) => (
        <BarraLinha key={f} nome={NOME_FACE[f]} s={pf[f]} />
      ))}
      <div className="text-[11px] text-ink-500 mt-1.5 flex gap-2 flex-wrap">
        {(["emb", "tor", "res"] as Parte[]).map((p2) => (
          <span key={p2}>
            {NOME_PARTE[p2]}: <b className="text-ink-900">{fmtPct0(pct(pp[p2]))}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// sinal de concluído e bandeira da entrega: desenhados (não dependem de fonte/emoji, que somem no PDF)
const Check = ({ tam = 22, cor = "#fff" }: { tam?: number; cor?: string }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-label="concluído">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const Bandeira = ({ tam = 22 }: { tam?: number }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="#1f4a52" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="entrega">
    <path d="M6 21V3" />
    <path d="M6 4h12l-2.5 4 2.5 4H6" fill="#f5c84c" />
  </svg>
);

export default function Resumo({ ctx, escopo, largura, altura, fotos = [], fotosMais = 0 }: { ctx: Ctx; escopo: Escopo; largura: number; altura: number; fotos?: FotoRel[]; fotosMais?: number }) {
  const { dados, idx } = ctx;
  const obra = dados.obra;
  const vertical = largura < altura;

  // % por fatias da obra: cada recorte (obra, pavimento, ambiente, sistema, fase…) reescala as fatias para somar 100% dentro dele
  const dadosR = useMemo(() => {
    const rec = (alvos: AlvoR[], f?: (s: Servico) => boolean): Soma => somaRecorte(ctx.fat, idx, ctx.ap, alvos, (s) => escopo.servOk(s) && (!f || f(s)));
    const todos: AlvoR[] = [...alvosDeLocais(escopo.locais), ...alvosDeItens(escopo.itens)];
    const total = rec(todos);
    const porPav = new Map<string, Soma>(),
      porCat = new Map<string, Soma>(),
      porSis = new Map<string, Soma>(),
      porFase = new Map<string, Soma>(),
      porServ = new Map<string, { s: Soma; nome: string }>();
    const faseDe = (sv: Servico) => (sv.fase_id && ctx.faseOrdem.get(sv.fase_id)?.nome) || sv.grupo;
    ctx.pavs.forEach((p) => {
      const ls = escopo.locais.filter((l) => l.pavimento_id === p.id);
      if (ls.length) porPav.set(p.id, rec(alvosDeLocais(ls)));
    });
    dados.categorias.forEach((c) => {
      const a = [...alvosDeLocais(escopo.locais.filter((l) => l.categoria_id === c.id)), ...alvosDeItens(escopo.itens.filter((i) => i.categoria_id === c.id))];
      if (a.length) porCat.set(c.id, rec(a));
    });
    dados.sistemas.forEach((sy) => {
      const its = escopo.itens.filter((i) => i.sistema_id === sy.id);
      if (its.length) porSis.set(sy.id, rec(alvosDeItens(its)));
    });
    const fases = new Set<string>();
    const nomes = new Set<string>();
    new Set(todos.map((a) => a.categoria_id)).forEach((cid) =>
      (idx.servicosDaCat.get(cid) ?? []).forEach(({ servico }) => {
        if (!escopo.servOk(servico)) return;
        fases.add(faseDe(servico));
        nomes.add(servico.nome);
      })
    );
    fases.forEach((n) => porFase.set(n, rec(todos, (s) => faseDe(s) === n)));
    nomes.forEach((n) => porServ.set(n, { nome: n, s: rec(todos, (s) => s.nome === n) }));
    return { total, porPav, porCat, porSis, porFase, porServ };
  }, [ctx, escopo, idx, dados.categorias, dados.sistemas]);

  // ---- linha do tempo ----
  const etapas: Etapa[] = useMemo(() => {
    const todos: AlvoR[] = [...alvosDeLocais(escopo.locais), ...alvosDeItens(escopo.itens)];
    const idDeFase = (n: string) => dados.fases.find((f) => f.nome === n)?.id;
    const rec = (f: (sv: Servico) => boolean) => somaRecorte(ctx.fat, idx, ctx.ap, todos, (s) => escopo.servOk(s) && f(s));
    const faseSomada = (nomeFase: string, excluir: string[] = []) => {
      const fid = idDeFase(nomeFase);
      return rec((sv) => sv.fase_id === fid && !excluir.includes(sv.nome));
    };
    const servSomada = (nome: string) => rec((sv) => sv.nome === nome);
    const lista: [string, Soma][] = [
      ["Estrutura", faseSomada("Estrutura")],
      ["Alvenaria", faseSomada("Alvenaria")],
      ["Instalações", faseSomada("Instalações")],
      ["Reboco interno", servSomada("Reboco Interno")],
      ["Shafts", faseSomada("Shafts")],
      ["Reboco externo", servSomada("Reboco externo")],
      // demais serviços da fachada (ex.: Pintura externa) viram etapas logo depois do reboco
      ...(idx.servicosDaCat.get(dados.categorias.find((c) => c.chave === "fach")?.id ?? "") ?? [])
        .map((x) => x.servico)
        .filter((s) => s.nome !== "Reboco externo")
        .map((s) => [s.nome, servSomada(s.nome)] as [string, Soma]),
      ["Revestimentos", faseSomada("Revestimentos", ["Chapisco Interno", "Reboco Interno"])],
      ["Acabamentos", faseSomada("Acabamentos")],
    ];
    return lista.map(([nome, s]) => ({ nome, s, tem: s.tot > 0 }));
  }, [ctx, escopo, idx, dados.fases]);
  const indiceAtual = (() => {
    const emAndamento = etapas.findIndex((e) => e.tem && pct(e.s) > 0 && pct(e.s) < 99.95);
    if (emAndamento >= 0) return emAndamento;
    return etapas.findIndex((e) => e.tem && pct(e.s) < 99.95);
  })();

  // ---- prazo ----
  const hoje = new Date();
  const ini = parseData(obra.data_inicio);
  const fim = parseData(obra.data_entrega_prevista);
  const pctObra = pct(dadosR.total);
  let prazoPct: number | null = null;
  let faltam: string | null = null;
  if (ini && fim && fim > ini) prazoPct = Math.max(0, Math.min(100, ((hoje.getTime() - ini.getTime()) / (fim.getTime() - ini.getTime())) * 100));
  if (fim) {
    const dias = Math.ceil((fim.getTime() - hoje.getTime()) / DIA);
    faltam = dias >= 0 ? `faltam ${dias} dias (${(dias / 30.4).toFixed(1).replace(".", ",")} meses)` : `passou ${Math.abs(dias)} dias`;
  }
  const dif = prazoPct != null ? pctObra - prazoPct : null;

  // ---- frentes em andamento (por serviço, em toda a obra) ----
  const frentes = useMemo(() => {
    type Ag = { servico: Servico; n: number; f: number; a: number; pavs: Map<string, { n: number; f: number; a: number }>; itens: string[] };
    const mapa = new Map<string, Ag>();
    const pegar = (sv: Servico) => {
      if (!mapa.has(sv.nome)) mapa.set(sv.nome, { servico: sv, n: 0, f: 0, a: 0, pavs: new Map(), itens: [] });
      return mapa.get(sv.nome)!;
    };
    escopo.locais.forEach((l) =>
      (idx.servicosDaCat.get(l.categoria_id) ?? []).forEach(({ servico }) => {
        if (!escopo.servOk(servico)) return;
        const st = status(ctx.ap, l.id, servico.id);
        if (st === 3) return;
        const g = pegar(servico);
        g.n++;
        if (st === 2) g.f++;
        if (st === 1) g.a++;
        const pv = g.pavs.get(l.pavimento_id) ?? { n: 0, f: 0, a: 0 };
        pv.n++;
        if (st === 2) pv.f++;
        if (st === 1) pv.a++;
        g.pavs.set(l.pavimento_id, pv);
      })
    );
    escopo.itens.forEach((i) =>
      (idx.servicosDaCat.get(i.categoria_id) ?? []).forEach(({ servico }) => {
        if (i.servico_id && i.servico_id !== servico.id) return; // trecho de fachada: só do serviço dele
        if (!escopo.servOk(servico)) return;
        const st = status(ctx.ap, i.id, servico.id);
        if (st === 3) return;
        const g = pegar(servico);
        g.n++;
        if (st === 2) g.f++;
        if (st === 1) {
          g.a++;
          if (g.itens.length < 3) g.itens.push(i.nome);
        }
      })
    );
    const ativos = Array.from(mapa.values()).filter((g) => g.n > 0 && g.f < g.n && g.f + g.a > 0);
    const grupos = agruparPorFase(ativos.map((g) => g.servico), ctx);
    return { total: ativos.length, etapasAndamento: ativos.reduce((a, g) => a + g.a, 0), grupos, mapa };
  }, [ctx, escopo, idx]);

  const limite = vertical ? 24 : 8;
  let mostradas = 0;
  const gruposFrentes = frentes.grupos
    .map((g) => ({ ...g, servicos: g.servicos.filter(() => mostradas++ < limite) }))
    .filter((g) => g.servicos.length);

  const nomePav = (id: string) => ctx.pavPorId.get(id)?.nome ?? "";
  const textoFrente = (nome: string) => {
    const g = frentes.mapa.get(nome)!;
    const pavs = Array.from(g.pavs.entries());
    const prontos = pavs.filter(([, v]) => v.f === v.n).length;
    const ativos = pavs
      .filter(([, v]) => v.f < v.n && v.f + v.a > 0)
      .map(([id]) => ctx.pavPorId.get(id)!)
      .sort((a, b) => b.ordem - a.ordem); // do mais baixo ao mais alto
    let frente = "";
    if (ativos.length === 1) frente = nomePav(ativos[0].id);
    else if (ativos.length === 2) frente = `${ativos[0].nome} e ${ativos[1].nome}`;
    else if (ativos.length > 2) frente = `${ativos[0].nome} → ${ativos[ativos.length - 1].nome}`;
    else if (g.itens.length) frente = g.itens.join(", ");
    const prefixo = pavs.length ? `${prontos}/${pavs.length} pav. prontos` : "";
    return [prefixo, frente ? `frente: ${frente}` : ""].filter(Boolean).join(" · ");
  };

  // ---- fachada (mini 3D): um bloco por serviço da fachada (Reboco externo, Pintura externa…), cada um com as suas descidas ----
  const sisFach = dados.sistemas.find((s) => s.tipo === "fachada");
  const catFach = dados.categorias.find((c) => c.chave === "fach");
  const servsFach = (idx.servicosDaCat.get(catFach?.id ?? "") ?? []).map((x) => x.servico).filter((s) => escopo.servOk(s) && ctx.itensPorSis.get(sisFach?.id ?? "")?.some((i) => i.servico_id === s.id));
  const niveis = useMemo(() => calcularNiveis(ctx.pavs, ctx.locaisPorPav, idx), [ctx, idx]);

  const pavsComDados = ctx.pavs.filter((p) => dadosR.porPav.has(p.id));
  const cats = dados.categorias.filter((c) => dadosR.porCat.has(c.id));
  const sistemas = dados.sistemas.filter((s) => dadosR.porSis.has(s.id));
  const fasesOrdem = [...dados.fases].sort((a, b) => a.ordem - b.ordem).map((f) => f.nome);
  const porFaseLista = Array.from(dadosR.porFase.entries()).sort((a, b) => (fasesOrdem.indexOf(a[0]) + 1 || 99) - (fasesOrdem.indexOf(b[0]) + 1 || 99));
  const emAndamentoAgora = frentes.etapasAndamento;

  // ================= com filtro: rosca, por fase e por serviço =================
  if (escopo.filtrado) {
    const servLista = Array.from(dadosR.porServ.values()).sort((a, b) => pct(b.s) - pct(a.s));
    return (
      <div style={{ display: "grid", gridTemplateColumns: vertical ? "1fr" : "1fr 1fr", gap: 14 }}>
        <Quadro titulo="Visão geral do filtro">
          <div className="flex items-center gap-4">
            <Rosca s={dadosR.total} tam={170} />
            <div className="text-[13px] space-y-1.5">
              {[["Finalizado", dadosR.total.fin, VERDE], ["Andamento", dadosR.total.and, LARANJA], ["Não iniciado", dadosR.total.nao, "#e3e7e9"]].map(([n, v, c]) => (
                <div key={n as string} className="flex items-center gap-2">
                  <i style={{ width: 12, height: 12, background: c as string, display: "inline-block", borderRadius: 2 }} />
                  {n as string}: <b>{v as number}</b>
                </div>
              ))}
            </div>
          </div>
        </Quadro>
        <Quadro titulo="Andamento por fase">{porFaseLista.map(([n, s]) => <BarraLinha key={n} nome={n} s={s} />)}</Quadro>
        <Quadro titulo="Andamento por serviço" className={vertical ? "" : "col-span-2"}>
          <div style={{ columnCount: vertical ? 2 : 3, columnGap: 22 }}>
            {servLista.map((v) => (
              <BarraLinha key={v.nome} nome={v.nome} s={v.s} />
            ))}
          </div>
        </Quadro>
        {fotos.length > 0 && (
          <div className="col-span-2" style={{ gridColumn: "1 / -1" }}>
            <FotosResumo fotos={fotos} mais={fotosMais} vertical={vertical} />
          </div>
        )}
      </div>
    );
  }

  // ================= resumo completo =================
  const tile = (titulo: string, grande: string, sub: string, cor: string) => (
    <div className="rounded-xl bg-white p-3" style={{ border: "1px solid #dfe5e8", borderTop: `5px solid ${cor}` }}>
      <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold">{titulo}</div>
      <div className="text-[30px] font-extrabold leading-tight" style={{ color: cor === "#9ca3af" ? "#374151" : cor }}>
        {grande}
      </div>
      <div className="text-[11.5px] text-ink-500">{sub}</div>
    </div>
  );
  const corPrazo = dif == null ? "#9ca3af" : dif >= 0 ? "#24914f" : "#c0392b";

  return (
    <div className="space-y-3">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {tile("Obra concluída", `${fmtPct(pctObra)}%`, "índice ponderado", "#24914f")}
        {tile("Entrega prevista", fim ? fim.toLocaleDateString("pt-BR") : "—", faltam ?? "defina em Pavimentos e serviços", "#2c6975")}
        {tile(
          "Prazo decorrido",
          prazoPct != null ? `${fmtPct(prazoPct)}%` : "—",
          dif == null ? "defina as datas em Pavimentos e serviços" : dif >= 0 ? `obra à frente do prazo em ${Math.round(dif)} pontos` : `obra atrás do prazo em ${Math.round(-dif)} pontos`,
          corPrazo
        )}
        {tile("Frentes em andamento", String(frentes.total), `${emAndamentoAgora} etapas em andamento agora`, "#f0a020")}
      </div>

      <Quadro titulo="Linha do tempo da obra">
        <div className="flex items-start" style={{ padding: "6px 6px 0" }}>
          {etapas.map((e, i) => {
            const p = pct(e.s);
            const feita = e.tem && p >= 99.95;
            const andando = e.tem && p > 0 && !feita;
            const atual = i === indiceAtual;
            return (
              <div key={e.nome} className="flex-1 flex flex-col items-center relative" style={{ minWidth: 0 }}>
                {i > 0 && <div style={{ position: "absolute", top: 21, right: "50%", width: "100%", height: 4, background: feita || etapas[i - 1] && pct(etapas[i - 1].s) >= 99.95 ? VERDE : "#dfe5e8", zIndex: 0 }} />}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 13,
                    background: feita ? VERDE : "#fff",
                    color: feita ? "#fff" : andando ? "#c97a00" : "#9ca3af",
                    border: feita ? `3px solid ${VERDE}` : andando ? `3px solid ${LARANJA}` : "3px solid #cfd6da",
                    boxShadow: atual ? "0 0 0 4px #f5c84c" : undefined,
                  }}
                >
                  {feita ? <Check /> : e.tem ? `${fmtPct0(p)}%` : "—"}
                </div>
                <div className="text-[12px] font-semibold mt-1 text-center" style={{ color: "#1f4a52" }}>
                  {e.nome}
                </div>
                <div className="text-[10.5px] text-ink-500">{feita ? "concluída" : andando ? "em andamento" : "a iniciar"}</div>
                <div style={{ width: "70%", marginTop: 3 }}>
                  <Barra s={e.s} h={5} />
                </div>
              </div>
            );
          })}
          <div className="flex-1 flex flex-col items-center relative">
            <div style={{ position: "absolute", top: 21, right: "50%", width: "100%", height: 4, background: "#dfe5e8" }} />
            <div style={{ width: 44, height: 44, borderRadius: 22, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: "#fff", border: "3px solid #1f4a52" }}>
              <Bandeira />
            </div>
            <div className="text-[12px] font-semibold mt-1" style={{ color: "#1f4a52" }}>
              Entrega
            </div>
            <div className="text-[10.5px] text-ink-500">{fim ? fim.toLocaleDateString("pt-BR") : "—"}</div>
          </div>
        </div>
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="flex items-center gap-2 text-[12px]">
            <span style={{ width: 52 }}>Tempo</span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ background: "#e3e7e9", height: 10 }}>
              <div style={{ width: `${prazoPct ?? 0}%`, height: "100%", background: "#2c6975" }} />
            </div>
            <b style={{ width: 44, textAlign: "right" }}>{prazoPct != null ? fmtPct0(prazoPct) + "%" : "—"}</b>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span style={{ width: 52 }}>Obra</span>
            <div className="flex-1">
              <Barra s={dadosR.total} h={10} />
            </div>
            <b style={{ width: 44, textAlign: "right" }}>{fmtPct0(pctObra)}%</b>
          </div>
        </div>
      </Quadro>

      <div style={{ display: "grid", gridTemplateColumns: vertical ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        <Quadro titulo="Visão geral">
          <div className="flex items-center gap-3">
            <Rosca s={dadosR.total} tam={120} />
            <div className="text-[12px] space-y-1">
              {[["Finalizado", dadosR.total.fin, VERDE], ["Andamento", dadosR.total.and, LARANJA], ["Não iniciado", dadosR.total.nao, "#e3e7e9"]].map(([n, v, c]) => (
                <div key={n as string} className="flex items-center gap-1.5">
                  <i style={{ width: 11, height: 11, background: c as string, display: "inline-block", borderRadius: 2 }} />
                  {n as string}: <b>{v as number}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border">
            {sistemas.map((s) => (
              <BarraLinha key={s.id} nome={s.nome} s={dadosR.porSis.get(s.id)!} />
            ))}
          </div>
        </Quadro>
        <Quadro titulo="Por pavimento">
          {pavsComDados.map((p) => (
            <BarraLinha key={p.id} nome={p.nome} s={dadosR.porPav.get(p.id)!} />
          ))}
        </Quadro>
        <Quadro titulo="Por ambiente">
          {cats.map((c) => (
            <BarraLinha key={c.id} nome={c.nome} s={dadosR.porCat.get(c.id)!} cor={c.cor} />
          ))}
        </Quadro>
        <Quadro titulo={servsFach.length > 1 ? "Fachada" : servsFach[0]?.nome ?? "Fachada"}>
          {sisFach && servsFach.length ? (
            <div className="space-y-3">
              {servsFach.map((sv) => (
                <MiniFachada key={sv.id} ctx={ctx} sis={sisFach} servico={sv} niveis={niveis} titulo={servsFach.length > 1} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-ink-500">Sem fachada cadastrada.</p>
          )}
        </Quadro>
      </div>

      <FotosResumo fotos={fotos} mais={fotosMais} vertical={vertical} />

      <Quadro titulo="Frentes em andamento">
        {gruposFrentes.length === 0 ? (
          <p className="text-[12px] text-ink-500">Nenhum serviço em andamento no momento.</p>
        ) : (
          <div style={{ columnCount: vertical ? 2 : 3, columnGap: 22 }}>
            {gruposFrentes.map((g) => (
              <div key={g.id} style={{ breakInside: "avoid", marginBottom: 8 }}>
                <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#2c6975", borderBottom: "2px solid #2c6975", marginBottom: 3 }}>
                  {g.nome}
                </div>
                {g.servicos.map((s) => {
                  const a = frentes.mapa.get(s.nome)!;
                  const p = ((a.f + 0.5 * a.a) / a.n) * 100;
                  return (
                    <div key={s.id} className="mb-1.5">
                      <div className="flex items-center gap-2 text-[12px]">
                        <b className="truncate flex-1">{s.nome}</b>
                        {p >= 80 && <span className="text-[10px] rounded px-1" style={{ background: "#e3f4e8", color: "#1f7a42" }}>quase pronto</span>}
                        {p < 20 && <span className="text-[10px] rounded px-1" style={{ background: "#fdf0d8", color: "#9a6200" }}>começando</span>}
                        <b>{fmtPct0(p)}%</b>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: 6, background: "#e3e7e9" }}>
                        <div style={{ width: `${p}%`, height: "100%", background: VERDE }} />
                      </div>
                      <div className="text-[10.5px] text-ink-500">{textoFrente(s.nome)}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {frentes.total > limite && <p className="text-[11px] text-ink-500 mt-1">+ {frentes.total - limite} frente(s) não exibida(s) neste resumo.</p>}
      </Quadro>
    </div>
  );
}
