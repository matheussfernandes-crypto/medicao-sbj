"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useRotulosCartao } from "@/components/ui/useRotulosCartao";
import FiltroColuna, { contarValores, type Direcao } from "@/components/ui/FiltroColuna";
import { Paginador, usePaginas } from "@/components/ui/anima";

// Tabela padrão do site: filtro e ordenação no próprio título da coluna + divisão por páginas.
// As linhas continuam montadas pelo servidor (botões, formulários e links de sempre); aqui só se escolhe
// quais aparecem e em que ordem. Não altera nenhum dado.

export type ColunaTab = {
  chave: string;
  rotulo: string;
  direita?: boolean; // número alinhado à direita
  filtro?: boolean; // caixinhas com a quantidade de cada valor
  ordem?: boolean; // A→Z / Z→A
  ordens?: [Direcao, string][]; // ordens personalizadas (ex.: datas)
  lab?: (v: string) => string; // rótulo mostrado no filtro
};

// d: valores de cada coluna (texto), usados para filtrar e ordenar; linha: a <tr> já montada pelo servidor
// l: rótulos prontos de cada valor (texto), para páginas do servidor que não podem passar funções
export type ItemTab = { id: string; d: Record<string, string>; l?: Record<string, string>; linha: React.ReactNode };

const AZ: [Direcao, string][] = [
  ["asc", "A → Z"],
  ["desc", "Z → A"],
];

export default function TabelaColunas({
  colunas,
  itens,
  por = 15,
  className = "w-full text-sm",
  vazio = "Nada encontrado com esses filtros.",
}: {
  colunas: ColunaTab[];
  itens: ItemTab[];
  por?: number;
  className?: string;
  vazio?: string;
}) {
  const [filtros, setFiltros] = useState<Record<string, string[]>>({});
  const [ord, setOrd] = useState<{ k: string; d: Direcao } | null>(null);

  // passa nos filtros de todas as colunas, menos a indicada (para contar os valores daquela coluna)
  const passa = (it: ItemTab, menos?: string) =>
    Object.entries(filtros).every(([k, vs]) => k === menos || !vs?.length || vs.includes(it.d[k] ?? ""));

  const lista = useMemo(() => {
    const vis = itens.filter((it) => passa(it));
    if (!ord) return vis;
    const m = ord.d === "desc" ? -1 : 1;
    return [...vis].sort(
      (a, b) =>
        String(a.d[ord.k] ?? "").localeCompare(String(b.d[ord.k] ?? ""), "pt-BR", { numeric: true, sensitivity: "base" }) * m
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, filtros, ord]);

  const raiz = useRef<HTMLDivElement>(null);
  useRotulosCartao(raiz);
  const pg = usePaginas(lista, por, JSON.stringify(filtros) + "|" + JSON.stringify(ord) + "|" + itens.length);
  const nFiltros = Object.values(filtros).filter((v) => v?.length).length;
  const ativo = nFiltros > 0 || !!ord;

  // rótulo de um valor no filtro: função (só em componentes do navegador) ou o rótulo pronto vindo do item
  const rotulo = (c: ColunaTab) => (v: string) => (c.lab ? c.lab(v) : itens.find((it) => it.d[c.chave] === v)?.l?.[c.chave] ?? v);

  function cabecalho(c: ColunaTab) {
    if (!c.filtro && !c.ordem && !c.ordens) return <span className="whitespace-nowrap">{c.rotulo}</span>;
    const valores = c.filtro
      ? contarValores(
          itens.filter((it) => passa(it, c.chave)),
          (it) => it.d[c.chave] ?? "",
          rotulo(c)
        ).sort((a, b) => a.l.localeCompare(b.l, "pt-BR", { numeric: true }))
      : undefined;
    (filtros[c.chave] ?? []).forEach((v) => valores && !valores.some((x) => x.v === v) && valores.push({ v, l: rotulo(c)(v), n: 0 }));
    return (
      <FiltroColuna
        rotulo={c.rotulo}
        ordens={c.ordens ?? (c.ordem ? AZ : undefined)}
        ordem={ord?.k === c.chave ? ord.d : null}
        onOrdem={(d) => setOrd(d ? { k: c.chave, d } : null)}
        valores={valores}
        marcados={filtros[c.chave] ?? []}
        onMarcar={(v) => setFiltros((f) => ({ ...f, [c.chave]: v }))}
        alinharDireita={c.direita}
      />
    );
  }

  return (
    <div ref={pg.topo} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span>{lista.length === itens.length ? `${itens.length} registro(s)` : `${lista.length} de ${itens.length}`}</span>
        {ativo && (
          <button
            type="button"
            onClick={() => {
              setFiltros({});
              setOrd(null);
            }}
            className="font-semibold text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
      <div className="overflow-x-auto" ref={raiz}>
        <table className={className + " tab-cartao com-filtros"}>
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-ink-500">
              {colunas.map((c) => (
                <th key={c.chave} className={"py-2 pr-2 " + (c.direita ? "text-right" : "")}>
                  {cabecalho(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={pg.giro} className={pg.classe}>
            {pg.itens.map((it) => (
              <Fragment key={it.id}>{it.linha}</Fragment>
            ))}
            {!pg.itens.length && (
              <tr>
                <td colSpan={colunas.length} className="py-6 text-center text-ink-400">
                  {vazio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginador pag={pg.pag} pags={pg.pags} total={pg.total} por={pg.por} ir={pg.ir} />
    </div>
  );
}
