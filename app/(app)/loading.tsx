// Mostra um esqueleto na hora do clique enquanto a página carrega no servidor,
// em vez de a tela ficar "parada" até a resposta chegar.
export default function Carregando() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="h-6 w-56 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="h-20 bg-white border border-border rounded-xl" />
        <div className="h-20 bg-white border border-border rounded-xl" />
        <div className="h-20 bg-white border border-border rounded-xl" />
      </div>
      <div className="h-64 bg-white border border-border rounded-xl" />
    </div>
  );
}
