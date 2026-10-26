import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { createClient } from "@/lib/supabase/server";
import { getMailer } from "@/lib/email/gmail";
import type { ConfigRelatorio, CorpoEmail, MetaRelatorio, PedidoRelatorio, RespostaRelatorio } from "@/app/(app)/andamento-novo/relatorio/tiposApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

chromium.setGraphicsMode = false; // sem WebGL: abre mais rápido
const BUCKET = "andamento-relatorios";
const LIMITE_ANEXO = 17 * 1024 * 1024; // o Gmail aceita 25 MB já com a codificação do e-mail; acima disso vai link
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const nomeArquivo = (obra: string) => `Relatorio-Andamento_${semAcento(obra).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}_${new Date().toISOString().slice(0, 10)}.pdf`;

// ---------- PDF: abre a página do relatório num Chromium sem tela e imprime (mesmo HTML/CSS da prévia, @page do tamanho escolhido) ----------
async function gerarPdf(origin: string, obraId: string, config: ConfigRelatorio) {
  const jar = cookies().getAll();
  const browser = await puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
  try {
    const page = await browser.newPage();
    const host = new URL(origin).hostname;
    // a página roda com o login de quem pediu o relatório (as regras de acesso do banco valem como na tela)
    await page.setCookie(...jar.map((c) => ({ name: c.name, value: c.value, domain: host, path: "/", secure: origin.startsWith("https") })));
    await page.evaluateOnNewDocument((cfg) => {
      (window as any).__RELATORIO_CFG__ = cfg;
    }, config as any);
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`${origin}/pdf/andamento-relatorio?obra=${encodeURIComponent(obraId)}`, { waitUntil: "networkidle0", timeout: 45000 });
    await page.waitForSelector("html[data-pronto], html[data-erro]", { timeout: 45000 });
    const erro = await page.evaluate(() => document.documentElement.getAttribute("data-erro"));
    if (erro) throw new Error(erro);
    const info = (await page.evaluate(() => (window as any).__relatorioInfo)) as { paginas: number; pct: number } | undefined;
    // sem estrutura de acessibilidade (tagged) e sem marcadores: arquivo menor e mais leve de abrir no celular
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: false, outline: false });
    return { pdf: Buffer.from(pdf), paginas: info?.paginas ?? 0, pct: info?.pct ?? 0 };
  } finally {
    await browser.close();
  }
}

function validarEmail(e: CorpoEmail): string | null {
  const lista = (e.destinatarios ?? []).map((x) => x.trim()).filter(Boolean);
  if (!lista.length) return "Informe pelo menos 1 destinatário.";
  if (lista.length > 4) return "No máximo 4 destinatários.";
  const ruim = lista.find((x) => !EMAIL_OK.test(x));
  if (ruim) return `E-mail inválido: ${ruim}`;
  if (new Set(lista.map((x) => x.toLowerCase())).size !== lista.length) return "Há destinatários repetidos.";
  if (!e.assunto?.trim()) return "Informe o assunto.";
  return null;
}

async function enviarEmail(opts: { para: string[]; assunto: string; mensagem: string; pdf: Buffer; nomePdf: string; link: string | null }) {
  const mailer = getMailer();
  if (!mailer) throw new Error("GMAIL_USER ou GMAIL_APP_PASSWORD não configurados no servidor.");
  const corpo = `<p>${esc(opts.mensagem).replace(/\r?\n/g, "<br>")}</p>` + (opts.link ? `<p>O arquivo era grande demais para anexar. <a href="${opts.link}">Baixar o relatório (PDF)</a> — link válido por 7 dias.</p>` : "") + `<p style="color:#65707d;font-size:12px">Engenharia SBJ · Andamento de Obra</p>`;
  await mailer.sendMail({
    from: `"Engenharia SBJ" <${process.env.GMAIL_USER}>`,
    to: opts.para.join(", "),
    subject: opts.assunto,
    html: corpo,
    attachments: opts.link ? [] : [{ filename: opts.nomePdf, content: opts.pdf }],
  });
}

