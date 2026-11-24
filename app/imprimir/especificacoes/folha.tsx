// Folha de especificação no padrão dos PDFs da SBJ (logo, faixa verde #1c474f, tabela com cabeçalho verde e zebra).
// Usada pela folha de um projeto e pelo PDF do prédio inteiro (uma folha por unidade/lazer e grupo).
import { urlImg } from "@/lib/especificacoes/imagem";
import { esquemaVidro } from "@/lib/especificacoes/desenho";
import { GRUPOS, descVidro, fold, medidasVidro, type Grupo, type Vidro } from "@/lib/especificacoes/regras";

export type ItemFolha = { id: string; ambiente: string; material: string; referencia: string; medidas: string; qtd: number; img: string; vidro: unknown };

export function FolhaEspecificacao({
  grupo, titulo, sub, rev, obs, itens, assinadas, ambientesVazios = [], rodape, quebra = false,
}: {
  grupo: Grupo; titulo?: string; sub: string; rev: string; obs?: string | null; itens: ItemFolha[]; assinadas: Record<string, string>;
  ambientesVazios?: string[]; rodape: string; quebra?: boolean;
}) {
  const g = GRUPOS.find((x) => x.id === grupo)!;
  const vidros = grupo === "vidros";
  const ambientes = new Map<string, { nome: string; itens: ItemFolha[] }>();
  for (const i of itens) {
    const k = fold(i.ambiente).trim() || "-";
    if (!ambientes.has(k)) ambientes.set(k, { nome: i.ambiente || "Sem ambiente", itens: [] });
    ambientes.get(k)!.itens.push(i);
  }
  for (const a of ambientesVazios) if (!ambientes.has(fold(a).trim())) ambientes.set(fold(a).trim(), { nome: a, itens: [] });
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <div className={`folha${vidros ? " vid" : ""}${quebra ? " quebra" : ""}`}>
      <div className="topo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo-pdf.png" alt="SBJ" />
        <div className="centro">
          <h1>{titulo ?? `Especificação · ${g.label}`}</h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="dir">
          <div>SBJ Construtora e Incorporadora</div>
          <div>Revisão {rev}</div>
          <div>Emitido em: {hoje}</div>
        </div>
      </div>
      {obs && <div className="obs">{obs}</div>}
      {!ambientes.size && <p className="sub">Nenhum item especificado neste grupo.</p>}
      <div className="corpo">
        {Array.from(ambientes.values()).map((a) => (
          <section className="amb" key={a.nome}>
            <h2>{a.nome}</h2>
            <table>
              <thead>
                <tr>
                  <th className="im">Imagem</th>
                  <th className="mt">Material</th>
                  <th>{vidros ? "Descrição" : "Referência"}</th>
                  {g.medidas && <th className="md">Medidas</th>}
                  <th className="qt">Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {!a.itens.length && (
                  <tr>
                    <td colSpan={g.medidas ? 5 : 4} className="vazio">A definir.</td>
                  </tr>
                )}
                {a.itens.map((i) => {
                  const v = (i.vidro ?? {}) as Vidro;
                  const src = urlImg(i.img, assinadas);
                  return (
                    <tr key={i.id}>
                      <td className="im">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" />
                        ) : vidros ? (
                          <span className="esq" dangerouslySetInnerHTML={{ __html: esquemaVidro(i.material, v) }} />
                        ) : (
                          <span className="sem" />
                        )}
                      </td>
                      <td className="mt">{(i.material || "").toUpperCase()}</td>
                      <td className="rf">{vidros ? descVidro(i.material, v) : i.referencia}</td>
                      {g.medidas && <td className="md">{vidros ? medidasVidro(v) : i.medidas}</td>}
                      <td className="qt">{i.qtd || 1}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <div className="rodape">
        <span>SBJ Construtora e Incorporadora · Especificação de {g.label.toLowerCase()}</span>
        <span>{rodape}</span>
      </div>
    </div>
  );
}

// mesmas cores e estrutura dos PDFs da SBJ (lib/pdf): faixa verde-escura #1c474f, cabeçalho de tabela verde, linhas zebradas
export function cssFolha(a3: boolean) {
  return `
  html, body { background: #eef1f4 !important; }
  #intro { display: none !important; }
  .fg { --verde: #1c474f; --verde2: #2c6975; --linha: #dde3e8; --zebra: #f7f9fb; --texto: #1f2733; --suave: #65707d;
    font-family: Helvetica, Arial, sans-serif; font-size: ${a3 ? "11pt" : "9pt"}; line-height: 1.4; color: var(--texto); }
  @page { size: ${a3 ? "A3" : "A4"} landscape; margin: 10mm; }
  .fg * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fg .barra { position: sticky; top: 0; z-index: 5; padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--linha); font-size: 13px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; color: #333; }
  .fg .barra button { padding: 8px 18px; background: var(--verde2); color: #fff; border: 0; border-radius: 10px; cursor: pointer; font: 600 13px Helvetica, Arial, sans-serif; }
  .fg .folha { width: ${a3 ? 420 : 297}mm; max-width: 100%; margin: 18px auto; padding: 10mm; background: #fff; }
  .fg .topo { display: flex; align-items: center; gap: 6mm; border-bottom: 3px solid var(--verde); padding-bottom: 4mm; margin-bottom: 6mm; }
  .fg .logo { width: ${a3 ? "28mm" : "20mm"}; height: ${a3 ? "28mm" : "20mm"}; object-fit: contain; }
  .fg .centro { flex: 1; text-align: center; }
  .fg h1 { font-size: ${a3 ? "24pt" : "17pt"}; font-weight: 700; color: var(--verde); margin: 1mm 0 0; }
  .fg .sub { font-size: ${a3 ? "15pt" : "11pt"}; font-weight: 600; color: #2b3440; margin: 2mm 0 0; }
  .fg .dir { font-size: ${a3 ? "11pt" : "8.5pt"}; color: #2b3440; text-align: right; line-height: 1.6; white-space: nowrap; }
  .fg .obs { background: #e8f1f3; border-left: 3px solid var(--verde); border-radius: 0 4px 4px 0; padding: 2.5mm 4mm; margin: 0 0 5mm; font-weight: 700; color: var(--verde); }
  .fg .corpo { column-count: 2; column-gap: 10mm; }
  .fg .amb { margin-bottom: 6mm; break-inside: avoid; }
  .fg h2 { font-size: ${a3 ? "13pt" : "10pt"}; font-weight: 700; color: var(--verde); margin: 0 0 1.5mm; break-after: avoid; text-transform: uppercase; letter-spacing: .03em; }
  .fg table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .fg thead { display: table-header-group; }
  .fg th { background: var(--verde); color: #fff; text-align: left; font-size: ${a3 ? "8.5pt" : "7pt"}; font-weight: 700; text-transform: uppercase; padding: 1.8mm 2mm; border: 0.4px solid #333; }
  /* o estilo geral das tabelas do site (anima.css: table thead th) deixa o texto escuro; aqui é sempre branco sobre o verde */
  .fg table thead th, .fg table thead th * { color: #fff !important; background: var(--verde) !important; }
  .fg td { padding: 1.8mm 2mm; border: 0.4px solid var(--linha); vertical-align: middle; white-space: pre-line; }
  .fg tbody tr:nth-child(even) td { background: var(--zebra); }
  .fg tr { break-inside: avoid; }
  .fg .im { width: ${a3 ? "29mm" : "25mm"}; } .fg .mt { width: ${a3 ? "32mm" : "27mm"}; } .fg .md { width: 33mm; } .fg .qt { width: 12mm; text-align: center; }
  .fg td.im img, .fg td.im .sem { display: block; margin: 0 auto; width: ${a3 ? "25mm" : "21mm"}; height: ${a3 ? "19mm" : "16mm"}; object-fit: contain; background: #fff; }
  .fg td.im .sem { border: 1px dashed var(--linha); }
  .fg .vid .im { width: 46mm; } .fg .vid td.im img { width: 42mm; height: 30mm; } .fg .vid td.im .esq { display: block; width: 42mm; height: 30mm; margin: 0 auto; }
  .fg td.mt { font-size: ${a3 ? "9pt" : "7.6pt"}; font-weight: 700; color: var(--verde); }
  .fg td.md { font-size: ${a3 ? "9.5pt" : "8pt"}; color: #444; }
  .fg td.qt { font-weight: 700; }
  .fg td.vazio { color: var(--suave); font-style: italic; text-align: center; }
  .fg .rodape { margin-top: 6mm; padding-top: 2mm; border-top: 1px solid var(--linha); font-size: ${a3 ? "9pt" : "7pt"}; color: var(--suave); display: flex; justify-content: space-between; }
  @media print {
    html, body { background: #fff !important; } .fg .barra { display: none; } .fg .folha { width: auto; margin: 0; padding: 0; }
    .fg .folha.quebra { break-before: page; }
  }
  `;
}
