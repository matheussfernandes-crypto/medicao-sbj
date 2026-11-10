"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { itemDaRota, menuPorSetor, navItemsForSetor, type SecaoId } from "./nav-items";

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  ARQUITETO: "Arquiteto",
  ENGENHEIRO: "Engenheiro",
  MESTRE_GERAL: "Mestre Geral",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

// Menu em setores, no estilo do Sienge: coluna estreita de ícones (um por setor) e, ao lado, o painel do setor com os grupos e itens.
export default function Sidebar({
  setor,
  extras = [],
  contadores = {},
  mobileOpen,
  onClose,
}: {
  setor: string | null;
  extras?: string[];
  contadores?: Record<string, number>;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const secoes = useMemo(() => menuPorSetor(setor, extras), [setor, extras]);
  const itens = useMemo(() => navItemsForSetor(setor, extras), [setor, extras]);
  const itemAtual = itemDaRota(itens, pathname);

  // setor aberto no painel: o da página atual; clicar num ícone troca de setor sem sair da página
  const [ativa, setAtiva] = useState<SecaoId>(itemAtual?.secao ?? secoes.find((s) => !s.href)?.id ?? "inicio");
  const [painelAberto, setPainelAberto] = useState(true);
  const [fechados, setFechados] = useState<Record<string, boolean>>({});

  // Menu novo (com nomes, expansível) em todo o site. "Voltar ao menu anterior" alterna e a escolha fica salva neste navegador.
  const [menuNovo, setMenuNovo] = useState(true);
  useEffect(() => {
    try {
      setMenuNovo(localStorage.getItem("sbj-menu-novo") !== "antigo");
    } catch {}
  }, []);
  const trocarMenu = (novo: boolean) => {
    setMenuNovo(novo);
    try {
      localStorage.setItem("sbj-menu-novo", novo ? "novo" : "antigo");
    } catch {}
  };
  useEffect(() => {
    if (itemAtual) setAtiva(itemAtual.secao);
  }, [itemAtual?.secao]); // eslint-disable-line react-hooks/exhaustive-deps

  // painel recolhido lembrado neste navegador
  useEffect(() => {
    try {
      if (localStorage.getItem("sbj-menu-recolhido") === "1") setPainelAberto(false);
    } catch {}
  }, []);
  const mudarPainel = (v: boolean) => {
    setPainelAberto(v);
    try {
      localStorage.setItem("sbj-menu-recolhido", v ? "0" : "1");
    } catch {}
  };

  const secao = secoes.find((s) => s.id === ativa && !s.href) ?? secoes.find((s) => !s.href);
  const pendencias = (s: (typeof secoes)[number]) => s.grupos.flatMap((g) => g.itens).reduce((a, i) => a + (i.badgeKey ? contadores[i.badgeKey] ?? 0 : 0), 0);

  if (menuNovo) {
    return <MenuNovo pathname={pathname} secoes={secoes} itemAtual={itemAtual} contadores={contadores} mobileOpen={mobileOpen} onClose={onClose} onVoltar={() => trocarMenu(false)} />;
  }

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={
          "print:hidden fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 ease-out " +
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        {/* coluna de setores */}
        <div className="w-[60px] shrink-0 flex flex-col items-center bg-[#0e2a30] py-3 gap-1">
          <Link href="/dashboard" onClick={onClose} className="mb-2" title="Engenharia SBJ">
            <img src="/logo-topbar.png" alt="SBJ" className="h-9 w-auto" />
          </Link>
          <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto w-full px-1.5" aria-label="Setores">
            {secoes.map((s) => {
              const Icon = s.icon;
              const eAtiva = s.href ? pathname === s.href : s.id === secao?.id;
              const pend = pendencias(s);
              const classe =
                "relative w-full flex items-center justify-center rounded-lg py-2.5 transition-colors " +
                (eAtiva ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white");
              const conteudo = (
                <>
                  <Icon className="w-[22px] h-[22px]" />
                  {pend > 0 && <span className="absolute top-1 right-1.5 bg-accent text-primaryDark text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1">{pend}</span>}
                </>
              );
              return s.href ? (
                <Link key={s.id} href={s.href} onClick={onClose} className={classe} title={s.label} aria-label={s.label}>
                  {conteudo}
                </Link>
              ) : (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setAtiva(s.id);
                    mudarPainel(true);
                  }}
                  className={classe}
                  title={s.label}
                  aria-label={s.label}
                  aria-pressed={eAtiva}
                >
                  {conteudo}
                </button>
              );
            })}
          </nav>
          {(
            <button type="button" onClick={() => trocarMenu(true)} className="hidden lg:block text-[10px] leading-tight text-white/60 hover:text-white px-1 text-center" title="Mostrar o menu com os nomes">
              Menu novo
            </button>
          )}
          <button type="button" onClick={onClose} className="lg:hidden text-white/70 hover:text-white p-1" aria-label="Fechar menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* painel do setor */}
        {painelAberto && secao && (
          <div className="w-[236px] bg-white border-r border-border flex flex-col">
            <div className="flex items-center justify-between gap-2 px-4 h-16 shrink-0 border-b border-border">
              <h2 className="text-base font-semibold text-primaryDark truncate">{secao.label}</h2>
              <button type="button" onClick={() => mudarPainel(false)} className="hidden lg:block text-ink-400 hover:text-primary p-1" aria-label="Recolher o painel" title="Recolher o painel">
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-2">
              {secao.grupos.map((g) => {
                const chave = secao.id + "/" + g.nome;
                const aberto = !fechados[chave];
                return (
                  <div key={chave} className="mb-1">
                    <button
                      type="button"
                      onClick={() => setFechados((p) => ({ ...p, [chave]: !p[chave] }))}
                      className="w-full flex items-center gap-1.5 px-2 py-2 text-sm font-semibold text-ink-900 hover:text-primary"
                      aria-expanded={aberto}
                    >
                      {aberto ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                      <span className="truncate">{g.nome}</span>
                    </button>
                    {aberto && (
                      <div className="ml-[13px] border-l border-border">
                        {g.itens.map((item) => {
                          const eAtivo = itemAtual?.href === item.href && itemAtual?.label === item.label;
                          // página fora do Next (módulo Pós-obra): link comum, carrega a página inteira
                          const Destino: any = item.externo ? "a" : Link;
                          return (
                            <Destino
                              key={item.label + item.href}
                              href={item.href}
                              onClick={onClose}
                              title={item.description}
                              className={"flex items-center gap-2 pl-3 pr-2 py-1.5 text-sm rounded-r-md transition-colors " + (eAtivo ? "bg-primary/10 text-primaryDark font-semibold" : "text-ink-700 hover:bg-surface-subtle hover:text-primary")}
                            >
                              <span className="truncate">{item.label}</span>
                              {item.badgeKey && (contadores[item.badgeKey] ?? 0) > 0 && (
                                <span className="ml-auto bg-accent text-primaryDark text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{contadores[item.badgeKey]}</span>
                              )}
                            </Destino>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            {setor && <p className="px-4 py-2 text-[11px] text-ink-400 border-t border-border truncate">Engenharia SBJ · {SETOR_LABEL[setor] ?? setor}</p>}
          </div>
        )}
        {!painelAberto && (
          <button type="button" onClick={() => mudarPainel(true)} className="hidden lg:flex absolute top-[72px] -right-3 z-10 w-6 h-6 rounded-full bg-white border border-border shadow items-center justify-center text-ink-500 hover:text-primary" aria-label="Abrir o painel" title="Abrir o painel">
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        )}
      </aside>
    </>
  );
}

/* Menu novo do Pós-obra: cada área tem nome e ícone, abre e fecha com animação, e o que está dentro aparece por extenso. */
function MenuNovo({
  pathname,
  secoes,
  itemAtual,
  contadores,
  mobileOpen,
  onClose,
  onVoltar,
}: {
  pathname: string;
  secoes: ReturnType<typeof menuPorSetor>;
  itemAtual: ReturnType<typeof itemDaRota>;
  contadores: Record<string, number>;
  mobileOpen: boolean;
  onClose: () => void;
  onVoltar: () => void;
}) {
  const [aberta, setAberta] = useState<SecaoId | null>(itemAtual?.secao ?? null);
  useEffect(() => {
    if (itemAtual) setAberta(itemAtual.secao);
  }, [itemAtual?.secao]); // eslint-disable-line react-hooks/exhaustive-deps
  const pendencias = (s: (typeof secoes)[number]) => s.grupos.flatMap((g) => g.itens).reduce((a, i) => a + (i.badgeKey ? contadores[i.badgeKey] ?? 0 : 0), 0);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={
          "print:hidden fixed inset-y-0 left-0 z-40 w-[260px] flex flex-col bg-[#0e2a30] text-white shadow-xl transition-transform duration-300 ease-out " +
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center justify-between gap-2 px-4 h-16 shrink-0 border-b border-white/10">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2 min-w-0">
            <img src="/logo-topbar.png" alt="SBJ" className="h-8 w-auto" />
            <span className="text-sm font-semibold truncate">Engenharia SBJ</span>
          </Link>
          <button type="button" onClick={onClose} className="lg:hidden text-white/70 hover:text-white p-1" aria-label="Fechar menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1" aria-label="Menu">
          {secoes.map((s) => {
            const Icon = s.icon;
            const ativo = s.href ? pathname === s.href : aberta === s.id;
            const pend = pendencias(s);
            const cabeca =
              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200 " + (ativo ? "bg-white/15" : "hover:bg-white/10");
            const conteudo = (
              <>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-[15px] font-medium truncate">{s.label}</span>
                {pend > 0 && <span className="bg-accent text-primaryDark text-[11px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1">{pend}</span>}
                {!s.href && <ChevronDown className={"w-4 h-4 shrink-0 transition-transform duration-300 " + (ativo ? "rotate-180" : "")} />}
              </>
            );
            if (s.href) {
              return (
                <Link key={s.id} href={s.href} onClick={onClose} className={cabeca}>
                  {conteudo}
                </Link>
              );
            }
            return (
              <div key={s.id}>
                <button type="button" onClick={() => setAberta(ativo ? null : s.id)} className={cabeca} aria-expanded={ativo}>
                  {conteudo}
                </button>
                <div className={"grid transition-[grid-template-rows,opacity] duration-300 ease-out " + (ativo ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                  <div className="overflow-hidden">
                    <div className="ml-6 mt-1 mb-2 border-l border-white/15 pl-3 space-y-0.5">
                      {s.grupos.map((g) => (
                        <div key={g.nome}>
                          <p className="text-[11px] uppercase tracking-wide text-white/50 mt-2 mb-1">{g.nome}</p>
                          {g.itens.map((item) => {
                            const eAtivo = itemAtual?.href === item.href && itemAtual?.label === item.label;
                            const Destino: any = item.externo ? "a" : Link;
                            return (
                              <Destino
                                key={item.label + item.href}
                                href={item.href}
                                onClick={onClose}
                                className={"flex items-center justify-between rounded-md px-2.5 py-2 text-[14px] transition-colors " + (eAtivo ? "bg-white/20 font-semibold" : "text-white/80 hover:bg-white/10 hover:text-white")}
                              >
                                <span className="truncate">{item.label}</span>
                              </Destino>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <button type="button" onClick={onVoltar} className="w-full text-left text-xs text-white/60 hover:text-white">
            ↺ Voltar ao menu anterior
          </button>
        </div>
      </aside>
    </>
  );
}
