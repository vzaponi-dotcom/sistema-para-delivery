export const actorLabel = actor => {
  if (actor?.type === 'user') return actor.displayName || 'Autor não identificado'
  if (actor?.type === 'system') return 'Sistema'
  if (actor?.type === 'legacy') return 'Acesso legado'
  return 'Autor não identificado'
}
