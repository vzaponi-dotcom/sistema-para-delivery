-- Persist the order-modality filter remotely so the admin controller and TV stay synchronized.
ALTER TABLE kitchen_tv_display_control
  ADD COLUMN requested_modality TEXT NOT NULL DEFAULT 'all'
  CHECK (requested_modality IN ('all', 'delivery', 'pickup', 'table'));
