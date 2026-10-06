import { useEffect, useRef, useState } from 'react'
import PageHeader from '../../../shared/ui/PageHeader.jsx'
import Button from '../../../shared/ui/Button.jsx'
import { platformApi } from '../infrastructure/platformApi.js'
import { companyStatus, formatDate } from './companyStatus.js'
import SystemSelect from '../../../shared/ui/SystemSelect.jsx'
const statusOptions=[{value:'visible',label:'Todas, exceto excluídas'},{value:'active',label:'Ativas'},{value:'pending',label:'Aguardando ativação'},{value:'suspended',label:'Suspensas'},{value:'deleted',label:'Excluídas'},{value:'all',label:'Todas, incluindo excluídas'}]

export default function CompanyList({ api = platformApi, onNavigate, canCreate = false }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [cursors, setCursors] = useState([null]), [revision, setRevision] = useState(0)
  const [state, setState] = useState({ owner: null, loading: true, items: [] })
  const generation = useRef(0)
  const [status,setStatus]=useState('visible')
  const cursor = cursors.at(-1)
  useEffect(() => {
    const requestId = ++generation.current, controller = new AbortController()
    setState({ owner: api, loading: true, items: [], error: '' })
    void api.listBusinesses({ query, cursor, limit: 20, ...(status!=='visible'?{status}:{}) }, { signal: controller.signal }).then(value => {
      if (generation.current === requestId) setState({ owner: api, loading: false, items: value?.items || [], nextCursor: value?.nextCursor, error: '' })
    }).catch(error => { if (generation.current === requestId) setState({ owner: api, loading: false, items: [], error: error?.message || 'Não foi possível carregar as empresas.' }) })
    return () => { generation.current++; controller.abort() }
  }, [api, query, cursor, status, revision])
  const visible = state.owner === api ? state : { loading: true, items: [] }
  return <section className="platform-company-directory"><div className="platform-title-row"><PageHeader eyebrow="Administração Mesiva" title="Empresas" description="Gerencie cadastros, acessos e convites." />{canCreate&&<Button type="button" onClick={()=>onNavigate?.('/mesiva/empresas/nova')} icon="plus">Nova empresa</Button>}</div>
    <form className="platform-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setCursors([null]); setRevision(value => value + 1) }}><label>Buscar empresa ou e-mail<input name="query" type="search" maxLength={200} placeholder="Nome da empresa ou e-mail" value={search} onChange={event => setSearch(event.target.value)} /></label><Button type="submit" variant="secondary">Buscar</Button><div className="platform-search-status"><SystemSelect label="Situação" value={status} options={statusOptions} onChange={value=>{setStatus(value);setCursors([null])}} /></div></form>
    {visible.loading && <p role="status">Carregando empresas…</p>}{visible.error && <div className="platform-feedback" role="alert"><p>{visible.error}</p><Button onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button></div>}
    {!visible.loading && !visible.error && visible.items.length === 0 && <div className="platform-empty"><h2>Nenhuma empresa encontrada</h2><p>{query ? 'Tente outro nome.' : 'Cadastre uma empresa para enviar o primeiro convite.'}</p></div>}
    {visible.items.length > 0 && <div className="platform-company-list"><div className="platform-company-columns" aria-hidden="true"><span>Empresa</span><span>Gerente do cadastro</span><span>Situação</span><span>Ações</span></div>{visible.items.map(company => { const status = companyStatus(company); return <article key={company.id} className="platform-company-row"><div className="platform-company-name"><h2>{company.name}</h2>{company.createdAt&&<small className="platform-muted">Cadastro em {formatDate(company.createdAt)}</small>}</div><div className="platform-company-manager"><span className="platform-mobile-label">{company.firstManager?.source === 'membership' ? 'Gerente vinculado' : 'Primeiro gerente'}</span><strong>{company.firstManager?.name || 'Gerente não informado'}</strong>{company.firstManager?.email && <small>{company.firstManager.email}</small>}{company.firstManager?.source === 'membership' && <small>Vínculo existente</small>}</div><div className="platform-company-state"><span className="platform-mobile-label">Acesso</span><span className={`platform-badge ${status.activated ? 'is-active' : ''}`}>{status.access}</span><small className="platform-company-invitation">{status.invitation}</small></div><Button variant="secondary" aria-label={`Gerenciar ${company.name}`} onClick={() => onNavigate?.(`/mesiva/empresas/${encodeURIComponent(company.id)}`)}>Gerenciar</Button></article> })}</div>}
    {!visible.loading && !visible.error && visible.items.length > 0 && <nav className="platform-pagination" aria-label="Paginação das empresas"><span>{visible.items.length} {visible.items.length === 1 ? 'empresa nesta página' : 'empresas nesta página'}</span><div><span>Página {cursors.length}</span>{(cursors.length > 1 || visible.nextCursor) && <><Button variant="secondary" disabled={cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Página anterior</Button><Button variant="secondary" disabled={!visible.nextCursor} onClick={() => setCursors(values => [...values, visible.nextCursor])}>Próxima página</Button></>}</div></nav>}
  </section>
}
