// Modo claro/escuro do site inteiro. A escolha fica salva neste navegador e é avisada por um evento
// ("sbj-tema") aos módulos embutidos (Pós-obra e Pós-venda), que acompanham a mesma cor.

export const TEMA_CHAVE = "sbj-tema";
export const EVENTO_TEMA = "sbj-tema";

export function temaEscuroAtivo(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function aplicarTema(escuro: boolean) {
  document.documentElement.classList.toggle("dark", escuro);
  try {
    localStorage.setItem(TEMA_CHAVE, escuro ? "escuro" : "claro");
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: { escuro } }));
}

// roda antes da primeira pintura, para não piscar o claro ao abrir
export const SCRIPT_TEMA_INICIAL = `try{if(localStorage.getItem("sbj-tema")==="escuro")document.documentElement.classList.add("dark")}catch(e){}`;
