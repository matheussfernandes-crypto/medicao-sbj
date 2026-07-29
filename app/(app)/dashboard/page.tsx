import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { navItemsForSetor } from "@/components/nav-items";
import Carousel from "@/components/Carousel";
import MiniCalendar, { type EventoCalendario } from "@/components/MiniCalendar";
import { HardHat, BarChart3, Sparkles } from "lucide-react";

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome_completo, setor")
    .eq("id", user!.id)
    .single();

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
    const { data: pessoasRetencao } = await supabase
      .from("pessoas")
      .select("id, saldo_inicial_retido")
      .not("papel", "in", "(MESTRE,MESTRE_GERAL)");
    const { data: medicoesRetencao } = await supabase
      .from("lancamentos")
      .select("pessoa_id, total_reais, retencao_pct_usado")
      .in("tipo", ["MEDICAO", "VALE_MEDICAO"])
      .eq("status", "APROVADO");
    const { data: retiradas } = await supabase.from("retiradas_retido").select("pessoa_id, valor");

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

  // Slides de exemplo — quando o módulo "Andamento de Obra" e a agenda real
  // existirem, essas mesmas posições passam a vir de dados reais (fotos da
  // obra, gráfico de avanço físico, próximos compromissos).
  const slides = [
    <div
      key="andamento"
      className="h-full w-full flex flex-col items-center justify-center text-center gap-3 p-8 bg-primaryDark relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <HardHat className="w-10 h-10 text-accent relative" />
      <p className="text-white text-lg font-semibold relative">Em breve: Andamento de Obra</p>
      <p className="text-white/60 text-sm max-w-sm relative">
        Fotos e o progresso físico de cada obra vão aparecer bem aqui, direto no seu painel.
      </p>
    </div>,
    <div
      key="graficos"
      className="h-full w-full flex flex-col items-center justify-center text-center gap-3 p-8 bg-white"
    >
      <BarChart3 className="w-10 h-10 text-primary" />
      <p className="text-primaryDark text-lg font-semibold">Gráficos de avanço em destaque</p>
      <p className="text-ink-500 text-sm max-w-sm">
        Assim que o andamento físico for cadastrado, os gráficos de progresso de cada obra também vão girar por aqui.
      </p>
    </div>,
    <div
      key="novidade"
      className="h-full w-full flex flex-col items-center justify-center text-center gap-3 p-8"
      style={{ background: "linear-gradient(135deg, #2c6975, #1c474f)" }}
    >
      <Sparkles className="w-10 h-10 text-accent" />
      <p className="text-white text-lg font-semibold">Painel novo por aqui!</p>
      <p className="text-white/60 text-sm max-w-sm">
        Menu lateral fixo, KPIs em tempo real e navegação mais rápida entre obras.
      </p>
    </div>,
  ];

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
          <Carousel slides={slides} intervalMs={7000} />
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
