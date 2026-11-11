import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { navItemsForSetor } from "@/components/nav-items";
import Carousel from "@/components/Carousel";
import MiniCalendar, { type EventoCalendario } from "@/components/MiniCalendar";
import { HardHat } from "lucide-react";
import { agendaDoSetor } from "@/lib/agenda-setor";
import { ehGestorAcessos, itensLiberados, permitido } from "@/lib/acessos/modulos";
import { carregarPainelObras } from "./painel-obras";
import SlideProgresso from "./SlideProgresso";
import PainelObrasSeletor from "./PainelObrasSeletor";
import PersonalizarAtalhos from "@/components/PersonalizarAtalhos";
import RegistroRapido from "@/components/RegistroRapido";

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

  // quem vê o módulo de Medições (ou é gestor) vê o saldo retido geral
  const acessosPerfil = ((perfil as { acessos?: string[] | null } | null)?.acessos ?? []) as string[];
  const verMedicoes = setor === "FINANCEIRO" || setor === "ADMIN" || ehGestorAcessos(user!.email) || itensLiberados(acessosPerfil).has("contratos/medicoes");
  if (verMedicoes) {
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

  // atalhos: os que a pessoa escolheu (só entre as telas que ela acessa); padrão: os 6 primeiros
  const { data: meuPerfil } = await supabase.from("perfis").select("acessos, email, atalhos_home").eq("id", user!.id).single();
  const extrasHome = [...((meuPerfil?.acessos as string[] | null) ?? []), ...(ehGestorAcessos(user!.email) ? ["gestor_acessos"] : [])];
  // só as telas que a pessoa realmente abre (os módulos aparecem no menu para todos, mas nem todos têm acesso)
  const gestorHome = extrasHome.includes("gestor_acessos");
  const acessiveis = navItemsForSetor(setor, extrasHome).filter((item) => item.href !== "/dashboard" && (gestorHome || permitido(extrasHome, item.href)));
  const salvos = (meuPerfil?.atalhos_home as string[] | null) ?? null;
  const atalhos = salvos ? acessiveis.filter((i) => salvos.includes(i.href)) : acessiveis.slice(0, 6);

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
  // agenda individual: só os compromissos dos setores a que a pessoa tem acesso
  const eventosAgenda: EventoCalendario[] = await agendaDoSetor(supabase, user!.email, (meuPerfil?.acessos as string[] | null) ?? []);

  return (
    <>
      {/* saudação e, no lugar do subtítulo, o registro rápido */}
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-ink-900">
          Olá, {perfil?.nome_completo?.split(" ")[0] ?? "bem-vindo"}
        </h1>
        <RegistroRapido />
      </div>

      {/* atalhos do setor, escolhidos pela pessoa */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="nav-group-label !text-ink-400 !px-0 !py-0">Acesso rápido</p>
          <PersonalizarAtalhos opcoes={acessiveis.map((i) => ({ href: i.href, label: i.label }))} escolhidos={atalhos.map((i) => i.href)} />
        </div>
        {atalhos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {atalhos.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.description}
                  className="card !p-4 flex flex-col items-start gap-2 hover:shadow-panel hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200"
                >
                  <span className="w-9 h-9 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-semibold text-primaryDark leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card !p-4 text-sm text-ink-500">Nenhum atalho escolhido. Use “Personalizar atalhos”.</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="relative h-full">
            <Carousel slides={slides} intervalMs={7000} />
            {setor === "ADMIN" && <PainelObrasSeletor obras={painel.obras} />}
          </div>
        </div>
        <MiniCalendar eventos={eventosAgenda} />
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
    </>
  );
}
