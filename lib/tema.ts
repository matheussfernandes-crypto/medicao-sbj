// Modo claro/escuro do site inteiro. A escolha fica salva neste navegador e é avisada por um evento
// ("sbj-tema") aos módulos embutidos (Pós-obra e Pós-venda), que acompanham a mesma cor.

export const TEMA_CHAVE = "sbj-tema";
export const EVENTO_TEMA = "sbj-tema";

export function temaEscuroAtivo(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

// troca animada: durante meio segundo as cores deslizam, no site e nos módulos embutidos
const REGRA_TRANSICAO = "html.tema-trocando, html.tema-trocando * { transition: background-color .45s ease, color .45s ease, border-color .45s ease, fill .45s ease, box-shadow .45s ease !important; }";
function documentos(): Document[] {
  const lista: Document[] = [document];
  document.querySelectorAll("iframe").forEach((f) => {
    try {
      const d = f.contentDocument;
      if (d && d.documentElement && d.head) lista.push(d);
    } catch {}
  });
  return lista;
}

export function aplicarTema(escuro: boolean) {
  documentos().forEach((d) => {
    if (!d.getElementById("sbj-tema-transicao")) {
      const s = d.createElement("style");
      s.id = "sbj-tema-transicao";
      s.textContent = REGRA_TRANSICAO;
      d.head.appendChild(s);
    }
    d.documentElement.classList.add("tema-trocando");
  });
  setTimeout(() => documentos().forEach((d) => d.documentElement.classList.remove("tema-trocando")), 650);
  document.documentElement.classList.toggle("dark", escuro);
  try {
    localStorage.setItem(TEMA_CHAVE, escuro ? "escuro" : "claro");
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: { escuro } }));
}

// roda antes da primeira pintura, para não piscar o claro ao abrir
export const SCRIPT_TEMA_INICIAL = `try{if(localStorage.getItem("sbj-tema")==="escuro")document.documentElement.classList.add("dark")}catch(e){}`;
