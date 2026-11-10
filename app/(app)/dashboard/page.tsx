import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import Link from "next/link";
import { navItemsForSetor, type NavItem } from "@/components/nav-items";
import Carousel from "@/components/Carousel";
import CalendarioPainel, { type EventoCalendario } from "@/components/CalendarioPainel";
import { HardHat } from "lucide-react";
import { carregarPainelObras } from "./painel-obras";
import SlideProgresso from "./SlideProgresso";
import PainelObrasSeletor from "./PainelObrasSeletor";

function emDias(qtd: number) {
  const d = new Date();
  d.setDate(d.getDate() + qtd);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const user = await getUsuarioAtual();
  const { data: perfil } = await perfilDaRequisicao(user!.id);
  const setor = perfil?.setor ?? "ESTAGIARIO";

  // Obra em destaque: só as obras em andamento (ainda não 100%), girando no carrossel.
  const painel = await carregarPainelObras();
  const emAndamento = painel.progresso.filter((p) => p.unidades > 0 && p.pct < 100);
  const obrasDestaque = emAndamento.length ? emAndamento : painel.progresso;

  const slides: React.ReactNode[] = [];
  for (const prog of obrasDestaque) {
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
        <p className="text-white text-lg font-semibold">Nenhuma obra em andamento</p>
        <p className="text-white/60 text-sm max-w-sm">
          {setor === "ADMIN"
            ? "Use o ícone de ajustes no canto para escolher as obras que aparecem aqui."
            : "O administrador escolhe quais obras aparecem aqui."}
        </p>
      </div>
    );
  }

  // Marcações de exemplo, até a agenda real ser ligada.
  const eventos: EventoCalendario[] = [
    { data: emDias(2), label: "Fechamento mensal (previsto)", detalhe: "Fechamento do mês" },
    { data: emDias(6), label: "Reunião de obra — Ilha de Capri", detalhe: "Reunião de obra" },
    { data: emDias(11), label: "Revisão de aprovações pendentes", detalhe: "Aprovações" },
    { data: emDias(17), label: "Vencimento de contrato — empresa terceirizada", detalhe: "Contratos" },
  ];

  // Acesso rápido agrupado pela área do menu (Obras, Contratos, Manutenção, Pós-obra…)
  const atalhos = navItemsForSetor(setor).filter((item) => item.href !== "/dashboard");
  const grupos = atalhos.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.grupo] ??= []).push(item);
    return acc;
  }, {});

  const dataHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const nome = perfil?.nome_completo?.split(" ")[0] ?? "bem-vindo";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primaryDark">Olá, {nome}</h1>
          <p className="text-sm text-ink-500 mt-1">Visão geral das obras e dos chamados</p>
        </div>
        <p className="text-sm text-ink-500 capitalize">{dataHoje}</p>
      </div>

      <section aria-label="Obra em destaque">
        <div className="relative">
          <Carousel slides={slides} intervalMs={8000} />
          {setor === "ADMIN" && <PainelObrasSeletor obras={painel.obras} />}
        </div>
      </section>

      <section aria-label="Acesso rápido">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">Acesso rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(grupos).map(([nomeGrupo, itens]) => (
            <div key={nomeGrupo} className="rounded-2xl bg-surface-subtle p-3">
              <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{nomeGrupo}</p>
              <div className="space-y-1">
                {itens.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      className="group flex items-center gap-3 rounded-xl bg-white p-3 transition-all duration-200 hover:shadow-panel active:scale-[0.99]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-white">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-primaryDark">{item.label}</span>
                        <span className="block text-xs text-ink-500 truncate">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CalendarioPainel eventos={eventos} />
    </div>
  );
}
