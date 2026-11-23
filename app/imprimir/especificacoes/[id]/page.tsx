import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DM_Serif_Display, Montserrat } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/getCurrentUserProfile";
import { assinarImagens, urlImg } from "@/lib/especificacoes/imagem";
import { esquemaVidro } from "@/lib/especificacoes/desenho";
import { GRUPOS, descVidro, ehGrupo, fold, medidasVidro, type Grupo, type Vidro } from "@/lib/especificacoes/regras";
import BarraImprimir from "./BarraImprimir";

export const dynamic = "force-dynamic";

const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--fg-serif" });
const sans = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--fg-sans" });

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
  const sigla = fold((projeto.cliente || projeto.titulo || "CLIENTE").split(/\s+/)[0]).toUpperCase().replace(/[^A-Z0-9]/g, "") || "CLIENTE";
  return { supabase, projeto, itens: itens ?? [], nota, g, rev, arquivo: `${sigla}_${g.arq}_${rev}` };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await carregar(props);
  return { title: d ? d.arquivo : "Especificações" };
}

// Folha de especificação no padrão da FG (Flávia Guarezi Arquitetura): abre e chama a impressão; "Salvar como PDF" gera o arquivo.
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
    <div className={`fg ${serif.variable} ${sans.variable}`}>
      <style>{css(a3, vidros)}</style>
      <BarraImprimir arquivo={arquivo} papel={a3 ? "A3 paisagem" : "A4 paisagem"} />
      <div className="folha">
        <div className="topo">
          <div className="mono">FG</div>
          <div className="rev">
            Revisão {rev}
            <br />
            {hoje}
          </div>
        </div>
        <h1>{g.label}</h1>
        <p className="sub">{[nomeProj, projeto.cliente].filter(Boolean).join(" · ")}</p>
        <hr className="regua" />
        {nota?.obs && <div className="obs">{nota.obs}</div>}
        {!itens.length && <p className="sub">Nenhum item especificado neste grupo.</p>}
        <div className="corpo">
          {Array.from(ambientes.values()).map((a) => (
            <section className="amb" key={a.nome}>
              <h2>{a.nome}</h2>
              <table>
                <thead>
                  <tr>
                    <th className="im" />
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
          <span>Flávia Guarezi · Arquitetura de Interiores</span>
          <span>@arqflaviaguarezi</span>
        </div>
      </div>
    </div>
  );
}

function css(a3: boolean, vidros: boolean) {
  return `
  html, body { background: #f1ebe5 !important; }
  #intro { display: none !important; }
  .fg { --terra: #7d4f40; --areia: #f9f0ea; --linha: #e8ddd3; --grafite: #4d4d4d; --suave: #8a7f78;
    font-family: var(--fg-sans), 'Segoe UI', Arial, sans-serif; font-size: ${a3 ? "9.5pt" : "9pt"}; line-height: 1.45; color: #1c1c1c; }
  @page { size: ${a3 ? "A3" : "A4"} landscape; margin: 14mm 14mm 16mm; }
  .fg * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fg .barra { position: sticky; top: 0; z-index: 5; padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--linha); font-size: 13px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; color: #333; }
  .fg .barra button { padding: 8px 18px; background: var(--terra); color: #fff; border: 0; border-radius: 8px; cursor: pointer; font: 500 13px var(--fg-sans), Arial, sans-serif; }
  .fg .folha { width: ${a3 ? 420 : 297}mm; max-width: 100%; margin: 18px auto; padding: 14mm; background: #fff; }
  .fg .topo { display: flex; justify-content: space-between; align-items: center; padding-bottom: 5mm; }
  .fg .mono { font: 400 22pt/1 var(--fg-serif), Georgia, serif; color: var(--terra); letter-spacing: .04em; border: 1.2px solid var(--terra); border-radius: 50%; width: 15mm; height: 15mm; display: flex; align-items: center; justify-content: center; }
  .fg .rev { font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase; color: var(--suave); text-align: right; line-height: 1.6; }
  .fg h1 { font: 400 ${a3 ? "30pt" : "25pt"}/1.1 var(--fg-serif), Georgia, serif; margin: 6mm 0 1.5mm; color: #111; }
  .fg .sub { font-size: 10pt; color: var(--grafite); margin: 0 0 5mm; }
  .fg .regua { border: 0; border-top: 1.2px solid var(--terra); margin: 0 0 6mm; }
  .fg .obs { background: var(--areia); border-left: 3px solid var(--terra); border-radius: 0 6px 6px 0; padding: 3mm 4.5mm; margin: 0 0 7mm; font-size: 9pt; font-weight: 500; color: var(--terra); }
  .fg .corpo { column-count: 2; column-gap: 16mm; }
  .fg .amb { margin-bottom: 8mm; break-inside: avoid; }
  .fg h2 { font: 400 ${a3 ? "17pt" : "15pt"}/1.2 var(--fg-serif), Georgia, serif; margin: 0 0 2.5mm; color: var(--terra); break-after: avoid; }
  .fg table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .fg thead { display: table-header-group; }
  .fg th { text-align: left; font-size: 6.8pt; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--suave); padding: 0 2mm 1.6mm; border-bottom: 1px solid var(--terra); }
  .fg td { padding: 2.6mm 2mm; border-bottom: 1px solid var(--linha); vertical-align: middle; white-space: pre-line; }
  .fg tr { break-inside: avoid; }
  .fg .im { width: ${a3 ? "31mm" : "27mm"}; } .fg .mt { width: ${a3 ? "34mm" : "31mm"}; } .fg .md { width: 33mm; } .fg .qt { width: 12mm; text-align: center; }
  .fg td.im img, .fg td.im .sem { display: block; width: ${a3 ? "28mm" : "24mm"}; height: ${a3 ? "22mm" : "19mm"}; object-fit: contain; border: 1px solid var(--linha); border-radius: 2.5mm; background: #fff; }
  .fg td.im .sem { background: var(--areia); border-style: dashed; }
  ${vidros ? ".fg .im { width: 46mm; } .fg td.im img { width: 42mm; height: 30mm; } .fg td.im .esq { display: block; width: 42mm; height: 30mm; }" : ""}
  .fg td.mt { font-size: 7.6pt; font-weight: 600; letter-spacing: .08em; color: var(--terra); }
  .fg td.rf { font-size: ${a3 ? "9.8pt" : "9.2pt"}; }
  .fg td.md { font-size: 8.2pt; color: var(--grafite); }
  .fg td.qt { font-weight: 600; }
  .fg .rodape { margin-top: 10mm; padding-top: 3mm; border-top: 1px solid var(--linha); font-size: 7.3pt; letter-spacing: .06em; color: var(--suave); display: flex; justify-content: space-between; }
  @media print { html, body { background: #fff !important; } .fg .barra { display: none; } .fg .folha { width: auto; margin: 0; padding: 0; } }
  `;
}