async function quemSou(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("perfis").select("nome_completo, status").eq("id", user.id).single();
  if (perfil?.status !== "aprovado") return null;
  return { id: user.id, nome: perfil?.nome_completo ?? "", email: user.email ?? "" };
}

// ---------- GET: destinatários padrão / últimos usados da obra ----------
export async function GET(req: Request) {
  const supabase = createClient();
  const eu = await quemSou(supabase);
  if (!eu) return NextResponse.json({ ok: false, erro: "Sem acesso." }, { status: 401 });
  const obraId = new URL(req.url).searchParams.get("obra") ?? "";
  const { data } = await supabase.from("andamento_novo_destinatarios").select("padrao, ultimos").eq("obra_id", obraId).maybeSingle();
  const padrao = (data?.padrao as string[] | undefined) ?? [];
  const ultimos = (data?.ultimos as string[] | undefined) ?? [];
  return NextResponse.json({ ok: true, destinatarios: padrao.length ? padrao : ultimos, temPadrao: padrao.length > 0 });
}

// ---------- POST: gerar PDF / gerar e enviar / reenviar ----------
export async function POST(req: Request): Promise<NextResponse<RespostaRelatorio>> {
  const supabase = createClient();
  const eu = await quemSou(supabase);
  if (!eu) return NextResponse.json({ ok: false, erro: "Sem acesso." }, { status: 401 });
  let pedido: PedidoRelatorio;
  try {
    pedido = (await req.json()) as PedidoRelatorio;
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  }
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${host}`;

  // ----- reenviar: usa o PDF guardado, sem gerar de novo -----
  if (pedido.acao === "reenviar") {
    const erroE = validarEmail(pedido.email);
    if (erroE) return NextResponse.json({ ok: false, erro: erroE });
    const { data: ant } = await supabase.from("andamento_novo_relatorio_log").select("*").eq("id", pedido.logId).single();
    if (!ant?.pdf_path) return NextResponse.json({ ok: false, erro: "Este registro não tem cópia do PDF guardada." });
    const dl = await supabase.storage.from(BUCKET).download(ant.pdf_path);
    if (dl.error || !dl.data) return NextResponse.json({ ok: false, erro: "Não foi possível abrir o PDF guardado." });
    const pdf = Buffer.from(await dl.data.arrayBuffer());
    const para = pedido.email.destinatarios.map((x) => x.trim()).filter(Boolean);
    let situacao: "Enviado" | "Falhou" = "Enviado";
    let erroEnvio: string | null = null;
    let link: string | null = null;
    try {
      if (pdf.length > LIMITE_ANEXO) link = (await supabase.storage.from(BUCKET).createSignedUrl(ant.pdf_path, 7 * 24 * 3600)).data?.signedUrl ?? null;
      await enviarEmail({ para, assunto: pedido.email.assunto, mensagem: pedido.email.mensagem, pdf, nomePdf: nomeArquivo(ant.obra_nome), link });
    } catch (e: any) {
      situacao = "Falhou";
      erroEnvio = e?.message ?? "Falha no envio.";
    }
    const { data: nova } = await supabase
      .from("andamento_novo_relatorio_log")
      .insert({
        obra_id: ant.obra_id, obra_nome: ant.obra_nome, usuario_id: eu.id, usuario_nome: eu.nome, usuario_email: eu.email, acao: "EMAIL", tipo: ant.tipo, montagem_nome: ant.montagem_nome,
        filtro_resumo: ant.filtro_resumo, folha: ant.folha, paginas: ant.paginas, com_resumo: ant.com_resumo, pct_obra: ant.pct_obra, destinatarios: para, assunto: pedido.email.assunto,
        mensagem: pedido.email.mensagem, situacao, erro: erroEnvio, pdf_path: ant.pdf_path, pdf_bytes: ant.pdf_bytes, config: ant.config,
      })
      .select("id")
      .single();
    if (situacao === "Falhou") return NextResponse.json({ ok: false, erro: `Não foi possível enviar: ${erroEnvio}`, logId: nova?.id });
    return NextResponse.json({ ok: true, logId: nova?.id, enviadoPara: para, porLink: !!link });
  }

  // ----- gerar (e enviar) -----
  const { obraId, config, meta } = pedido;
  const { data: obra } = await supabase.from("andamento_novo_obras").select("id, nome").eq("id", obraId).is("excluida_em", null).maybeSingle();
  if (!obra) return NextResponse.json({ ok: false, erro: "Obra não encontrada." });
  const email = pedido.acao === "email" ? pedido.email : null;
  if (email) {
    const erroE = validarEmail(email);
    if (erroE) return NextResponse.json({ ok: false, erro: erroE });
  }
  const para = email ? email.destinatarios.map((x) => x.trim()).filter(Boolean) : null;

  const base = (m: MetaRelatorio) => ({
    obra_id: obra.id, obra_nome: obra.nome, usuario_id: eu.id, usuario_nome: eu.nome, usuario_email: eu.email, tipo: m.tipo, montagem_nome: m.montagemNome, filtro_resumo: m.filtroResumo,
    folha: m.folha, com_resumo: m.comResumo, config: config as any,
  });

  let gerado: { pdf: Buffer; paginas: number; pct: number };
  try {
    gerado = await gerarPdf(origin, obraId, config);
  } catch (e: any) {
    const msg = e?.message ?? "Falha ao gerar o PDF.";
    if (email)
      await supabase.from("andamento_novo_relatorio_log").insert({ ...base(meta), acao: "EMAIL", destinatarios: para, assunto: email.assunto, mensagem: email.mensagem, situacao: "Falhou", erro: `PDF não foi gerado: ${msg}` });
    return NextResponse.json({ ok: false, erro: `Não foi possível gerar o PDF: ${msg}` });
  }

  // cópia guardada (para baixar depois e reenviar)
  const caminho = `${obra.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.pdf`;
  const up = await supabase.storage.from(BUCKET).upload(caminho, gerado.pdf, { contentType: "application/pdf", upsert: false });
  const pdfPath = up.error ? null : caminho;

  let situacao: "Enviado" | "Falhou" | null = null;
  let erroEnvio: string | null = null;
  let link: string | null = null;
  if (email && para) {
    try {
      if (gerado.pdf.length > LIMITE_ANEXO) {
        if (!pdfPath) throw new Error("O PDF passou do limite de anexo e não foi possível guardá-lo para enviar o link.");
        link = (await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, 7 * 24 * 3600)).data?.signedUrl ?? null;
      }
      await enviarEmail({ para, assunto: email.assunto, mensagem: email.mensagem, pdf: gerado.pdf, nomePdf: nomeArquivo(obra.nome), link });
      situacao = "Enviado";
      // lembra os destinatários desta obra
      const atual = await supabase.from("andamento_novo_destinatarios").select("padrao").eq("obra_id", obra.id).maybeSingle();
      await supabase.from("andamento_novo_destinatarios").upsert({ obra_id: obra.id, padrao: email.salvarPadrao ? para : atual.data?.padrao ?? [], ultimos: para, atualizado_em: new Date().toISOString() });
    } catch (e: any) {
      situacao = "Falhou";
      erroEnvio = e?.message ?? "Falha no envio.";
    }
  }

  const { data: nova } = await supabase
    .from("andamento_novo_relatorio_log")
    .insert({
      ...base(meta), acao: email ? "EMAIL" : "PDF", paginas: gerado.paginas, pct_obra: gerado.pct, destinatarios: para, assunto: email?.assunto ?? null, mensagem: email?.mensagem ?? null,
      situacao, erro: erroEnvio, pdf_path: pdfPath, pdf_bytes: gerado.pdf.length,
    })
    .select("id")
    .single();

  const url = pdfPath ? (await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, 3600, { download: nomeArquivo(obra.nome) })).data?.signedUrl : undefined;
  if (email && situacao === "Falhou") return NextResponse.json({ ok: false, erro: `Não foi possível enviar: ${erroEnvio}`, logId: nova?.id, url, paginas: gerado.paginas, pct: gerado.pct });
  return NextResponse.json({ ok: true, logId: nova?.id, url, paginas: gerado.paginas, pct: gerado.pct, enviadoPara: para ?? undefined, porLink: !!link });
}
