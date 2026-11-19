"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useRotulosCartao } from "./useRotulosCartao";
import { Search, X } from "lucide-react";
import { DataCampo, Paginador, usePaginas } from "./anima";
import Selecao from "./Selecao";
import { BarraFiltros, FolhaFiltros, SecaoFiltro, type ChipFiltro } from "./FolhaFiltros";

// Tabela com filtros no padrão do site: busca por texto, menus com pesquisa (digite o nome e a lista filtra)
// e período por data. As linhas continuam sendo montadas pelo servidor (com os botões e formulários de sempre);
// aqui só se escolhe quais aparecem, e elas vêm em páginas. Não altera nenhum dado.
export type ItemFiltravel = { id: string; d: Record<string, string>; linha: React.ReactNode };

export type FiltroTabela =
  | { tipo: "busca"; chaves: string[]; rotulo: string; placeholder?: string }
  | { tipo: "selecao"; chave: string; rotulo: string; todas?: string; opcoes?: { valor: string; rotulo: string }[] }
  | { tipo: "periodo"; chave: string; rotulo: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function TabelaFiltravel({
  cabecalho,
  itens,
  filtros,
  por = 20,
  className = "w-full text-sm",
  vazio = "Nada encontrado com esses filtros.",
}: {
  cabecalho: React.ReactNode;
  itens: ItemFiltravel[];
  filtros: FiltroTabela[];
  por?: number;
  className?: string;
  vazio?: string;
}) {
  // valor de cada filtro; período guarda "de" e "ate" em chaves separadas
  const [v, setV] = useState<Record<string, string>>({});
  const set = (k: string, x: string) => setV((o) => ({ ...o, [k]: x }));
  const ativos = Object.values(v).some(Boolean);

  // opções dos menus: as informadas, ou os valores que existem na lista
  const opcoes = useMemo(() => {
    const m: Record<string, { valor: string; rotulo: string }[]> = {};
    for (const f of filtros) {
      if (f.tipo !== "selecao") continue;
      m[f.chave] =
        f.opcoes ??
        Array.from(new Set(itens.map((i) => i.d[f.chave]).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map((x) => ({ valor: x, rotulo: x }));
    }
    return m;
  }, [filtros, itens]);

  const filtrados = useMemo(() => {
    return itens.filter((it) =>
      filtros.every((f) => {
        if (f.tipo === "busca") {
          const q = norm(v["b:" + f.rotulo] ?? "").trim();
          return !q || norm(f.chaves.map((c) => it.d[c] ?? "").join(" ")).includes(q);
        }
        if (f.tipo === "selecao") {
          const x = v["s:" + f.chave];
          return !x || it.d[f.chave] === x;
        }
        const de = v["de:" + f.chave];
        const ate = v["ate:" + f.chave];
        const dia = (it.d[f.chave] ?? "").slice(0, 10);
        if (de && (!dia || dia < de)) return false;
        if (ate && (!dia || dia > ate)) return false;
        return true;
      })
    );
  }, [itens, filtros, v]);

  // celular: menus e períodos ficam numa folha (rascunho) e só valem ao tocar em Aplicar; a busca continua no topo
  const [folha, setFolha] = useState(false);
  const [rv, setRv] = useState<Record<string, string>>({});
  const setR = (k: string, x: string) => setRv((o) => ({ ...o, [k]: x }));
  const moveis = filtros.filter((f) => f.tipo !== "busca");
  const nomeSel = (f: Extract<FiltroTabela, { tipo: "selecao" }>, x: string) => (opcoes[f.chave] ?? []).find((o) => o.valor === x)?.rotulo ?? x;
  const chips: ChipFiltro[] = moveis.flatMap((f) => {
    if (f.tipo === "selecao") {
      const x = v["s:" + f.chave];
      return x ? [{ k: "s:" + f.chave, rotulo: `${f.rotulo}: ${nomeSel(f, x)}`, remover: () => set("s:" + f.chave, "") }] : [];
    }
    const r: ChipFiltro[] = [];
    const de = v["de:" + f.chave];
    const ate = v["ate:" + f.chave];
    if (de) r.push({ k: "de:" + f.chave, rotulo: `${f.rotulo} desde ${de.split("-").reverse().join("/")}`, remover: () => set("de:" + f.chave, "") });
    if (ate) r.push({ k: "ate:" + f.chave, rotulo: `${f.rotulo} até ${ate.split("-").reverse().join("/")}`, remover: () => set("ate:" + f.chave, "") });
    return r;
  });

  const raiz = useRef<HTMLDivElement>(null);
  useRotulosCartao(raiz);
  const pg = usePaginas(filtrados, por, JSON.stringify(v) + "|" + itens.length);

  return (
    <div ref={pg.topo} className="space-y-3 px-2">
      <div className="flex flex-wrap items-end gap-3">
        {filtros.map((f) => {
          if (f.tipo === "busca") {
            const k = "b:" + f.rotulo;
            return (
              <label key={k} className="text-xs text-ink-500 flex-1 min-w-[200px] max-w-sm">
                {f.rotulo}
                <span className="relative block mt-0.5">
                  <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={v[k] ?? ""}
                    onChange={(e) => set(k, e.target.value)}
                    placeholder={f.placeholder ?? "Digite para buscar…"}
                    className="w-full border border-border rounded-[10px] pl-9 pr-3 py-2 text-sm bg-white text-ink-900"
                  />
                </span>
              </label>
            );
          }
          if (f.tipo === "selecao") {
            const k = "s:" + f.chave;
            return (
              <div key={k} className="hidden text-xs text-ink-500 md:block">
                <span className="block mb-1">{f.rotulo}</span>
                <Selecao value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} className="block border border-border rounded px-3 py-2 text-sm bg-white min-w-[180px]">
                  <option value="">{f.todas ?? "Todas"}</option>
                  {(opcoes[f.chave] ?? []).map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </div>
            );
          }
          return (
            <Fragment key={"p:" + f.chave}>
              <div className="hidden text-xs text-ink-500 md:block">
                <span className="block mb-1">{f.rotulo} — de</span>
                <DataCampo className="block" value={v["de:" + f.chave] ?? ""} onChange={(x) => set("de:" + f.chave, x)} placeholder="Início" />
              </div>
              <div className="hidden text-xs text-ink-500 md:block">
                <span className="block mb-1">até</span>
                <DataCampo className="block" value={v["ate:" + f.chave] ?? ""} onChange={(x) => set("ate:" + f.chave, x)} placeholder="Fim" />
              </div>
            </Fragment>
          );
        })}
        {ativos && (
          <button type="button" onClick={() => setV({})} className="hidden items-center gap-1 text-xs font-semibold text-primary hover:underline pb-2.5 md:inline-flex">
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </button>
        )}
        <span className="ml-auto hidden text-xs text-ink-500 pb-2.5 md:inline">
          {filtrados.length === itens.length ? `${itens.length} registro(s)` : `${filtrados.length} de ${itens.length}`}
        </span>
      </div>

      {moveis.length > 0 && (
        <>
          <BarraFiltros
            n={chips.length}
            chips={chips}
            onAbrir={() => {
              setRv(v);
              setFolha(true);
            }}
            resumo={filtrados.length === itens.length ? `${itens.length} registro(s)` : `${filtrados.length} de ${itens.length}`}
            onLimpar={() => setV({})}
          />
          <FolhaFiltros
            aberto={folha}
            onFechar={() => setFolha(false)}
            onLimpar={() => {
              setRv({});
              setV({});
            }}
            onAplicar={() => {
              setV(rv);
              setFolha(false);
            }}
          >
            {moveis.map((f, i) =>
              f.tipo === "selecao" ? (
                <label key={"s:" + f.chave} className="block text-sm font-semibold">
                  {f.rotulo}
                  <select
                    value={rv["s:" + f.chave] ?? ""}
                    onChange={(e) => setR("s:" + f.chave, e.target.value)}
                    className="mt-1.5 block min-h-[44px] w-full rounded-[10px] border border-border bg-white px-3 text-sm font-normal text-ink-900"
                  >
                    <option value="">{f.todas ?? "Todas"}</option>
                    {(opcoes[f.chave] ?? []).map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              ) : f.tipo === "periodo" ? (
                <SecaoFiltro key={"p:" + f.chave} rotulo={f.rotulo} n={(rv["de:" + f.chave] ? 1 : 0) + (rv["ate:" + f.chave] ? 1 : 0)} aberta={i === 0}>
                  <div className="grid gap-3 p-3.5 text-xs text-ink-500">
                    <label>
                      <span className="mb-1 block">De</span>
                      <input type="date" value={rv["de:" + f.chave] ?? ""} onChange={(e) => setR("de:" + f.chave, e.target.value)} className="block min-h-[44px] w-full rounded-[10px] border border-border bg-white px-3 text-sm text-ink-900" />
                    </label>
                    <label>
                      <span className="mb-1 block">Até</span>
                      <input type="date" value={rv["ate:" + f.chave] ?? ""} onChange={(e) => setR("ate:" + f.chave, e.target.value)} className="block min-h-[44px] w-full rounded-[10px] border border-border bg-white px-3 text-sm text-ink-900" />
                    </label>
                  </div>
                </SecaoFiltro>
              ) : null
            )}
          </FolhaFiltros>
        </>
      )}
      <div className="overflow-x-auto" ref={raiz}>
        <table className={className + " tab-cartao"}>
          {cabecalho}
          <tbody key={pg.giro} className={pg.classe}>
            {pg.itens.length === 0 ? (
              <tr>
                <td colSpan={20} className="py-8 text-center text-sm text-ink-500">
                  {vazio}
                </td>
              </tr>
            ) : (
              pg.itens.map((it) => <Fragment key={it.id}>{it.linha}</Fragment>)
            )}
          </tbody>
        </table>
      </div>
      <Paginador {...pg} />
    </div>
  );
}
