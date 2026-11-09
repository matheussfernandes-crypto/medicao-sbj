/* ---------- Assinatura na tela (dedo ou Apple Pencil) ----------
   Desenha num quadro, guarda como imagem PNG de fundo transparente (leve) e devolve para o PDF. */

function vtAssinatura(canvas, valor, aoMudar) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let tocou = !!valor, desenhando = false, anterior = null;

  function preparar() {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#0a1f3d"; c.fillStyle = "#0a1f3d";
    if (valor) { const img = new Image(); img.onload = () => c.drawImage(img, 0, 0, r.width, r.height); img.src = valor; }
  }
  preparar();

  const ponto = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pointerType === "pen" && e.pressure ? e.pressure : 0.5 }; };
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    desenhando = true; anterior = ponto(e);
    const c = canvas.getContext("2d"); c.beginPath(); c.arc(anterior.x, anterior.y, 1.3, 0, Math.PI * 2); c.fill(); tocou = true;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!desenhando) return; e.preventDefault();
    const c = canvas.getContext("2d");
    const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    (eventos.length ? eventos : [e]).forEach(ev => {
      const p = ponto(ev), meio = { x: (anterior.x + p.x) / 2, y: (anterior.y + p.y) / 2 };
      c.lineWidth = 1.6 + p.p * 2.4;
      c.beginPath(); c.moveTo(anterior.x, anterior.y); c.quadraticCurveTo(anterior.x, anterior.y, meio.x, meio.y); c.stroke();
      anterior = p;
    });
  });
  const fim = (e) => { if (!desenhando) return; desenhando = false; try { canvas.releasePointerCapture(e.pointerId); } catch (x) { /* ignora */ } aoMudar(exportar()); };
  canvas.addEventListener("pointerup", fim); canvas.addEventListener("pointercancel", fim);

  /* devolve PNG leve (no máximo 700px de largura) ou "" se estiver em branco */
  function exportar() {
    if (!tocou) return "";
    const k = Math.min(1, 700 / canvas.width), t = document.createElement("canvas");
    t.width = Math.round(canvas.width * k); t.height = Math.round(canvas.height * k);
    t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL("image/png");
  }
  return {
    limpar() { const c = canvas.getContext("2d"); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); c.restore(); tocou = false; valor = ""; aoMudar(""); },
  };
}
