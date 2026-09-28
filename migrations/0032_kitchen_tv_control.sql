-- Kitchen TV remote control state and TV-only order visibility.
-- Authentication/pairing remains owned by kitchen_tv_access.

CREATE UNIQUE INDEX IF NOT EXISTS orders_business_id_id_unique
  ON orders (business_id, id);

CREATE TABLE kitchen_tv_display_control (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  requested_page INTEGER NOT NULL DEFAULT 1 CHECK (requested_page >= 1),
  updated_at TEXT NOT NULL,
  reported_revision INTEGER CHECK (reported_revision IS NULL OR reported_revision >= 0),
  reported_page INTEGER CHECK (reported_page IS NULL OR reported_page >= 1),
  reported_page_count INTEGER CHECK (reported_page_count IS NULL OR reported_page_count >= 1),
  reported_viewport_width INTEGER CHECK (reported_viewport_width IS NULL OR reported_viewport_width > 0),
  reported_viewport_height INTEGER CHECK (reported_viewport_height IS NULL OR reported_viewport_height > 0),
  reported_visible_order_ids_json TEXT,
  reported_at TEXT
);

CREATE TABLE kitchen_tv_hidden_orders (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  hidden_at TEXT NOT NULL,
  PRIMARY KEY (business_id, order_id),
  FOREIGN KEY (business_id, order_id)
    REFERENCES orders(business_id, id)
    ON DELETE CASCADE
);

CREATE INDEX kitchen_tv_hidden_orders_business_idx
  ON kitchen_tv_hidden_orders (business_id, hidden_at);

CREATE TRIGGER kitchen_tv_hidden_orders_terminal_cleanup
AFTER UPDATE OF status, finished_at, cancelled_at ON orders
WHEN NEW.finished_at IS NOT NULL
  OR NEW.cancelled_at IS NOT NULL
  OR NEW.status IN ('Finalizado', 'Cancelado', 'Entregue', 'Despachado')
BEGIN
  DELETE FROM kitchen_tv_hidden_orders
  WHERE business_id = NEW.business_id
    AND order_id = NEW.id;
END;
