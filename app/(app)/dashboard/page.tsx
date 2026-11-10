import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { navItemsForSetor } from "@/components/nav-items";
import Carousel from "@/components/Carousel";
import MiniCalendar, { type EventoCalendario } from "@/components/MiniCalendar";
import { HardHat } from "lucide-react";
import { carregarPainelObras } from "./painel-obras";
import SlideProgresso from "./SlideProgresso";
import PainelObrasSeletor from "./PainelObrasSeletor";

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const user = await getUsuarioAtual();
  const { data: perfil } = await perfilDaRequisicao(user!.id);

  const setor = perfil?.setor ?? "ESTAGIARIO";
  const mes = mesAtualISO();

  // KPIs — cada um é opcional e só é buscado/mostrado conforme o setor,
  // para não disparar consultas que o usuário não tem permissão de ver.
  const kpis: { label: string; value: string; hint?: string; href: string }[] = [];

  if (setor === "ADMIN") {
    const [{ count: cadastrosPendentes }, { count: lancamentosPendentes }, { data: medicoesMes }] =
      await Promise.all([
        supabase.from("perfis").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("lancamentos").select("id", { count: "exact", head: true }).eq("status", "PENDENTE"),
        supabase
          .from("lancamentos")
          .select("total_reais")
          .eq("tipo", "MEDICAO")
          .eq("status", "APROVADO")
          .eq("mes_referencia", mes),
      ]);

    const totalMedidoMes = (medicoesMes ?? []).reduce((s, l) => s + Number(l.total_reais ?? 0), 0);

    kpis.push(
      { label: "Cadastros pendentes", value: String(cadastrosPendentes ?? 0), href: "/admin/aprovacoes" },
      { label: "Lançamentos pendentes", value: String(lancamentosPendentes ?? 0), href: "/lancamentos" },
      { label: "Medido este mês", value: `R$ ${totalMedidoMes.toFixed(2)}`, hint: mes, href: "/admin/fechamento" }
    );
  }

  if (setor === "FINANCEIRO" || setor === "ADMIN") {
    const [{ data: pessoasRetencao }, { data: medicoesRetencao }, { data: retiradas }] = await Promise.all([
      supabase
        .from("pessoas")
        .select("id, saldo_inicial_retido")
        .not("papel", "in", "(MESTRE,MESTRE_GERAL)"),
      supabase
        .from("lancamentos")
        .select("pessoa_id, total_reais, retencao_pct_usado")
        .in("tipo", ["MEDICAO", "VALE_MEDICAO"])
        .eq("status", "APROVADO"),
      supabase.from("retiradas_retido").select("pessoa_id, valor"),
    ]);

    const retidoPorPessoa: Record<string, number> = {};
    for (const l of medicoesRetencao ?? []) {
      const pct = Number(l.retencao_pct_usado ?? 0);
      retidoPorPessoa[l.pessoa_id] = (retidoPorPessoa[l.pessoa_id] ?? 0) + Number(l.total_reais) * pct;
    }
    const retiradoPorPessoa: Record<string, number> = {};
    for (const r of retiradas ?? []) {
      retiradoPorPessoa[r.pessoa_id] = (retiradoPorPessoa[r.pessoa_id] ?? 0) + Number(r.valor);
    }
    const saldoRetidoGeral = (pessoasRetencao ?? []).reduce((soma, p) => {
      const totalRetido = Number(p.saldo_inicial_retido ?? 0) + (retidoPorPessoa[p.id] ?? 0);
      const totalRetirado = retiradoPorPessoa[p.id] ?? 0;
      return soma + (totalRetido - totalRetirado);
    }, 0);

    kpis.push({ label: "Saldo retido (geral)", value: `R$ ${saldoRetidoGeral.toFixed(2)}`, href: "/financeiro/retiradas" });
  }

  if (setor === "ESTAGIARIO") {
    const { count: meusPendentes } = await supabase
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("criado_por", user!.id)
      .eq("status", "PENDENTE");

    kpis.push({ label: "Meus lançamentos pendentes", value: String(meusPendentes ?? 0), href: "/lancamentos" });
  }

  const atalhos = navItemsForSetor(setor).filter((item) => item.href !== "/dashboard");

  // Carrossel: gráfico de andamento + fotos mais recentes de cada obra marcada
  // (o ADMIN escolhe quais pelo ícone de ajustes no canto do carrossel).
  const painel = await carregarPainelObras();
  const slides: React.ReactNode[] = [];
  for (const prog of painel.progresso) {
    slides.push(<SlideProgresso key={"prog-" + prog.obraId} p={prog} />);
    painel.fotos
      .filter((f) => f.obraId === prog.obraId)
      .forEach((f, i) =>
        slides.push(
          <div key={`foto-${prog.obraId}-${i}`} className="h-full w-full relative bg-primaryDark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.legenda ?? f.obraNome} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pt-12 pb-9">
              <p className="text-white font-semibold">{f.obraNome}</p>
              <p className="text-white/80 text-xs">
                Atualizado em {f.dataFoto.split("-").reverse().join("/")}
                {f.legenda ? ` · ${f.legenda}` : ""}
              </p>
            </div>
          </div>
        )
      );
  }
  if (slides.length === 0) {
    slides.push(
      <div key="vazio" className="h-full w-full flex flex-col items-center justify-center text-center gap-3 p-8 bg-primaryDark">
        <HardHat className="w-10 h-10 text-accent" />
        <p className="text-white text-lg font-semibold">Nenhuma obra no painel</p>
        <p className="text-white/60 text-sm max-w-sm">
          {setor === "ADMIN"
            ? "Use o ícone de ajustes no canto para escolher as obras que aparecem aqui."
            : "O administrador escolhe quais obras aparecem aqui."}
        </p>
      </div>
    );
  }
  function emDias(qtd: number) {
    const d = new Date();
    d.setDate(d.getDate() + qtd);
    return d.toISOString().slice(0, 10);
  }
  const eventosExemplo: EventoCalendario[] = [
    { data: emDias(2), label: "Fechamento mensal (previsto)" },
    { data: emDias(6), label: "Reunião de obra — Ilha de Capri" },
    { data: emDias(11), label: "Revisão de aprovações pendentes" },
    { data: emDias(17), label: "Vencimento de contrato — empresa terceirizada" },
  ];

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-ink-900">
          Olá, {perfil?.nome_completo?.split(" ")[0] ?? "bem-vindo"}
        </h1>
        <p className="text-sm text-ink-500">Visão geral do sistema de medição de empreiteiros.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="relative h-full">
            <Carousel slides={slides} intervalMs={7000} />
            {setor === "ADMIN" && <PainelObrasSeletor obras={painel.obras} />}
          </div>
        </div>
        <MiniCalendar eventos={eventosExemplo} />
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="stat-tile hover:shadow-panel transition-shadow">
              <span className="stat-label">{kpi.label}</span>
              <span className="stat-value">{kpi.value}</span>
              {kpi.hint && <span className="stat-hint">{kpi.hint}</span>}
            </Link>
          ))}
        </div>
      )}

      <div>
        <p className="nav-group-label !text-ink-400 !px-0">Acesso rápido</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {atalhos.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="card hover:shadow-panel transition-shadow flex items-start gap-3">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h2 className="font-semibold text-primaryDark">{item.label}</h2>
                  <p className="text-sm text-ink-500">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
