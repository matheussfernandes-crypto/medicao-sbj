"use client";

import { useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { BotaoIcone } from "./controles";
import { agruparPorFase, type Ctx, type OrdemLocal } from "./modelo";
import type { Servico } from "../types";

type Grupo = { id: string; nome: string; real: boolean; ids: string[] };

const btn = "text-xs px-2.5 py-1.5 border border-border rounded-md bg-white hover:bg-surface-subtle disabled:opacity-50";
const btnPri = "text-xs px-3 py-1.5 rounded-md bg-primary text-white font-medium disabled:opacity-50";

// Ordem dos serviços direto no relatório: arrastar (ou ▲ ▼) dentro da fase ou para outra fase, e reordenar as fases.
// A prévia muda na hora (OrdemLocal); só "Salvar ordem" grava. Status e fatias não mudam.
export default function PainelOrdem({
  ctx,
  ordem,
  onMudar,
  modelo,
  ocupado,
  erro,
  onSalvar,
  onVoltarModelo,
}: {
  ctx: Ctx;
  ordem: OrdemLocal | null;
  onMudar: (o: OrdemLocal | null) => void;
  modelo: { tem: boolean; difere: number };
  ocupado: boolean;
  erro: string | null;
  onSalvar: (noModelo: boolean) => void;
  onVoltarModelo: () => void;
}) {
  const categorias = useMemo(() => [...ctx.dados.categorias].sort((a, b) => a.ordem - b.ordem), [ctx.dados.categorias]);
  const [catId, setCatId] = useState<string>(categorias[0]?.id ?? "");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const servPorId = useMemo(() => new Map(ctx.dados.servicos.map((s) => [s.id, s])), [ctx.dados.servicos]);
  const grupos: Grupo[] = useMemo(() => {
    const servs = (ctx.idx.servicosDaCat.get(catId) ?? []).map((x) => x.servico);
    return agruparPorFase(servs, ctx).map((g) => ({ id: g.id, nome: g.nome, real: !g.id.startsWith("g:"), ids: g.servicos.map((s) => s.id) }));
  }, [ctx, catId]);

  const sujo = !!ordem && (Object.keys(ordem.serv).length > 0 || Object.keys(ordem.fases).length > 0);

  function moverServico(servId: string, destId: string, antesId: string | null) {
    const gs = grupos.map((g) => ({ ...g, ids: g.ids.filter((i) => i !== servId) }));
    const dest = gs.find((g) => g.id === destId);
    if (!dest) return;
    const pos = antesId ? dest.ids.indexOf(antesId) : -1;
    if (pos >= 0) dest.ids.splice(pos, 0, servId);
    else dest.ids.push(servId);
    const seq = gs.flatMap((g) => g.ids);
    // reaproveita os mesmos números de ordem que a categoria já usava, na nova sequência (a ordem das outras categorias não muda)
    const numeros = seq.map((id) => servPorId.get(id)!.ordem).sort((a, b) => a - b);
    const serv = { ...(ordem?.serv ?? {}) };
    seq.forEach((id, i) => {
      const s = servPorId.get(id)!;
      if (id === servId) serv[id] = { ordem: numeros[i], fase_id: dest.real ? dest.id : null, grupo: dest.nome };
      else if (s.ordem !== numeros[i] || serv[id]) serv[id] = { ordem: numeros[i], fase_id: s.fase_id ?? null, grupo: s.grupo };
    });
    onMudar({ serv, fases: { ...(ordem?.fases ?? {}) } });
  }
  function moverFase(faseId: string, dir: -1 | 1) {
    const reais = grupos.filter((g) => g.real);
    const i = reais.findIndex((g) => g.id === faseId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= reais.length) return;
    const fa = ctx.dados.fases.find((f) => f.id === reais[i].id)!;
    const fb = ctx.dados.fases.find((f) => f.id === reais[j].id)!;
    onMudar({ serv: { ...(ordem?.serv ?? {}) }, fases: { ...(ordem?.fases ?? {}), [fa.id]: fb.ordem, [fb.id]: fa.ordem } });
  }

  const nomeServ = (id: string) => (servPorId.get(id) as Servico | undefined)?.nome ?? "";

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-3">
      {modelo.tem && (
        <p className="text-sm rounded-md border px-3 py-2" style={{ background: "#eef6f7", borderColor: "#c9dfe2", color: "#1f4a52" }}>
          Existe um Modelo padrão. Esta ordem vale para esta obra; se quiser que ela também seja a do modelo, use <b>Salvar no modelo padrão</b> (as outras obras só recebem quando o modelo for aplicado).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-500">Categoria</span>
          <select value={catId} onChange={(e) => setCatId(e.target.value)} className="border border-border rounded-md px-2 py-1.5 text-sm bg-white">
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-ink-500">Arraste pela alça (ou use ▲ ▼). Dá para soltar o serviço em outra fase. A prévia muda na hora; os status e as fatias não mudam.</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grupos.length === 0 && <p className="text-sm text-ink-500">Esta categoria não tem serviços.</p>}
        {grupos.map((g, gi) => {
          const reais = grupos.filter((x) => x.real);
          const ri = reais.findIndex((x) => x.id === g.id);
          return (
            <div
              key={g.id}
              className={`rounded-lg border ${sobre === "g:" + g.id ? "border-primary bg-accent/20" : "border-border"} bg-white`}
              onDragOver={(e) => {
                if (arrastando) {
                  e.preventDefault();
                  setSobre("g:" + g.id);
                }
              }}
              onDragLeave={() => setSobre((v) => (v === "g:" + g.id ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                if (!arrastando) return;
                const id = arrastando;
                setArrastando(null);
                setSobre(null);
                moverServico(id, g.id, null); // solta no título da fase: vai para o fim dela
              }}
            >
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-subtle rounded-t-lg border-b border-border">
                <b className="text-sm text-primaryDark flex-1">
                  {g.nome} <span className="text-ink-400 font-normal text-xs">({g.ids.length})</span>
                </b>
                {g.real && (
                  <>
                    <BotaoIcone titulo="Fase para antes" disabled={ri === 0 || ocupado} onClick={() => moverFase(g.id, -1)}>
                      ▲
                    </BotaoIcone>
                    <BotaoIcone titulo="Fase para depois" disabled={ri === reais.length - 1 || ocupado} onClick={() => moverFase(g.id, 1)}>
                      ▼
                    </BotaoIcone>
                  </>
                )}
              </div>
              <ul className="p-1.5 space-y-0.5">
                {g.ids.map((id, li) => (
                  <li
                    key={id}
                    onDragOver={(e) => {
                      if (arrastando && arrastando !== id) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSobre(id);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!arrastando || arrastando === id) return;
                      const mov = arrastando;
                      setArrastando(null);
                      setSobre(null);
                      moverServico(mov, g.id, id);
                    }}
                    className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-sm ${sobre === id ? "outline outline-2 outline-primary" : "hover:bg-surface-subtle"} ${arrastando === id ? "opacity-40" : ""}`}
                  >
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", id);
                        setArrastando(id);
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setSobre(null);
                      }}
                      title="Arraste para mudar a ordem ou a fase"
                      className="cursor-grab text-ink-400 hover:text-primary"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0 truncate">{nomeServ(id)}</span>
                    <BotaoIcone titulo="Subir" disabled={li === 0 || ocupado} onClick={() => moverServico(id, g.id, g.ids[li - 1])}>
                      ▲
                    </BotaoIcone>
                    <BotaoIcone titulo="Descer" disabled={li === g.ids.length - 1 || ocupado} onClick={() => moverServico(id, g.id, g.ids[li + 2] ?? null)}>
                      ▼
                    </BotaoIcone>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {modelo.tem ? (
          <>
            <button className={btnPri} disabled={!sujo || ocupado} onClick={() => onSalvar(false)}>
              Salvar só nesta obra
            </button>
            <button className={btn} disabled={!sujo || ocupado} onClick={() => onSalvar(true)}>
              Salvar no modelo padrão
            </button>
          </>
        ) : (
          <button className={btnPri} disabled={!sujo || ocupado} onClick={() => onSalvar(false)}>
            Salvar ordem
          </button>
        )}
        <button className={btn} disabled={!sujo || ocupado} onClick={() => onMudar(null)}>
          Desfazer mudanças
        </button>
        {modelo.tem && modelo.difere > 0 && (
          <button
            className={btn}
            disabled={ocupado}
            onClick={() => window.confirm("Voltar a ordem e as fases desta obra para as do Modelo padrão? Os status e as fatias não mudam.") && onVoltarModelo()}
          >
            Voltar à ordem do modelo
          </button>
        )}
        {sujo && <span className="text-xs text-ink-500">Mudanças ainda não salvas: aparecem na prévia, no CSV, na impressão e no PDF.</span>}
      </div>
    </div>
  );
}
