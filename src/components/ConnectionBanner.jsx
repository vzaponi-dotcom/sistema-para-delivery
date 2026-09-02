function ConnectionBanner() {
  return (
    <div className="connection-banner" role="status">
      Sem conexão. Consultas já carregadas continuam visíveis, mas novos registros e alterações ficam bloqueados até a internet voltar.
    </div>
  )
}

export default ConnectionBanner
