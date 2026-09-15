import { afterEach } from 'node:test'
import { createSettingsDb } from './settingsDb.js'

const databases = new Set()
const timestamp = '2026-09-01T00:00:00.000Z'
afterEach(() => {
  for (const database of databases) database.close()
  databases.clear()
})

// Current operational tests use the complete real migration sequence. Historical
// migration tests keep their own explicit intermediate-schema setup.
export class OperationalDb {
  constructor({ businesses = [] } = {}) {
    const database = createSettingsDb({ beforeSpecB(sqlite) {
      // Each scenario supplies its own tables, independent of the initial sample.
      sqlite.exec('DELETE FROM tables')
      for (const id of businesses) sqlite.prepare(`INSERT INTO businesses
        (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .run(id, id, id, timestamp, timestamp)
    } })
    databases.add(database)
    this.sqlite = database.sqlite
    this.prepare = database.db.prepare
    this.executeBatch = database.db.batch
    this.batchCalls = []
    this.failNextBatch = false
  }

  async batch(statements) {
    this.batchCalls.push(statements)
    if (this.failNextBatch) {
      this.failNextBatch = false
      throw new Error('forced batch failure')
    }
    return this.executeBatch(statements)
  }

  exec(sql) { this.sqlite.exec(sql) }
  all(sql) { return this.sqlite.prepare(sql).all() }
}
