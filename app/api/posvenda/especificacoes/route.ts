import { NextRequest, NextResponse } from "next/server";
import { erro, exigirPosvenda } from "@/lib/posvenda/server";
import { assinarImagens, urlImg } from "@/lib/especificacoes/imagem";
import { esquemaVidro } from "@/lib/especificacoes/desenho";
import { GRUPOS, descVidro, ehInterior, fold, medidasVidro, type Vidro } from "@/lib/especificacoes/regras";
import { desenhoInterior } from "@/lib/especificacoes/desenhoInteriores";

// Pós-venda: especificações da arquitetura (louças e metais, eletros, vidros) ligadas a uma unidade.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unidade = req.nextUrl.searchParams.get("unidade");
  if (!unidade) return erro("Falta a unidade", 400);
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const { supabase, user } = r;

  const { data: projetos } = await supabase.from("esp_projetos").select("id, codigo, titulo, cliente").eq("unidade_id", unidade).order("codigo");
  if (!projetos?.length) return NextResponse.json({ projetos: [] });
  const ids = projetos.map((p) => p.id);
  const [{ data: itens }, { data: perfil }] = await Promise.all([
    supabase.from("esp_itens").select("projeto_id, grupo, ambiente, material, referencia, medidas, qtd, img, ordem, vidro, campos").in("projeto_id", ids).order("ordem"),
    supabase.from("perfis").select("setor").eq("id", user.id).maybeSingle(),
  ]);
  const assinadas = await assinarImagens(supabase, (itens ?? []).map((i) => i.img));
  const origem = req.nextUrl.origin;

  const saida = projetos.map((p) => ({
    id: p.id,
    titulo: p.titulo,
    cliente: p.cliente,
    grupos: GRUPOS.map((g) => {
      const doGrupo = (itens ?? []).filter((i) => i.projeto_id === p.id && i.grupo === g.id);
      const amb = new Map<string, { nome: string; itens: unknown[] }>();
      for (const i of doGrupo) {
        const k = fold(i.ambiente).trim() || "-";
        if (!amb.has(k)) amb.set(k, { nome: i.ambiente || "Sem ambiente", itens: [] });
        const v = (i.vidro ?? {}) as Vidro;
        const src = urlImg(i.img, assinadas);
        amb.get(k)!.itens.push({
          material: i.material,
          referencia: g.id === "vidros" ? descVidro(i.material, v) : i.referencia,
          medidas: g.id === "vidros" ? medidasVidro(v) : i.medidas,
          qtd: i.qtd,
          img: src ? (src.startsWith("/") ? origem + src : src) : "",
          desenho: src ? "" : g.id === "vidros" ? esquemaVidro(i.material, v) : ehInterior(g.id) ? desenhoInterior(g.id, i.campos ?? {}) : "",
        });
      }
      return { id: g.id, label: g.label, ambientes: Array.from(amb.values()) };
    }).filter((g) => g.ambientes.length),
  }));
  return NextResponse.json({ projetos: saida, podeEditar: ["ADMIN", "ARQUITETO"].includes(perfil?.setor ?? "") });
}
