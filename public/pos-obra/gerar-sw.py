"""Gera o sw.js (service worker) com a lista atual de arquivos do site.
Rode de novo sempre que o site mudar:   python gerar-sw.py
O número de versão muda sozinho quando qualquer arquivo muda, e os aparelhos pegam a versão nova."""
import hashlib
import json
import os

RAIZ = os.path.dirname(os.path.abspath(__file__))
PASTAS = ["css", "js", "assets", "data"]
RAIZ_ARQ = ["index.html", "manifest.webmanifest"]

arquivos = list(RAIZ_ARQ)
for pasta in PASTAS:
    for atual, _, nomes in os.walk(os.path.join(RAIZ, pasta)):
        for n in nomes:
            rel = os.path.relpath(os.path.join(atual, n), RAIZ).replace("\\", "/")
            arquivos.append(rel)
arquivos = sorted(set(arquivos))

h = hashlib.sha1()
for rel in arquivos:
    with open(os.path.join(RAIZ, rel), "rb") as f:
        h.update(rel.encode() + f.read())
versao = h.hexdigest()[:10]

modelo = open(os.path.join(RAIZ, "sw.modelo.js"), encoding="utf-8").read()
saida = modelo.replace("__VERSAO__", versao).replace("__ARQUIVOS__", json.dumps(["./"] + arquivos, ensure_ascii=False, indent=2))
open(os.path.join(RAIZ, "sw.js"), "w", encoding="utf-8", newline="\n").write(saida)
print(f"sw.js gerado: versão {versao}, {len(arquivos)} arquivos")
