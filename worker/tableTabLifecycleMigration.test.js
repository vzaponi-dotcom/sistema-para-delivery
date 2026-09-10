import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

const migrationUrl = new URL('../migrations/0021_table_tab_lifecycle_guards.sql', import.meta.url)

const createSchema = (database, staging = false) => {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE businesses (id TEXT PRIMARY KEY);
    CREATE TABLE table_tabs (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_id TEXT,
      table_identifier TEXT NOT NULL, tab_number INTEGER, status TEXT NOT NULL,
      opened_at TEXT NOT NULL, closed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_tab_id TEXT,
      status TEXT NOT NULL
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL,
      order_id TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL, paid_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    INSERT INTO businesses VALUES ('biz');
    INSERT INTO table_tabs VALUES ('tab-open', 'biz', 'table-1', 'Mesa 1', 1, 'open', 'now', NULL, 'now', 'now');
    INSERT INTO orders VALUES ('order-unpaid', 'biz', 'tab-open', 'Em preparo');
  `)
  if (staging) database.exec(`
    CREATE TABLE print_stations (id TEXT PRIMARY KEY, business_id TEXT NOT NULL);
    CREATE TABLE print_jobs (id TEXT PRIMARY KEY, business_id TEXT NOT NULL);
    ALTER TABLE table_tabs ADD COLUMN tab_source TEXT;
  `)
}

test('0021 is independent from printing migrations and applies to production-like and staging-like schemas', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.doesNotMatch(sql, /print_jobs|print_stations|business_print_settings/i)

  for (const staging of [false, true]) {
    const database = new DatabaseSync(':memory:')
    try {
      createSchema(database, staging)
      database.exec(sql)
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'table_tab_%_guard'").get().count, 3)
    } finally {
      database.close()
    }
  }
})

test('0021 prevents orders on closed tabs and prevents closing a tab with an unpaid order', () => {
  const database = new DatabaseSync(':memory:')
  try {
    createSchema(database)
    database.exec(fs.readFileSync(migrationUrl, 'utf8'))

    assert.throws(
      () => database.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-open'").run(),
      /TABLE_TAB_HAS_UNPAID_ORDERS/,
    )
    database.prepare("INSERT INTO payments VALUES ('pay-1', 'biz', 'order-unpaid', 1000, 'Pix', 'now', 'now')").run()
    database.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-open'").run()
    assert.throws(
      () => database.prepare("INSERT INTO orders VALUES ('late-order', 'biz', 'tab-open', 'Em preparo')").run(),
      /TABLE_TAB_NOT_OPEN/,
    )
  } finally {
    database.close()
  }
})

test('0021 only permits a table payment while its order is payable and its tab is open', () => {
  const database = new DatabaseSync(':memory:')
  try {
    createSchema(database)
    database.exec(fs.readFileSync(migrationUrl, 'utf8'))

    database.prepare("UPDATE orders SET status = 'Cancelado' WHERE id = 'order-unpaid'").run()
    assert.throws(
      () => database.prepare("INSERT INTO payments VALUES ('pay-cancelled', 'biz', 'order-unpaid', 1000, 'Pix', 'now', 'now')").run(),
      /TABLE_TAB_PAYMENT_INVALID/,
    )

    database.prepare("UPDATE orders SET status = 'Em preparo' WHERE id = 'order-unpaid'").run()
    database.prepare("UPDATE orders SET status = 'Cancelado' WHERE id = 'order-unpaid'").run()
    database.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-open'").run()
    database.prepare("UPDATE orders SET status = 'Em preparo' WHERE id = 'order-unpaid'").run()
    assert.throws(
      () => database.prepare("INSERT INTO payments VALUES ('pay-closed', 'biz', 'order-unpaid', 1000, 'Pix', 'now', 'now')").run(),
      /TABLE_TAB_PAYMENT_INVALID/,
    )

    database.prepare("INSERT INTO orders VALUES ('delivery-order', 'biz', NULL, 'Em preparo')").run()
    database.prepare("INSERT INTO payments VALUES ('pay-delivery', 'biz', 'delivery-order', 1000, 'Pix', 'now', 'now')").run()
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = 'delivery-order'").get().count, 1)
  } finally {
    database.close()
  }
})
