"use client";

import { useLayoutEffect, useState } from "react";

// Títulos dos serviços sempre na vertical (lidos de baixo para cima), quebrando só ENTRE palavras (nunca no meio da palavra, nunca com hífen).
// Um título comprido ocupa 2 ou 3 linhas verticais lado a lado; a altura do cabeçalho tem um teto. Se uma palavra sozinha passa do teto,
// a fonte do cabeçalho daquela tabela diminui um pouco (até 8 px).

export const ALT_TITULO_MAX = 130;
export const LARG_LINHA = 11; // largura de cada linha vertical

export type TitulosV = { fs: number; linhas: string[][]; alt: number; nl: number };

export function calcularTitulosV(nomes: string[], medir: (t: string, fs: number) => number, altMax = ALT_TITULO_MAX): TitulosV {
  const disp = altMax - 8;
  let r: TitulosV | null = null;
  for (const fs of [11, 10, 9, 8.5, 8]) {
    const linhas = nomes.map((n) => {
      const out: string[] = [];
      let cur = "";
      n.split(/\s+/).forEach((w) => {
        const t = cur ? cur + " " + w : w;
        if (!cur || medir(t, fs) <= disp) cur = t;
        else {
          out.push(cur);
          cur = w;
        }
      });
      if (cur) out.push(cur);
      return out;
    });
    const maior = Math.max(0, ...linhas.flatMap((ls) => ls.map((l) => medir(l, fs))));
    r = { fs, linhas, alt: Math.ceil(maior) + 10, nl: Math.max(1, ...linhas.map((l) => l.length)) };
    if (maior <= disp) break;
  }
  return r!;
}

// mede com o canvas, na fonte do próprio site
function medidor() {
  const c = document.createElement("canvas").getContext("2d")!;
  const familia = getComputedStyle(document.body).fontFamily || "sans-serif";
  const cache = new Map<string, number>();
  return (t: string, fs: number) => {
    const k = fs + "|" + t;
    let w = cache.get(k);
    if (w == null) {
      c.font = `600 ${fs}px ${familia}`;
      w = c.measureText(t).width;
      cache.set(k, w);
    }
    return w;
  };
}

// no servidor e antes de medir: uma linha só (como era), até a medição chegar
export function useTitulosV(nomes: string[]): TitulosV {
  const chave = nomes.join("\u0001");
  const [t, setT] = useState<TitulosV>(() => ({ fs: 11, linhas: nomes.map((n) => [n]), alt: 132, nl: 1 }));
  useLayoutEffect(() => {
    const medir = medidor();
    setT(calcularTitulosV(nomes, medir));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return t;
}
