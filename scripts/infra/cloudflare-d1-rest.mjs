import { makeProxyConfig } from './issue-44-access-admin.mjs'

const ACCOUNT_ID = /^[a-f0-9]{32}$/i
const DATABASE_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const statementMarker = Symbol('mesiva.d1-rest.statement')

const sanitizedError = () => new Error('D1 REST request failed.')

function normalizeParam(value) {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value
  throw sanitizedError()
}

function validConfig({ accountId, databaseId, apiToken, fetchImpl, timeoutMs }) {
  if (!ACCOUNT_ID.test(accountId || '') || !DATABASE_ID.test(databaseId || '') || typeof apiToken !== 'string' || !apiToken) throw sanitizedError()
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) throw sanitizedError()
}

export function createD1RestDatabase({
  accountId,
  databaseId,
  apiToken,
  fetchImpl = fetch,
  timeoutMs = 30000,
} = {}) {
  validConfig({ accountId, databaseId, apiToken, fetchImpl, timeoutMs })
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`

  async function query(payload) {
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw sanitizedError()
    }

    let body
    try {
      body = await response.json()
    } catch {
      throw sanitizedError()
    }

    if (!response.ok || body?.success !== true || !Array.isArray(body.result) || body.result.some(item => item?.success !== true)) {
      throw sanitizedError()
    }
    return body.result
  }

  class RestStatement {
    constructor(sql, params = []) {
      if (typeof sql !== 'string' || !sql.trim()) throw sanitizedError()
      this.sql = sql
      this.params = params.map(normalizeParam)
      this[statementMarker] = true
    }

    bind(...params) {
      return new RestStatement(this.sql, params)
    }

    async run() {
      const [result] = await query({ sql: this.sql, params: this.params })
      return result
    }

    async all() {
      const [result] = await query({ sql: this.sql, params: this.params })
      return result
    }

    async first(column) {
      const result = await this.all()
      const row = Array.isArray(result.results) ? result.results[0] : undefined
      if (row === undefined) return null
      if (column === undefined) return row
      if (typeof column !== 'string' || !Object.hasOwn(row, column)) return null
      return row[column]
    }
  }

  return {
    prepare(sql) {
      return new RestStatement(sql)
    },

    async batch(statements) {
      if (!Array.isArray(statements)) throw sanitizedError()
      if (statements.length === 0) return []
      if (statements.some(statement => statement?.[statementMarker] !== true)) throw sanitizedError()
      return query({
        batch: statements.map(statement => ({ sql: statement.sql, params: statement.params })),
      })
    },
  }
}

export async function connectProductionD1Rest(environment, { env = process.env, fetchImpl = fetch } = {}) {
  if (environment !== 'production') throw sanitizedError()
  const proxy = makeProxyConfig(environment, env)
  const binding = proxy.d1_databases?.find(item => item.binding === 'DB')
  if (!binding?.database_id || !proxy.account_id) throw sanitizedError()

  return {
    db: createD1RestDatabase({
      accountId: proxy.account_id,
      databaseId: binding.database_id,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      fetchImpl,
    }),
    dispose: async () => {},
  }
}
