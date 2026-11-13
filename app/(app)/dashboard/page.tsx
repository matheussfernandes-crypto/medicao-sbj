import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { navItemsForSetor } from "@/components/nav-items";
import Carousel from "@/components/Carousel";
import MiniCalendar, { type EventoCalendario } from "@/components/MiniCalendar";
import { HardHat } from "lucide-react";
import { agendaDoSetor } from "@/lib/agenda-setor";
import { ehGestorAcessos, permitido } from "@/lib/acessos/modulos";
import { carregarPainelObras } from "./painel-obras";
import SlideObra from "./SlideObra";
import PainelObrasSeletor from "./PainelObrasSeletor";
import PersonalizarAtalhos from "@/components/PersonalizarAtalhos";
import RegistroRapido from "@/components/RegistroRapido";

export default async function DashboardPage() {
  const supabase = createClient();
  const user = await getUsuarioAtual();
  const { data: perfil } = await perfilDaRequisicao(user!.id);

  const setor = perfil?.setor ?? "ESTAGIARIO";

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
    slides.push(<SlideObra key={"obra-" + prog.obraId} p={prog} fotos={painel.fotos.filter((f) => f.obraId === prog.obraId)} />);
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
  const eventosAgenda: EventoCalendario[] = await agendaDoSetor(supabase, user!.email, (meuPerfil?.acessos as string[] | null) ?? [], setor);

  return (
    <div className="space-y-7">
      {/* saudação e, no lugar do subtítulo, o registro rápido */}
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink-900">
          Olá, {perfil?.nome_completo?.split(" ")[0] ?? "bem-vindo"}
        </h1>
        {(setor === "ARQUITETO" || ehGestorAcessos(user!.email)) && <RegistroRapido />}
      </div>

      {/* atalhos do setor, escolhidos pela pessoa */}
      <div className="space-y-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="relative h-full">
            <Carousel slides={slides} intervalMs={14000} />
            {setor === "ADMIN" && <PainelObrasSeletor obras={painel.obras} />}
          </div>
        </div>
        <MiniCalendar eventos={eventosAgenda} />
      </div>

    </div>
  );
}
