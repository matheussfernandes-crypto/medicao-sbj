"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { agruparPorFase, type Ctx, type Filtros } from "./modelo";
import type { Categoria, Servico } from "../types";

type Aba = "pav" | "sis" | "cat" | "serv";

// o que cada filtro oferece, dadas as escolhas anteriores (nada marcado = tudo)
export function disponiveis(ctx: Ctx, f: Filtros) {
  const { dados, idx } = ctx;
  const pav = new Set(f.pav),
    sis = new Set(f.sis);
  let locais = dados.locais;
  let itens = dados.itens;
  if (pav.size || sis.size) {
    locais = pav.size ? locais.filter((l) => pav.has(l.pavimento_id)) : [];
    itens = sis.size ? itens.filter((i) => sis.has(i.sistema_id)) : [];
  }
  const catIds = new Set<string>([...locais.map((l) => l.categoria_id), ...itens.map((i) => i.categoria_id)]);
  const cats = dados.categorias.filter((c) => catIds.has(c.id));
  const catsUsadas = f.cat.length ? cats.filter((c) => f.cat.includes(c.id)) : cats;
  const servMap = new Map<string, Servico>();
  catsUsadas.forEach((c) => (idx.servicosDaCat.get(c.id) ?? []).forEach((x) => servMap.set(x.servico.id, x.servico)));
  return { cats, servicos: Array.from(servMap.values()) };
}

// seleções impossíveis são limpas automaticamente
export function normalizarFiltros(ctx: Ctx, f: Filtros): Filtros {
  const base = { ...f, cat: [...f.cat], serv: [...f.serv] };
  const d1 = disponiveis(ctx, { ...base, cat: [], serv: [] });
  base.cat = base.cat.filter((id) => d1.cats.some((c) => c.id === id));
  const d2 = disponiveis(ctx, base);
  base.serv = base.serv.filter((id) => d2.servicos.some((s) => s.id === id));
  return base;
}

export type Chip = { grupo: Aba; texto: string };

export function chipsDeFiltros(ctx: Ctx, f: Filtros): Chip[] {
  const chips: Chip[] = [];
  const lista = (grupo: Aba, titulo: string, nomes: string[], total: number) => {
    if (!nomes.length) return;
    chips.push({ grupo, texto: nomes.length > 4 ? `${titulo}: ${nomes.length} de ${total}` : `${titulo}: ${nomes.join(", ")}` });
  };
  lista("pav", "Pavimentos", ctx.pavs.filter((p) => f.pav.includes(p.id)).map((p) => p.nome), ctx.pavs.length);
  lista("sis", "Sistemas", ctx.dados.sistemas.filter((s) => f.sis.includes(s.id)).map((s) => s.nome), ctx.dados.sistemas.length);
  const d = disponiveis(ctx, { ...f, serv: [] });
  lista("cat", "Tipos de local", d.cats.filter((c) => f.cat.includes(c.id)).map((c) => c.nome), d.cats.length);
  if (f.serv.length) {
    const sel = new Set(f.serv);
    const grupos = agruparPorFase(d.servicos, ctx);
    if (d.servicos.length && f.serv.length >= d.servicos.length) chips.push({ grupo: "serv", texto: "Serviços: todos" });
    else {
      const fases = grupos.filter((g) => g.servicos.every((s) => sel.has(s.id)));
      const resto = d.servicos.filter((s) => sel.has(s.id) && !fases.some((g) => g.servicos.includes(s)));
      const partes = [...fases.map((g) => `${g.nome} (fase)`), ...resto.map((s) => s.nome)];
      chips.push({
        grupo: "serv",
        texto: partes.length > 5 ? `Serviços: ${fases.length} fases + ${resto.length} serviços (${sel.size} de ${d.servicos.length})` : partes.join(", "),
      });
    }
  }
  return chips;
}

