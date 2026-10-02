import { useEffect, useRef, useState } from 'react'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import Button from '../../../shared/ui/Button.jsx'
import { platformApi } from '../infrastructure/platformApi.js'
import { companyStatus } from './companyStatus.js'

export default function CompanyList({ api = platformApi, onNavigate, canCreate = false }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [cursors, setCursors] = useState([null]), [revision, setRevision] = useState(0)
  const [state, setState] = useState({ owner: null, loading: true, items: [] })
  const generation = useRef(0)
  const cursor = cursors.at(-1)
  useEffect(() => {
    const requestId = ++generation.current, controller = new AbortController()
    setState({ owner: api, loading: true, items: [], error: '' })
    void api.listBusinesses({ query, cursor }, { signal: controller.signal }).then(value => {
      if (generation.current === requestId) setState({ owner: api, loading: false, items: value?.items || [], nextCursor: value?.nextCursor, error: '' })
    }).catch(error => { if (generation.current === requestId) setState({ owner: api, loading: false, items: [], error: error?.message || 'Não foi possível carregar as empresas.' }) })
    return () => { generation.current++; controller.abort() }
  }, [api, query, cursor, revision])
  const visible = state.owner === api ? state : { loading: true, items: [] }
  return <section><PageHeader eyebrow="Administração Mesiva" title="Empresas" description="Cadastros e convites dos primeiros gerentes." actions={canCreate && <Button onClick={() => onNavigate?.('/mesiva/empresas/nova')} icon="plus">Nova empresa</Button>} />
    <form className="platform-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setCursors([null]); setRevision(value => value + 1) }}><label>Buscar empresa<input name="query" type="search" maxLength={200} placeholder="Nome da empresa" value={search} onChange={event => setSearch(event.target.value)} /></label><Button type="submit" variant="secondary">Buscar</Button></form>
    {visible.loading && <p role="status">Carregando empresas…</p>}{visible.error && <div className="platform-feedback" role="alert"><p>{visible.error}</p><Button onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button></div>}
    {!visible.loading && !visible.error && visible.items.length === 0 && <div className="platform-empty"><h2>Nenhuma empresa encontrada</h2><p>{query ? 'Tente outro nome.' : 'Cadastre uma empresa para enviar o primeiro convite.'}</p></div>}
    <div className="platform-company-list">{visible.items.map(company => { const status = companyStatus(company); return <article key={company.id} className="platform-company-row"><div className="platform-company-name"><h2>{company.name}</h2><small>{company.firstManager?.name || 'Primeiro gerente ainda não preparado'}{company.firstManager?.email && <span>{company.firstManager.email}</span>}</small></div><div className="platform-company-state"><span className={`platform-badge ${status.activated ? 'is-active' : ''}`}>{status.access}</span><small>{status.invitation}</small></div><Button variant="secondary" aria-label={`Ver detalhes de ${company.name}`} onClick={() => onNavigate?.(`/mesiva/empresas/${encodeURIComponent(company.id)}`)}>Detalhes</Button></article> })}</div>
    <nav className="platform-pagination" aria-label="Paginação das empresas"><Button variant="secondary" disabled={visible.loading || cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Página anterior</Button><span>Página {cursors.length}</span><Button variant="secondary" disabled={visible.loading || !visible.nextCursor} onClick={() => setCursors(values => [...values, visible.nextCursor])}>Próxima página</Button></nav>
  </section>
}
