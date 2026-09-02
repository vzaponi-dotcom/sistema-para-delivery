PRAGMA foreign_keys = ON;

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE auth_credentials (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX sessions_business_expires_idx ON sessions (business_id, expires_at);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX clients_business_name_idx ON clients (business_id, name);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX products_business_active_name_idx ON products (business_id, active, name);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_name_snapshot TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Entrega', 'Retirada', 'Local')),
  order_date TEXT NOT NULL,
  status TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  adjustment_type TEXT NOT NULL DEFAULT 'none' CHECK (adjustment_type IN ('none', 'discount', 'surcharge')),
  adjustment_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (adjustment_mode IN ('fixed', 'percentage')),
  adjustment_value INTEGER NOT NULL DEFAULT 0 CHECK (adjustment_value >= 0),
  adjustment_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (adjustment_amount_cents >= 0),
  adjustment_reason TEXT NOT NULL DEFAULT '',
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX orders_business_created_idx ON orders (business_id, created_at DESC);
CREATE INDEX orders_business_date_idx ON orders (business_id, order_date DESC);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  category_snapshot TEXT NOT NULL DEFAULT '',
  size_snapshot TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  catalog_price_cents INTEGER NOT NULL CHECK (catalog_price_cents >= 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  price_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_business_idx ON order_items (business_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  method TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX payments_business_paid_idx ON payments (business_id, paid_at DESC);

CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  value_cents INTEGER NOT NULL CHECK (value_cents > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  movement_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX movements_business_created_idx ON movements (business_id, created_at DESC);

INSERT INTO businesses (id, slug, name, created_at, updated_at)
VALUES ('amor-e-sabor', 'amor-e-sabor', 'Amor & Sabor', datetime('now'), datetime('now'));