export function PainelFiltros({ ctx, filtros, onChange, onFechar }: { ctx: Ctx; filtros: Filtros; onChange: (f: Filtros) => void; onFechar: () => void }) {
  const [aba, setAba] = useState<Aba>("pav");
  const [busca, setBusca] = useState("");
  const disp = useMemo(() => disponiveis(ctx, filtros), [ctx, filtros]);
  const grupos = useMemo(() => agruparPorFase(disp.servicos, ctx), [disp.servicos, ctx]);

  const set = (parte: Partial<Filtros>) => onChange(normalizarFiltros(ctx, { ...filtros, ...parte }));
  const alternar = (chave: Aba, id: string) => {
    const atual = new Set(filtros[chave]);
    atual.has(id) ? atual.delete(id) : atual.add(id);
    set({ [chave]: Array.from(atual) } as Partial<Filtros>);
  };

  const itensDaAba = (): { id: string; nome: string }[] =>
    aba === "pav" ? ctx.pavs.map((p) => ({ id: p.id, nome: p.nome })) : aba === "sis" ? ctx.dados.sistemas.map((s) => ({ id: s.id, nome: s.nome })) : disp.cats.map((c: Categoria) => ({ id: c.id, nome: c.nome }));
  const contagem = (a: Aba) => (filtros[a].length ? String(filtros[a].length) : "todos");
  const termo = busca.trim().toLowerCase();

  const menu: [Aba, string][] = [
    ["pav", "Pavimentos"],
    ["sis", "Sistemas"],
    ["cat", "Tipos de local"],
    ["serv", "Serviços"],
  ];

  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid md:grid-cols-[190px_1fr]" style={{ minHeight: 280 }}>
        <div className="border-r border-border bg-surface-subtle p-2">
          {menu.map(([k, nome]) => (
            <button key={k} onClick={() => { setAba(k); setBusca(""); }} className={`w-full flex justify-between px-3 py-2 rounded-md text-sm ${aba === k ? "bg-white font-semibold shadow-sm" : "hover:bg-white/60"}`}>
              <span>{nome}</span>
              <span className="text-xs text-ink-500">{contagem(k)}</span>
            </button>
          ))}
        </div>
        <div className="p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {(aba === "pav" || aba === "serv") && (
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="border border-border rounded-md px-2 py-1 text-sm w-48" />
            )}
            <button
              className="text-xs px-2 py-1 border border-border rounded-md"
              onClick={() => set({ [aba]: aba === "serv" ? disp.servicos.map((s) => s.id) : itensDaAba().map((i) => i.id) } as Partial<Filtros>)}
            >
              Marcar todos
            </button>
            <button className="text-xs px-2 py-1 border border-border rounded-md" onClick={() => set({ [aba]: [] } as Partial<Filtros>)}>
              Desmarcar
            </button>
            <span className="text-[11px] text-ink-500">Nada marcado = tudo.</span>
          </div>

          {aba !== "serv" ? (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 max-h-72 overflow-auto">
              {itensDaAba()
                .filter((i) => !termo || i.nome.toLowerCase().includes(termo))
                .map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-sm py-0.5">
                    <input type="checkbox" checked={filtros[aba].includes(i.id)} onChange={() => alternar(aba, i.id)} />
                    {i.nome}
                  </label>
                ))}
            </div>
          ) : (
            <div className="max-h-72 overflow-auto space-y-2">
              {grupos.map((g) => {
                const visiveis = g.servicos.filter((s) => !termo || s.nome.toLowerCase().includes(termo));
                if (!visiveis.length) return null;
                const marcados = g.servicos.filter((s) => filtros.serv.includes(s.id)).length;
                return (
                  <div key={g.id}>
                    <label className="flex items-center gap-2 text-xs font-bold uppercase text-primaryDark border-b border-border pb-0.5 mb-1">
                      <input
                        type="checkbox"
                        checked={marcados === g.servicos.length}
                        ref={(el) => {
                          if (el) el.indeterminate = marcados > 0 && marcados < g.servicos.length;
                        }}
                        onChange={() => {
                          const ids = new Set(filtros.serv);
                          const todos = marcados === g.servicos.length;
                          g.servicos.forEach((s) => (todos ? ids.delete(s.id) : ids.add(s.id)));
                          set({ serv: Array.from(ids) });
                        }}
                      />
                      {g.nome} <span className="font-normal text-ink-500 normal-case">{marcados} de {g.servicos.length}</span>
                    </label>
                    <div className="grid sm:grid-cols-2 gap-x-6">
                      {visiveis.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm py-0.5">
                          <input type="checkbox" checked={filtros.serv.includes(s.id)} onChange={() => alternar("serv", s.id)} />
                          {s.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end border-t border-border p-2 bg-surface-subtle">
        <button onClick={onFechar} className="text-sm px-4 py-1.5 bg-primary text-white rounded-md">
          Pronto
        </button>
      </div>
    </div>
  );
}

export function ChipsFiltro({ chips, onRemover, onLimpar }: { chips: Chip[]; onRemover: (g: Aba) => void; onLimpar: () => void }) {
  if (!chips.length) return <span className="text-xs text-ink-500">Mostrando a obra inteira.</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.grupo} className="flex items-center gap-1 text-xs bg-primary/10 text-primaryDark rounded-full pl-2.5 pr-1 py-0.5 max-w-full">
          <span className="truncate">{c.texto}</span>
          <button onClick={() => onRemover(c.grupo)} aria-label="Remover filtro">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      <button onClick={onLimpar} className="text-xs underline text-ink-500">
        Limpar
      </button>
    </div>
  );
}
