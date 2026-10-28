"use client";

import { BotaoIcone, Seg } from "./controles";
import { distribuirFotos, type FotoRel, type FotosSel, type OndeFotos } from "./modelo";

// Escolha das fotos do relatório: vêm da aba Fotos; a ordem, a legenda e onde aparecem ficam salvas (por obra, ou por modelo).
export default function PainelFotos({ fotos, fs, onChange, dono, resumoLigado }: { fotos: FotoRel[]; fs: FotosSel; onChange: (fs: FotosSel) => void; dono: string; resumoLigado: boolean }) {
  const porId = new Map(fotos.map((f) => [f.id, f]));
  const sel = fs.sel.map((id) => porId.get(id)).filter(Boolean) as FotoRel[];
  const alternar = (id: string) => onChange({ ...fs, sel: fs.sel.includes(id) ? fs.sel.filter((x) => x !== id) : [...fs.sel, id] });
  const mover = (i: number, d: number) => {
    const ids = sel.map((f) => f.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onChange({ ...fs, sel: ids });
  };
  const legenda = (f: FotoRel) => fs.leg[f.id] ?? f.legenda;
  const onde: OndeFotos = fs.onde ?? "ambos";
  const dist = distribuirFotos(fs, sel, resumoLigado);
  const noResumo = new Map(dist.resumo.map((f, i) => [f.id, i + 1]));
  const noFinal = new Set(dist.final.map((f) => f.id));
  const mostraResumo = onde !== "final";

  return (
    <div className="space-y-4 border-t border-border pt-3 mt-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <b className="text-sm">Onde as fotos aparecem</b>
          <Seg
            valor={onde}
            onChange={(v) => onChange({ ...fs, onde: v })}
            opcoes={[
              ["resumo", "Só no resumo"],
              ["final", "Só no relatório final"],
              ["ambos", "Resumo + relatório final"],
            ]}
          />
        </div>
        {onde === "ambos" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!fs.repetir} onChange={(e) => onChange({ ...fs, repetir: e.target.checked })} />
            Repetir no relatório final as fotos do resumo
          </label>
        )}
        {mostraResumo && (
          <div className="flex flex-wrap items-center gap-3">
            <b className="text-sm">Quantas no resumo</b>
            <Seg valor={String(fs.n)} onChange={(v) => onChange({ ...fs, n: v === "6" ? 6 : 4 })} opcoes={[["4", "4 fotos"], ["6", "6 fotos"]]} />
          </div>
        )}
        <p className="text-xs text-ink-500">
          {onde === "resumo" && `As ${fs.n} primeiras ficam no quadro "Fotos da obra" do resumo. As outras selecionadas não aparecem no PDF.`}
          {onde === "final" && 'Nenhuma foto no resumo: todas as selecionadas vão para as páginas "Registro fotográfico", no fim do PDF.'}
          {onde === "ambos" && `As ${fs.n} primeiras vão para o resumo e as demais para o "Registro fotográfico"${fs.repetir ? " (que, com a opção acima, mostra todas)" : ""}.`} A escolha fica salva no {dono}.
        </p>
        {!resumoLigado && onde === "resumo" && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm" style={{ background: "#fdf6e0", borderColor: "#f0d58a", color: "#7a5a00" }}>
            <span>A página de resumo está desligada, então nenhuma foto vai aparecer.</span>
            <button type="button" className="text-xs px-2.5 py-1 border border-border rounded-md bg-white text-ink-900" onClick={() => onChange({ ...fs, onde: "final" })}>
              Mudar para relatório final
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="text-[11.5px] uppercase tracking-wide text-ink-500 font-bold mb-1.5">Fotos da obra (vêm da aba Fotos)</div>
        {fotos.length === 0 ? (
          <p className="text-sm text-ink-500">Esta obra ainda não tem fotos. Envie na aba Fotos.</p>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {fotos.map((f) => {
              const i = fs.sel.indexOf(f.id);
              return (
                <button key={f.id} type="button" onClick={() => alternar(f.id)} aria-pressed={i >= 0} className={`relative text-left rounded-lg overflow-hidden border-2 bg-surface-subtle ${i >= 0 ? "border-primary" : "border-transparent"}`}>
                  <span className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-md grid place-items-center text-xs font-extrabold border ${i >= 0 ? "bg-primary text-white border-primary" : "bg-white/90 border-gray-400"}`}>{i >= 0 ? i + 1 : ""}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="block w-full object-cover" style={{ aspectRatio: "4 / 3" }} />
                  <span className="block text-[11.5px] px-2 py-1 leading-snug">
                    {legenda(f) || "Sem legenda"}
                    <br />
                    <small className="text-ink-500">{f.data}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sel.length > 0 ? (
        <div>
          <div className="text-[11.5px] uppercase tracking-wide text-ink-500 font-bold mb-1.5">Selecionadas · ordem e legenda</div>
          <div className="space-y-1.5">
            {sel.map((f, i) => {
              const r = noResumo.get(f.id);
              const fin = noFinal.has(f.id);
              const rotulo = r && fin ? `Resumo ${r} + Final` : r ? `Resumo ${r}` : fin ? "Final" : "Fora do PDF";
              const cor = r ? "bg-primaryDark" : fin ? "bg-accent !text-primaryDark" : "bg-slate-300 !text-slate-600";
              return (
                <div key={f.id} className="grid items-center gap-2 border border-border rounded-lg p-1.5" style={{ gridTemplateColumns: "auto 64px 1fr auto auto auto" }}>
                  <span className={`text-[11px] font-extrabold text-white rounded px-1.5 py-0.5 whitespace-nowrap ${cor}`}>{rotulo}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="rounded object-cover" style={{ width: 64, height: 48 }} />
                  <input value={legenda(f)} onChange={(e) => onChange({ ...fs, leg: { ...fs.leg, [f.id]: e.target.value } })} aria-label="Legenda" className="border border-border rounded-md px-2 py-1 text-sm min-w-0" />
                  <BotaoIcone titulo="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>▲</BotaoIcone>
                  <BotaoIcone titulo="Descer" disabled={i === sel.length - 1} onClick={() => mover(i, 1)}>▼</BotaoIcone>
                  <BotaoIcone titulo="Tirar" vermelho onClick={() => alternar(f.id)}>✕</BotaoIcone>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-500">Marque as fotos que devem aparecer.</p>
      )}
    </div>
  );
}
