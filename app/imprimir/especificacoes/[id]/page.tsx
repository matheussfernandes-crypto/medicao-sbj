import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/getCurrentUserProfile";
import { assinarImagens, urlImg } from "@/lib/especificacoes/imagem";
import { esquemaVidro } from "@/lib/especificacoes/desenho";
import { GRUPOS, descVidro, ehGrupo, fold, medidasVidro, type Grupo, type Vidro } from "@/lib/especificacoes/regras";
import BarraImprimir from "./BarraImprimir";

export const dynamic = "force-dynamic";

type Props = { params: { id: string }; searchParams: { grupo?: string } };

async function carregar({ params, searchParams }: Props) {
  const user = await getUsuarioAtual();
  if (!user) redirect("/login");
  const supabase = createClient();
  const grupo: Grupo = ehGrupo(searchParams.grupo) ? searchParams.grupo : "metais";
  const [{ data: projeto }, { data: itens }, { data: nota }] = await Promise.all([
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente").eq("id", params.id).maybeSingle(),
    supabase.from("esp_itens").select("id, ambiente, material, referencia, medidas, qtd, img, ordem, vidro").eq("projeto_id", params.id).eq("grupo", grupo).order("ordem"),
    supabase.from("esp_notas").select("obs, rev, papel").eq("projeto_id", params.id).eq("grupo", grupo).maybeSingle(),
  ]);
  if (!projeto) return null;
  const g = GRUPOS.find((x) => x.id === grupo)!;
  const rev = (nota?.rev || "R0").toUpperCase();
  // nome do arquivo no padrão SBJ: ESPECIFICAÇÃO - LOUÇAS E METAIS - 701 CAMPECHE - R0
  const arquivo = ["ESPECIFICAÇÃO", g.label, projeto.titulo, rev].filter(Boolean).join(" - ").toUpperCase().replace(/[\\/:*?"<>|]/g, "");
  return { supabase, projeto, itens: itens ?? [], nota, g, rev, arquivo };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await carregar(props);
  return { title: d ? d.arquivo : "Especificações" };
}

// Folha de especificação no padrão dos PDFs da SBJ: abre e chama a impressão; "Salvar como PDF" gera o arquivo.
export default async function ImprimirEspecificacao(props: Props) {
  const d = await carregar(props);
  if (!d) notFound();
  const { projeto, itens, nota, g, rev, arquivo } = d;
  const assinadas = await assinarImagens(d.supabase, itens.map((i) => i.img));
  const a3 = (nota?.papel ?? "a3p") !== "a4p";
  const vidros = g.id === "vidros";

  const ambientes = new Map<string, { nome: string; itens: typeof itens }>();
  for (const i of itens) {
    const k = fold(i.ambiente).trim() || "-";
    if (!ambientes.has(k)) ambientes.set(k, { nome: i.ambiente || "Sem ambiente", itens: [] });
    ambientes.get(k)!.itens.push(i);
  }
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const nomeProj = (projeto.titulo || "").replace(/^\s*\d{4}-\d+\s*[—-]\s*/, "");

  return (
    <div className="fg">
      <style>{css(a3, vidros)}</style>
      <BarraImprimir arquivo={arquivo} papel={a3 ? "A3 paisagem" : "A4 paisagem"} />
      <div className="folha">
        <div className="topo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/logo-pdf.png" alt="SBJ" />
          <div className="centro">
            <h1>Especificação · {g.label}</h1>
            <p className="sub">{[projeto.codigo, nomeProj, projeto.cliente].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="dir">
            <div>SBJ Construtora e Incorporadora</div>
            <div>Revisão {rev}</div>
            <div>Emitido em: {hoje}</div>
          </div>
        </div>
        {nota?.obs && <div className="obs">{nota.obs}</div>}
        {!itens.length && <p className="sub">Nenhum item especificado neste grupo.</p>}
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
          <span>{arquivo}</span>
        </div>
      </div>
    </div>
  );
}

// mesmas cores e estrutura dos PDFs da SBJ (lib/pdf): faixa verde-escura #1c474f, cabeçalho de tabela verde, linhas zebradas
function css(a3: boolean, vidros: boolean) {
  return `
  html, body { background: #eef1f4 !important; }
  #intro { display: none !important; }
  .fg { --verde: #1c474f; --verde2: #2c6975; --linha: #dde3e8; --zebra: #f7f9fb; --texto: #1f2733; --suave: #65707d;
    font-family: Helvetica, Arial, sans-serif; font-size: ${a3 ? "9.5pt" : "8.5pt"}; line-height: 1.4; color: var(--texto); }
  @page { size: ${a3 ? "A3" : "A4"} landscape; margin: 10mm; }
  .fg * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fg .barra { position: sticky; top: 0; z-index: 5; padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--linha); font-size: 13px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; color: #333; }
  .fg .barra button { padding: 8px 18px; background: var(--verde2); color: #fff; border: 0; border-radius: 10px; cursor: pointer; font: 600 13px Helvetica, Arial, sans-serif; }
  .fg .folha { width: ${a3 ? 420 : 297}mm; max-width: 100%; margin: 18px auto; padding: 10mm; background: #fff; }
  .fg .topo { display: flex; align-items: flex-start; gap: 10px; border-bottom: 2px solid var(--verde); padding-bottom: 3mm; margin-bottom: 5mm; }
  .fg .logo { width: 15mm; height: 15mm; object-fit: contain; }
  .fg .centro { flex: 1; text-align: center; }
  .fg h1 { font-size: ${a3 ? "16pt" : "13pt"}; font-weight: 700; color: var(--verde); margin: 1mm 0 0; }
  .fg .sub { font-size: ${a3 ? "9.5pt" : "8.5pt"}; color: #555; margin: 1mm 0 0; }
  .fg .dir { font-size: 7.5pt; color: #555; text-align: right; line-height: 1.5; }
  .fg .obs { background: #e8f1f3; border-left: 3px solid var(--verde); border-radius: 0 4px 4px 0; padding: 2.5mm 4mm; margin: 0 0 5mm; font-weight: 700; color: var(--verde); }
  .fg .corpo { column-count: 2; column-gap: 10mm; }
  .fg .amb { margin-bottom: 6mm; break-inside: avoid; }
  .fg h2 { font-size: ${a3 ? "11pt" : "9.5pt"}; font-weight: 700; color: var(--verde); margin: 0 0 1.5mm; break-after: avoid; text-transform: uppercase; letter-spacing: .03em; }
  .fg table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .fg thead { display: table-header-group; }
  .fg th { background: var(--verde); color: #fff; text-align: left; font-size: 6.8pt; font-weight: 700; text-transform: uppercase; padding: 1.5mm 2mm; border: 0.4px solid #333; }
  .fg td { padding: 1.8mm 2mm; border: 0.4px solid var(--linha); vertical-align: middle; white-space: pre-line; }
  .fg tbody tr:nth-child(even) td { background: var(--zebra); }
  .fg tr { break-inside: avoid; }
  .fg .im { width: ${a3 ? "29mm" : "25mm"}; } .fg .mt { width: ${a3 ? "32mm" : "27mm"}; } .fg .md { width: 33mm; } .fg .qt { width: 12mm; text-align: center; }
  .fg td.im img, .fg td.im .sem { display: block; margin: 0 auto; width: ${a3 ? "25mm" : "21mm"}; height: ${a3 ? "19mm" : "16mm"}; object-fit: contain; background: #fff; }
  .fg td.im .sem { border: 1px dashed var(--linha); }
  ${vidros ? ".fg .im { width: 46mm; } .fg td.im img { width: 42mm; height: 30mm; } .fg td.im .esq { display: block; width: 42mm; height: 30mm; margin: 0 auto; }" : ""}
  .fg td.mt { font-size: 7.4pt; font-weight: 700; color: var(--verde); }
  .fg td.md { font-size: 8pt; color: #444; }
  .fg td.qt { font-weight: 700; }
  .fg .rodape { margin-top: 6mm; padding-top: 2mm; border-top: 1px solid var(--linha); font-size: 7pt; color: var(--suave); display: flex; justify-content: space-between; }
  @media print { html, body { background: #fff !important; } .fg .barra { display: none; } .fg .folha { width: auto; margin: 0; padding: 0; } }
  `;
}
