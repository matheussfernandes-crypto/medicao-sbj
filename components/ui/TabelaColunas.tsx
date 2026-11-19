"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useRotulosCartao } from "@/components/ui/useRotulosCartao";
import FiltroColuna, { contarValores, type Direcao } from "@/components/ui/FiltroColuna";
import { Paginador, usePaginas } from "@/components/ui/anima";
import { BarraFiltros, FolhaFiltros, OpcaoFiltro, SecaoFiltro, type ChipFiltro } from "@/components/ui/FolhaFiltros";

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

  // celular: filtros e ordem escolhidos numa folha (rascunho) e só valem ao tocar em Aplicar
  const [folha, setFolha] = useState(false);
  const [rf, setRf] = useState<Record<string, string[]>>({});
  const [ro, setRo] = useState<{ k: string; d: Direcao } | null>(null);
  const abrirFolha = () => {
    setRf(filtros);
    setRo(ord);
    setFolha(true);
  };
  const colsFiltro = colunas.filter((c) => c.filtro);
  const colsOrdem = colunas.flatMap((c) => (c.ordens ?? (c.ordem ? AZ : [])).map(([d, l]) => ({ k: c.chave, d, rotulo: `${c.rotulo} — ${l}` })));
  const chips: ChipFiltro[] = [
    ...colsFiltro.flatMap((c) =>
      (filtros[c.chave] ?? []).map((v) => ({
        k: c.chave + "|" + v,
        rotulo: `${c.rotulo}: ${(c.lab ? c.lab(v) : itens.find((it) => it.d[c.chave] === v)?.l?.[c.chave] ?? v) || "—"}`,
        remover: () => setFiltros((f) => ({ ...f, [c.chave]: (f[c.chave] ?? []).filter((x) => x !== v) })),
      }))
    ),
    ...(ord
      ? [{ k: "ord", rotulo: "Ordem: " + (colsOrdem.find((o) => o.k === ord.k && o.d === ord.d)?.rotulo ?? ord.k), remover: () => setOrd(null) }]
      : []),
  ];

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
      <div className="hidden flex-wrap items-center justify-between gap-2 text-xs text-ink-500 md:flex">
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
      <BarraFiltros
        n={chips.length}
        chips={chips}
        onAbrir={abrirFolha}
        resumo={lista.length === itens.length ? `${itens.length} registro(s)` : `${lista.length} de ${itens.length}`}
        onLimpar={() => {
          setFiltros({});
          setOrd(null);
        }}
      />
      <FolhaFiltros
        aberto={folha}
        onFechar={() => setFolha(false)}
        onLimpar={() => {
          setRf({});
          setRo(null);
          setFiltros({});
          setOrd(null);
        }}
        onAplicar={() => {
          setFiltros(rf);
          setOrd(ro);
          setFolha(false);
        }}
      >
        {colsOrdem.length > 0 && (
          <label className="block text-sm font-semibold">
            Ordenar por
            <select
              value={ro ? ro.k + "|" + ro.d : ""}
              onChange={(e) => {
                const [k, d] = e.target.value.split("|");
                setRo(k ? { k, d: d as Direcao } : null);
              }}
              className="mt-1.5 block min-h-[44px] w-full rounded-[10px] border border-border bg-white px-3 text-sm font-normal text-ink-900"
            >
              <option value="">Ordem original</option>
              {colsOrdem.map((o) => (
                <option key={o.k + o.d} value={o.k + "|" + o.d}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}
        {colsFiltro.map((c, i) => {
          const marc = rf[c.chave] ?? [];
          const vals = contarValores(
            itens.filter((it) => Object.entries(rf).every(([k, vs]) => k === c.chave || !vs?.length || vs.includes(it.d[k] ?? ""))),
            (it) => it.d[c.chave] ?? "",
            rotulo(c)
          ).sort((a, b) => a.l.localeCompare(b.l, "pt-BR", { numeric: true }));
          marc.forEach((v) => !vals.some((x) => x.v === v) && vals.push({ v, l: rotulo(c)(v), n: 0 }));
          return (
            <SecaoFiltro key={c.chave} rotulo={c.rotulo} n={marc.length} aberta={i === 0 || marc.length > 0}>
              {vals.map((x) => (
                <OpcaoFiltro
                  key={x.v}
                  rotulo={x.l}
                  n={x.n}
                  marcado={marc.includes(x.v)}
                  onChange={(sim) => setRf((o) => ({ ...o, [c.chave]: sim ? [...(o[c.chave] ?? []), x.v] : (o[c.chave] ?? []).filter((y) => y !== x.v) }))}
                />
              ))}
            </SecaoFiltro>
          );
        })}
      </FolhaFiltros>
      <div className="overflow-x-auto" ref={raiz}>
        <table className={className + " tab-cartao"}>
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
