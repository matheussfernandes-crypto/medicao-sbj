"use client";

import { useMemo, useState } from "react";
import { BotaoIcone, Chave, Chip, Linha, Seg } from "./controles";
import type { Predefinicao } from "./predefinicoes";
import type { Ctx, Filtros, Formato, MontagemDados, MontagemSalva, Secao } from "./modelo";

const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Props = {
  ctx: Ctx;
  montagens: MontagemSalva[];
  atualId: string | null;
  predefs: Predefinicao[];
  filtroAtual: Filtros;
  fmtAtual: Formato;
  emPrevia: boolean;
  onSelecionar: (id: string) => void;
  onNova: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
  onMudar: (m: MontagemSalva) => void;
  onPrevia: () => void;
  onSairPrevia: () => void;
  onEscolherFotos: () => void;
};

function resumoSecao(ctx: Ctx, s: Secao) {
  const cats = s.filtro.cat.length ? ctx.dados.categorias.filter((c) => s.filtro.cat.includes(c.id)).map((c) => c.nome).join(", ") : "Todos os ambientes";
  const pavs = s.filtro.pav.length ? ctx.pavs.filter((p) => s.filtro.pav.includes(p.id)).map((p) => p.nome) : [];
  const partes = [cats, pavs.length ? "Pavimentos: " + (pavs.length > 4 ? pavs.length + " pavimentos" : pavs.join(", ")) : "", s.filtro.fases?.length ? "Fases: " + s.filtro.fases.join(", ") : "", s.linhas === "serv" ? "serviços nas linhas" : "pavimentos nas linhas", s.det === "ju" ? "juntos por pavimento" : ""];
  return partes.filter(Boolean).join(" · ");
}

function EditorSecao({ ctx, s, onChange }: { ctx: Ctx; s: Secao; onChange: (s: Secao) => void }) {
  const fases = useMemo(() => {
    const nomes = [...ctx.dados.fases].sort((a, b) => a.ordem - b.ordem).map((f) => f.nome);
    ctx.dados.servicos.forEach((sv) => {
      if (!sv.fase_id && sv.grupo && !nomes.includes(sv.grupo)) nomes.push(sv.grupo);
    });
    return nomes;
  }, [ctx]);
  const alterna = (campo: "cat" | "pav" | "fases", v: string) => {
    const atual = (s.filtro[campo] ?? []) as string[];
    const novo = atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v];
    onChange({ ...s, filtro: { ...s.filtro, [campo]: campo === "cat" && novo.length === ctx.dados.categorias.length ? [] : novo } });
  };
  const todos = (campo: "cat" | "pav" | "fases") => onChange({ ...s, filtro: { ...s.filtro, [campo]: [] } });
  const Grupo = ({ titulo, campo, itens }: { titulo: string; campo: "cat" | "pav" | "fases"; itens: { id: string; nome: string; cor?: string }[] }) => (
    <div>
      <div className="text-[11.5px] uppercase tracking-wide text-ink-500 font-bold mb-1">{titulo}</div>
      <div className="flex flex-wrap gap-1.5">
        <Chip ligado={!(s.filtro[campo] ?? []).length} tracejado onClick={() => todos(campo)}>
          Todos
        </Chip>
        {itens.map((i) => (
          <Chip key={i.id} ligado={(s.filtro[campo] ?? []).includes(i.id)} cor={i.cor} onClick={() => alterna(campo, i.id)}>
            {i.nome}
          </Chip>
        ))}
      </div>
    </div>
  );
  return (
    <div className="border-t border-dashed border-border pt-3 space-y-3">
      <Linha titulo="Nas linhas">
        <Seg valor={s.linhas} onChange={(v) => onChange({ ...s, linhas: v })} opcoes={[["local", "Pavimentos e locais"], ["serv", "Serviços"]]} />
      </Linha>
      <Linha titulo="Apartamentos e locais">
        <Seg valor={s.det} onChange={(v) => onChange({ ...s, det: v })} opcoes={[["un", "Um por um"], ["ju", "Juntos por pavimento"]]} />
      </Linha>
      <Grupo titulo="Ambientes" campo="cat" itens={ctx.dados.categorias.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor }))} />
      <Grupo titulo="Pavimentos" campo="pav" itens={ctx.pavs.map((p) => ({ id: p.id, nome: p.nome }))} />
      {s.filtro.pav.length > 0 && <p className="text-xs text-ink-500">Elevadores, caixa d'água e fachada não têm pavimento: saem quando você escolhe pavimentos.</p>}
      <Grupo titulo="Fases" campo="fases" itens={fases.map((n) => ({ id: n, nome: n }))} />
    </div>
  );
}

