"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import type { FotoPainel, ProgressoObra } from "./painel-obras";

// Slide de uma obra na página inicial: fotos recentes passando à esquerda e, à direita,
// o andamento com os serviços da fase atual (o texto alterna entre a % e o pavimento onde estão).
const COR = { fin: "#1f8a4c", and: "#f59e0b", nao: "#e5e7eb" };
const fmt = (v: number) => String(Math.round(v));
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

function Rosca({ p }: { p: ProgressoObra }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const fin = (p.pctFinalizado / 100) * c;
  const and = (p.pctAndamento / 100) * c;
  return (
    <div className="relative w-[88px] h-[88px] shrink-0">
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="44" cy="44" r={r} fill="none" stroke={COR.nao} strokeWidth="10" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={COR.and} strokeWidth="10" strokeDasharray={`${fin + and} ${c}`} />
        <circle cx="44" cy="44" r={r} fill="none" stroke={COR.fin} strokeWidth="10" strokeDasharray={`${fin} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-primaryDark">{fmt(p.pct)}%</span>
      </div>
    </div>
  );
}

export default function SlideObra({ p, fotos, ativo }: { p: ProgressoObra; fotos: FotoPainel[]; ativo?: boolean }) {
  const [foto, setFoto] = useState(0);
  const [mostraOnde, setMostraOnde] = useState(false);

  // fotos passam sozinhas; o texto do serviço alterna entre % e pavimento
  useEffect(() => {
    if (fotos.length < 2) return;
    const t = setInterval(() => setFoto((i) => (i + 1) % fotos.length), 3500);
    return () => clearInterval(t);
  }, [fotos.length]);
  useEffect(() => {
    const t = setInterval(() => setMostraOnde((v) => !v), 2600);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (ativo) setFoto(0);
  }, [ativo]);

  const atual = fotos[foto];
  const lista = p.frentes.length ? p.frentes : p.servicos.filter((s) => s.pct < 100).slice(0, 4).map((s) => ({ ...s, onde: "" }));

  return (
    <div className="h-full w-full bg-white grid grid-rows-[200px_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {/* fotos */}
      <div className="relative bg-primaryDark overflow-hidden">
        {fotos.length ? (
          fotos.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.url}
              src={f.url}
              alt={f.legenda ?? f.obraNome}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-[1200ms] ease-out"
              style={{ opacity: i === foto ? 1 : 0, transform: i === foto ? "scale(1.04)" : "scale(1)" }}
            />
          ))
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 text-sm">
            <Camera className="w-8 h-8" />
            Sem fotos desta obra ainda
          </div>
        )}
        {atual && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-8">
            <p className="text-white/90 text-xs">
              Foto de {dataBR(atual.dataFoto)}
              {atual.legenda ? ` · ${atual.legenda}` : ""}
            </p>
          </div>
        )}
        {fotos.length > 1 && (
          <div className="absolute top-3 left-3 flex gap-1">
            {fotos.map((f, i) => (
              <span key={f.url} className={"h-1 rounded-full transition-all duration-500 " + (i === foto ? "w-5 bg-white" : "w-2 bg-white/50")} />
            ))}
          </div>
        )}
      </div>

      {/* andamento */}
      <div className="p-5 lg:p-6 flex flex-col min-h-0 overflow-y-auto">
        <div className="pr-10">
          <h2 className="text-primaryDark font-semibold text-lg leading-tight">{p.nome}</h2>
          <p className="text-xs text-ink-500">Andamento físico · {p.unidades} locais</p>
        </div>

        {p.unidades === 0 ? (
          <p className="flex-1 flex items-center text-sm text-ink-500">Ainda não há pavimentos e locais cadastrados no Andamento de Obra (novo).</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mt-4">
              <Rosca p={p} />
              <ul className="text-xs text-ink-700 space-y-1">
                <li className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: COR.fin }} />Finalizado {fmt(p.pctFinalizado)}%</li>
                <li className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: COR.and }} />Em andamento {fmt(p.pctAndamento)}%</li>
                <li className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: COR.nao }} />Não iniciado {fmt(p.pctNaoIniciado)}%</li>
              </ul>
            </div>

            <p className="text-[11px] uppercase tracking-wide text-ink-400 font-semibold mt-5 mb-2">{p.frentes.length ? "Serviços em andamento" : "Próximos serviços"}</p>
            <div className="space-y-3">
              {lista.map((s) => {
                const temOnde = !!s.onde;
                const exibeOnde = temOnde && mostraOnde;
                return (
                  <div key={s.nome}>
                    <div className="flex items-center justify-between gap-3 text-[13px] text-ink-700 leading-tight">
                      <span className="truncate">{s.nome}</span>
                      {/* só este texto muda, deslizando: % ⇄ pavimento */}
                      <span className="inline-grid h-[18px] overflow-hidden shrink-0 justify-items-end">
                        <b
                          className="col-start-1 row-start-1 tabular-nums whitespace-nowrap transition-all duration-500 ease-out"
                          style={{ transform: exibeOnde ? "translateY(-100%)" : "translateY(0)", opacity: exibeOnde ? 0 : 1 }}
                        >
                          {fmt(s.pct)}%
                        </b>
                        {temOnde && (
                          <b
                            className="col-start-1 row-start-1 whitespace-nowrap text-primary transition-all duration-500 ease-out"
                            style={{ transform: exibeOnde ? "translateY(0)" : "translateY(100%)", opacity: exibeOnde ? 1 : 0 }}
                          >
                            {s.onde}
                          </b>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden mt-1">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, s.pct)}%`, background: s.pct >= 100 ? COR.fin : COR.and }} />
                    </div>
                  </div>
                );
              })}
              {!lista.length && <p className="text-sm text-ink-500">Todos os serviços concluídos.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
