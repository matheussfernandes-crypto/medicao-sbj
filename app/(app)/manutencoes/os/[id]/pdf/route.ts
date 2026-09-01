import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { OrdemServicoPdf, type OSPdfDados } from "@/lib/pdf/OrdemServicoPdf";
import {
  SETORES_MODULO,
  SOLICITANTE_TIPO_LABEL,
  ORIGEM_LABEL,
  CATEGORIA_LABEL,
  PROBLEMA_LABEL,
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  SERVICO_EXECUTADO_LABEL,
  GARANTIA_LABEL,
  ANEXO_TIPO_LABEL,
} from "../../../constants";

const TIPOS_FOTO = ["FOTO_CLIENTE", "FOTO_ANTES", "FOTO_DURANTE", "FOTO_DEPOIS"];

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user.id).single();
  if (!perfil || !SETORES_MODULO.includes(perfil.setor)) {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  const { data: os } = await supabase.from("manutencao_os").select("*").eq("id", params.id).single();
  if (!os) return NextResponse.json({ erro: "OS não encontrada." }, { status: 404 });

  const [{ data: obra }, { data: torre }, { data: pavimento }, { data: unidade }] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", os.obra_id).single(),
    os.torre_id ? supabase.from("torres").select("nome").eq("id", os.torre_id).single() : Promise.resolve({ data: null }),
    os.pavimento_id ? supabase.from("pavimentos").select("nome").eq("id", os.pavimento_id).single() : Promise.resolve({ data: null }),
    os.unidade_id ? supabase.from("unidades").select("nome").eq("id", os.unidade_id).single() : Promise.resolve({ data: null }),
  ]);

  const [{ data: funcionarios }, { data: empresas }] = await Promise.all([
    supabase.from("perfis").select("id, nome_completo").in("setor", ["ADMIN", "ARQUITETO", "ENGENHEIRO"]).eq("status", "aprovado"),
    supabase.from("empresas_terceirizadas").select("id, nome").eq("ativo", true),
  ]);

  let nomeResponsavel: string | null = null;
  if (os.responsavel_tipo === "FUNCIONARIO" && os.responsavel_perfil_id) {
    nomeResponsavel = (funcionarios ?? []).find((f) => f.id === os.responsavel_perfil_id)?.nome_completo ?? null;
  } else if (os.responsavel_tipo === "EMPRESA" && os.responsavel_empresa_id) {
    nomeResponsavel = (empresas ?? []).find((e) => e.id === os.responsavel_empresa_id)?.nome ?? null;
  }

  const { data: anexos } = await supabase
    .from("manutencao_anexos")
    .select("id, tipo, storage_path, nome_arquivo, criado_em")
    .eq("os_id", os.id)
    .order("criado_em", { ascending: true });

  const fotosAnexos = (anexos ?? []).filter((a) => TIPOS_FOTO.includes(a.tipo));
  const fotos = (
    await Promise.all(
      fotosAnexos.map(async (a) => {
        const { data: signed } = await supabase.storage.from("manutencao-anexos").createSignedUrl(a.storage_path, 300);
        return signed?.signedUrl ? { url: signed.signedUrl, legenda: ANEXO_TIPO_LABEL[a.tipo] ?? a.tipo } : null;
      })
    )
  ).filter((f): f is { url: string; legenda: string } => f !== null);

  const local = [torre?.nome, pavimento?.nome, unidade?.nome].filter(Boolean).join(" — ") || os.area_comum_texto || "—";

  const dados: OSPdfDados = {
    numeroOS: os.numero_os,
    criadoEm: new Date(os.criado_em).toLocaleString("pt-BR"),
    obraNome: obra?.nome ?? "—",
    local,
    status: os.status,
    statusLabel: STATUS_LABEL[os.status] ?? os.status,
    prioridadeLabel: PRIORIDADE_LABEL[os.prioridade] ?? os.prioridade,
    solicitanteNome: os.solicitante_nome,
    solicitanteTelefone: os.solicitante_telefone,
    solicitanteTipoLabel: SOLICITANTE_TIPO_LABEL[os.solicitante_tipo] ?? os.solicitante_tipo,
    origemLabel: ORIGEM_LABEL[os.origem] ?? os.origem,
    categoriaLabel: CATEGORIA_LABEL[os.categoria] ?? os.categoria,
    problemaLabel: PROBLEMA_LABEL[os.problema] ?? os.problema,
    descricao: os.descricao,
    responsavel: nomeResponsavel,
    servicoExecutadoLabel: os.servico_executado ? SERVICO_EXECUTADO_LABEL[os.servico_executado] ?? os.servico_executado : null,
    garantiaLabel: os.garantia_classificacao ? GARANTIA_LABEL[os.garantia_classificacao] ?? os.garantia_classificacao : null,
    materiaisUtilizados: os.materiais_utilizados,
    observacaoTecnica: os.observacao_tecnica,
    motivoReprovacao: os.motivo_reprovacao,
    fotos,
    dataEmissao: new Date().toLocaleString("pt-BR"),
  };

  const buffer = await renderToBuffer(OrdemServicoPdf({ dados }));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="OS-${os.numero_os}.pdf"`,
    },
  });
}
