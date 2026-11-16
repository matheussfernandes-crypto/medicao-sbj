import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carregarAndamento } from "@/app/(app)/andamento-novo/dados";
import { chaveAp, mapaApontamentos, montarIndice, pct } from "@/app/(app)/andamento-novo/calculo";
import { alvosDeItens, alvosDeLocais, montarFatias, somaRecorte } from "@/app/(app)/andamento-novo/fatias";

// Para a página Vistorias (Controle de entregas): % de conclusão de cada empreendimento do Andamento
// e a situação da Pintura Final de cada apartamento. Usa o mesmo cálculo da tela do Andamento.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Ilha de Capri" → "capri" (a mesma chave é usada no site para ligar ao empreendimento do pós-obra)
const chaveEmp = (nome: string) =>
  String(nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^residencial\s+/, "")
    .replace(/^ilhas?\s+(de|do|da|dos|das)\s+/, "")
    .replace(/^ilhas?\s+/, "")
    .trim();

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, erro: "Sem acesso." }, { status: 401 });
  const { data: perfil } = await supabase.from("perfis").select("status").eq("id", user.id).single();
  if (perfil?.status !== "aprovado") return NextResponse.json({ ok: false, erro: "Sem acesso." }, { status: 403 });

  const { data: obras } = await supabase.from("andamento_novo_obras").select("id, nome").is("excluida_em", null);
  const empreendimentos = [];
  for (const o of obras ?? []) {
    const d = await carregarAndamento(o.id);
    // carregarAndamento cai na primeira obra se a pedida não estiver disponível para esta pessoa: confere antes
    if (!d || d.obra.id !== o.id) continue;
    const idx = montarIndice(d.categorias, d.servicos, d.vinculos);
    const ap = mapaApontamentos(d.apontamentos);
    const fat = montarFatias({ servicos: d.servicos, sistemas: d.sistemas, itens: d.itens, categorias: d.categorias, vinculos: d.vinculos });
    const total = somaRecorte(fat, idx, ap, [...alvosDeLocais(d.locais), ...alvosDeItens(d.itens)]);
    const pintura = d.servicos.find((s) => chaveEmp(s.nome) === "pintura final");
    const aptos = d.locais
      // no Andamento o apartamento aparece como "Apto 1501" ou "Apartamento 1206" (depende da obra)
      .filter((l) => /^(apto|apartamento)\s/i.test(l.nome))
      .map((l) => ({
        unit: l.nome.replace(/^(apto|apartamento)\s*/i, "").trim(),
        // 0 não iniciado · 1 andamento · 2 finalizado · 3 ausência
        pintura: pintura ? ap.get(chaveAp(l.id, pintura.id))?.status ?? 0 : null,
      }));
    empreendimentos.push({
      id: o.id,
      nome: o.nome,
      chave: chaveEmp(o.nome),
      pct: Math.round(pct(total) * 10) / 10,
      temPintura: !!pintura,
      aptos,
    });
  }
  empreendimentos.sort((a, b) => b.pct - a.pct);
  return NextResponse.json({ ok: true, empreendimentos });
}
