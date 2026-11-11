// Pós-venda: o sistema do kit (public/posvenda) abre aqui dentro, no espaço de conteúdo do site.
// O menu e o topo continuam os do site; os dados passam pelas rotas /api/posvenda com o mesmo login.
export default function PosVenda() {
  return (
    <iframe
      src="/posvenda/index.html"
      title="Pós-venda"
      className="block w-full border-0 bg-white"
      style={{ height: "calc(100dvh - 4rem)" }}
      allow="microphone"
    />
  );
}