export default function PainelMontar(p: Props) {
  const { ctx } = p;
  const m = p.montagens.find((x) => x.id === p.atualId) ?? null;
  const [aberta, setAberta] = useState<number | null>(null);

  const mudaDados = (parte: Partial<MontagemDados>) => m && p.onMudar({ ...m, dados: { ...m.dados, ...parte } });
  const secoes = m?.dados.secoes ?? [];
  const setSecoes = (l: Secao[]) => mudaDados({ secoes: l });
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= secoes.length) return;
    const l = [...secoes];
    [l[i], l[j]] = [l[j], l[i]];
    setAberta(null);
    setSecoes(l);
  };

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="border border-border rounded-md px-2 py-1.5 text-sm bg-white" aria-label="Montagem salva" value={p.atualId ?? ""} onChange={(e) => { setAberta(null); p.onSelecionar(e.target.value); }}>
          {p.montagens.length === 0 && <option value="">Nenhuma montagem salva</option>}
          {p.montagens.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <button className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-white" onClick={p.onNova}>
          + Nova montagem
        </button>
        <button className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-white disabled:opacity-40" disabled={!m} onClick={p.onDuplicar}>
          Duplicar
        </button>
        <BotaoIcone titulo="Excluir montagem" vermelho disabled={!m} onClick={p.onExcluir}>✕</BotaoIcone>
      </div>

      {!m ? (
        <p className="text-sm text-ink-500">Crie uma montagem para juntar várias partes (filtro + formatação) num PDF só, com sumário e numeração contínua.</p>
      ) : (
        <>
          <input className="w-full border border-border rounded-md px-3 py-1.5 text-sm font-semibold" aria-label="Nome da montagem" value={m.nome} onChange={(e) => p.onMudar({ ...m, nome: e.target.value })} />
          <Linha titulo="Folha (vale pro PDF todo)">
            <Seg valor={m.dados.folha} onChange={(v) => mudaDados({ folha: v })} opcoes={[["v", "▯ Vertical"], ["h", "▭ Horizontal"]]} />
          </Linha>
          <Linha titulo="Tamanho">
            <Seg valor={m.dados.fill ? "s" : "n"} onChange={(v) => mudaDados({ fill: v === "s" })} opcoes={[["s", "Estender até ocupar a folha"], ["n", "Manter tamanho normal"]]} />
          </Linha>
          <Linha titulo="Títulos das colunas">
            <Seg valor={m.dados.titulos} onChange={(v) => mudaDados({ titulos: v })} opcoes={[["h", "Horizontal"], ["v", "Vertical"]]} />
          </Linha>
          <div className="flex flex-wrap gap-5">
            <Chave ligada={m.dados.resumo} onChange={(v) => mudaDados({ resumo: v })} texto="Resumo geral na 1ª página" />
            <Chave ligada={m.dados.sumario} onChange={(v) => mudaDados({ sumario: v })} texto="Sumário" />
          </div>

          <div className="space-y-2">
            {m.dados.resumo && (
              <div className="border border-dashed border-border rounded-lg bg-surface-subtle p-2.5 flex flex-wrap items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primaryDark text-white text-xs font-extrabold grid place-items-center">R</span>
                <b className="text-sm">Resumo geral</b>
                <span className="text-xs text-ink-500">números, linha do tempo, quadros, 3D, fotos ({Math.min(m.dados.fotos.n, m.dados.fotos.sel.length)}) e frentes</span>
                <button className="ml-auto text-xs px-2.5 py-1 border border-border rounded-md bg-white" onClick={p.onEscolherFotos}>
                  Escolher fotos
                </button>
              </div>
            )}
            {secoes.length === 0 && <p className="text-sm text-ink-500">Nenhuma seção ainda.</p>}
            {secoes.map((s, i) => (
              <div key={i} className="border border-border rounded-lg p-2.5 space-y-2 bg-white">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primaryDark text-white text-xs font-extrabold grid place-items-center">{i + 1}</span>
                  <input className="flex-1 min-w-[160px] border border-border rounded-md px-2 py-1 text-sm font-semibold" placeholder="Nome da seção" aria-label={`Nome da seção ${i + 1}`} value={s.nome} onChange={(e) => setSecoes(secoes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                  <BotaoIcone titulo="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</BotaoIcone>
                  <BotaoIcone titulo="Descer" disabled={i === secoes.length - 1} onClick={() => mover(i, 1)}>▼</BotaoIcone>
                  <button className={`text-xs px-2.5 py-1 border rounded-md ${aberta === i ? "bg-primary text-white border-primary" : "bg-white border-border"}`} onClick={() => setAberta(aberta === i ? null : i)}>
                    {aberta === i ? "Fechar" : "Editar"}
                  </button>
                  <BotaoIcone titulo="Tirar seção" vermelho onClick={() => { setAberta(null); setSecoes(secoes.filter((_, j) => j !== i)); }}>✕</BotaoIcone>
                </div>
                <div className="text-xs text-ink-500">{resumoSecao(ctx, s)}</div>
                {aberta === i && <EditorSecao ctx={ctx} s={s} onChange={(n) => setSecoes(secoes.map((x, j) => (j === i ? n : x)))} />}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[13px]">Adicionar seção:</b>
            <select
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-white disabled:opacity-50"
              aria-label="Adicionar seção de uma predefinição"
              disabled={!p.predefs.length}
              value=""
              onChange={(e) => {
                const pr = p.predefs[Number(e.target.value)];
                if (!pr) return;
                setSecoes([...secoes, { nome: pr.nome, filtro: copia(pr.filtros), linhas: pr.formato?.linhas ?? "local", det: pr.formato?.det ?? "un" }]);
              }}
            >
              <option value="">{p.predefs.length ? "De uma predefinição salva…" : "Nenhuma predefinição salva ainda"}</option>
              {p.predefs.map((x, i) => (
                <option key={x.id} value={i}>
                  {x.nome}
                </option>
              ))}
            </select>
            <button className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-white" onClick={() => { setSecoes([...secoes, { nome: `Seção ${secoes.length + 1}`, filtro: { pav: [], sis: [], cat: [], serv: [], fases: [] }, linhas: "local", det: "un" }]); setAberta(secoes.length); }}>
              + Em branco (escolher aqui)
            </button>
            <button className="text-xs px-2.5 py-1.5 border border-border rounded-md bg-white" onClick={() => { setSecoes([...secoes, { nome: "", filtro: copia(p.filtroAtual), linhas: p.fmtAtual.linhas, det: p.fmtAtual.det }]); setAberta(secoes.length); }}>
              + Com o filtro atual
            </button>
          </div>
          <p className="text-xs text-ink-500">Não precisa sair daqui: "Em branco" abre a seção já para escolher ambientes, pavimentos, fases e formatação. Cada seção começa numa folha nova; as páginas são numeradas em sequência, num PDF só. A montagem fica salva com o nome.</p>
          <div>
            {p.emPrevia ? (
              <button className="text-sm px-3 py-1.5 border border-border rounded-md bg-white" onClick={p.onSairPrevia}>
                Voltar ao relatório simples
              </button>
            ) : (
              <button className="text-sm px-3 py-1.5 rounded-md bg-primaryDark text-white" onClick={p.onPrevia}>
                Ver prévia desta montagem
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
