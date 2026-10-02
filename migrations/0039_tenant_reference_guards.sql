-- Reject existing crossed references before installing additive guards. No historical data is rewritten.
PRAGMA foreign_keys = ON;
CREATE TABLE tenant_migration_assertion(ok INTEGER NOT NULL CHECK(ok = 1));
INSERT INTO tenant_migration_assertion(ok) SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM orders source WHERE (source.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients p WHERE p.id = source.client_id AND p.business_id = source.business_id)) OR
  (source.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = source.table_tab_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM order_items source WHERE (source.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = source.order_id AND p.business_id = source.business_id)) OR
  (source.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = source.product_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM payments source WHERE (source.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = source.order_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM payment_receipts source WHERE (source.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = source.table_tab_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM movements source WHERE (source.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = source.order_id AND p.business_id = source.business_id)) OR
  (source.payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = source.payment_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM table_tabs source WHERE (source.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tables p WHERE p.id = source.table_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM table_reservations source WHERE (source.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = source.order_id AND p.business_id = source.business_id)) OR
  (source.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tables p WHERE p.id = source.table_id AND p.business_id = source.business_id)) OR
  (source.converted_table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = source.converted_table_tab_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM print_jobs source WHERE (source.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = source.order_id AND p.business_id = source.business_id)) OR
  (source.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = source.table_tab_id AND p.business_id = source.business_id)) OR
  (source.parent_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = source.parent_job_id AND p.business_id = source.business_id)) OR
  (source.station_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_stations p WHERE p.id = source.station_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM print_job_attempts source WHERE (source.job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = source.job_id AND p.business_id = source.business_id)) OR
  (source.station_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_stations p WHERE p.id = source.station_id AND p.business_id = source.business_id))
UNION ALL
SELECT 1 FROM print_stations source WHERE (source.recovery_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = source.recovery_job_id AND p.business_id = source.business_id))) THEN 1 ELSE 0 END;
DROP TABLE tenant_migration_assertion;

CREATE TRIGGER tenant_orders_reference_insert
BEFORE INSERT ON orders
WHEN (NEW.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients p WHERE p.id = NEW.client_id AND p.business_id = NEW.business_id)) OR
  (NEW.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.table_tab_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_orders_reference_update
BEFORE UPDATE OF business_id,client_id,table_tab_id ON orders
WHEN (NEW.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients p WHERE p.id = NEW.client_id AND p.business_id = NEW.business_id)) OR
  (NEW.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.table_tab_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_order_items_reference_insert
BEFORE INSERT ON order_items
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_order_items_reference_update
BEFORE UPDATE OF business_id,order_id,product_id ON order_items
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_payments_reference_insert
BEFORE INSERT ON payments
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_payments_reference_update
BEFORE UPDATE OF business_id,order_id ON payments
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_payment_receipts_reference_insert
BEFORE INSERT ON payment_receipts
WHEN (NEW.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.table_tab_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_payment_receipts_reference_update
BEFORE UPDATE OF business_id,table_tab_id ON payment_receipts
WHEN (NEW.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.table_tab_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_movements_reference_insert
BEFORE INSERT ON movements
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = NEW.payment_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_movements_reference_update
BEFORE UPDATE OF business_id,order_id,payment_id ON movements
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = NEW.payment_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_table_tabs_reference_insert
BEFORE INSERT ON table_tabs
WHEN (NEW.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tables p WHERE p.id = NEW.table_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_table_tabs_reference_update
BEFORE UPDATE OF business_id,table_id ON table_tabs
WHEN (NEW.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tables p WHERE p.id = NEW.table_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_table_reservations_reference_insert
BEFORE INSERT ON table_reservations
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tables p WHERE p.id = NEW.table_id AND p.business_id = NEW.business_id)) OR
  (NEW.converted_table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.converted_table_tab_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_table_reservations_reference_update
BEFORE UPDATE OF business_id,order_id,table_id,converted_table_tab_id ON table_reservations
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tables p WHERE p.id = NEW.table_id AND p.business_id = NEW.business_id)) OR
  (NEW.converted_table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.converted_table_tab_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_print_jobs_reference_insert
BEFORE INSERT ON print_jobs
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.table_tab_id AND p.business_id = NEW.business_id)) OR
  (NEW.parent_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = NEW.parent_job_id AND p.business_id = NEW.business_id)) OR
  (NEW.station_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_stations p WHERE p.id = NEW.station_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_print_jobs_reference_update
BEFORE UPDATE OF business_id,order_id,table_tab_id,parent_job_id,station_id ON print_jobs
WHEN (NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders p WHERE p.id = NEW.order_id AND p.business_id = NEW.business_id)) OR
  (NEW.table_tab_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM table_tabs p WHERE p.id = NEW.table_tab_id AND p.business_id = NEW.business_id)) OR
  (NEW.parent_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = NEW.parent_job_id AND p.business_id = NEW.business_id)) OR
  (NEW.station_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_stations p WHERE p.id = NEW.station_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_print_job_attempts_reference_insert
BEFORE INSERT ON print_job_attempts
WHEN (NEW.job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = NEW.job_id AND p.business_id = NEW.business_id)) OR
  (NEW.station_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_stations p WHERE p.id = NEW.station_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_print_job_attempts_reference_update
BEFORE UPDATE OF business_id,job_id,station_id ON print_job_attempts
WHEN (NEW.job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = NEW.job_id AND p.business_id = NEW.business_id)) OR
  (NEW.station_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_stations p WHERE p.id = NEW.station_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_print_stations_reference_insert
BEFORE INSERT ON print_stations
WHEN (NEW.recovery_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = NEW.recovery_job_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_print_stations_reference_update
BEFORE UPDATE OF business_id,recovery_job_id ON print_stations
WHEN (NEW.recovery_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM print_jobs p WHERE p.id = NEW.recovery_job_id AND p.business_id = NEW.business_id))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_REFERENCE_MISMATCH');
END;

CREATE TRIGGER tenant_auth_credentials_ownership_immutable
BEFORE UPDATE OF business_id ON auth_credentials
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_clients_ownership_immutable
BEFORE UPDATE OF business_id ON clients
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_products_ownership_immutable
BEFORE UPDATE OF business_id ON products
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_orders_ownership_immutable
BEFORE UPDATE OF business_id ON orders
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_order_items_ownership_immutable
BEFORE UPDATE OF business_id ON order_items
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_table_tabs_ownership_immutable
BEFORE UPDATE OF business_id ON table_tabs
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_finance_settings_ownership_immutable
BEFORE UPDATE OF business_id ON finance_settings
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_print_stations_ownership_immutable
BEFORE UPDATE OF business_id ON print_stations
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_tables_ownership_immutable
BEFORE UPDATE OF business_id ON tables
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_print_settings_ownership_immutable
BEFORE UPDATE OF business_id ON business_print_settings
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_order_sequences_ownership_immutable
BEFORE UPDATE OF business_id ON order_sequences
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_table_tab_counters_ownership_immutable
BEFORE UPDATE OF business_id ON table_tab_counters
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_order_modalities_ownership_immutable
BEFORE UPDATE OF business_id ON business_order_modalities
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_operation_settings_ownership_immutable
BEFORE UPDATE OF business_id ON business_operation_settings
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_payment_methods_ownership_immutable
BEFORE UPDATE OF business_id ON business_payment_methods
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_payment_settings_ownership_immutable
BEFORE UPDATE OF business_id ON business_payment_settings
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_cancellation_settings_ownership_immutable
BEFORE UPDATE OF business_id ON business_cancellation_settings
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_cancel_reasons_ownership_immutable
BEFORE UPDATE OF business_id ON business_cancel_reasons
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_finance_category_settings_ownership_immutable
BEFORE UPDATE OF business_id ON business_finance_category_settings
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_finance_categories_ownership_immutable
BEFORE UPDATE OF business_id ON business_finance_categories
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_print_topology_settings_ownership_immutable
BEFORE UPDATE OF business_id ON business_print_topology_settings
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_settings_mutation_receipts_ownership_immutable
BEFORE UPDATE OF business_id ON settings_mutation_receipts
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_print_jobs_ownership_immutable
BEFORE UPDATE OF business_id ON print_jobs
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_print_job_attempts_ownership_immutable
BEFORE UPDATE OF business_id ON print_job_attempts
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_payment_receipts_ownership_immutable
BEFORE UPDATE OF business_id ON payment_receipts
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_payment_allocations_ownership_immutable
BEFORE UPDATE OF business_id ON payment_allocations
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_payments_ownership_immutable
BEFORE UPDATE OF business_id ON payments
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_movements_ownership_immutable
BEFORE UPDATE OF business_id ON movements
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_kitchen_tv_access_ownership_immutable
BEFORE UPDATE OF business_id ON kitchen_tv_access
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_profiles_ownership_immutable
BEFORE UPDATE OF business_id ON business_profiles
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_kitchen_tv_display_control_ownership_immutable
BEFORE UPDATE OF business_id ON kitchen_tv_display_control
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_kitchen_tv_hidden_orders_ownership_immutable
BEFORE UPDATE OF business_id ON kitchen_tv_hidden_orders
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_table_reservations_ownership_immutable
BEFORE UPDATE OF business_id ON table_reservations
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_roles_ownership_immutable
BEFORE UPDATE OF business_id ON roles
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_role_capabilities_ownership_immutable
BEFORE UPDATE OF business_id ON role_capabilities
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_users_ownership_immutable
BEFORE UPDATE OF business_id ON users
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_user_credentials_ownership_immutable
BEFORE UPDATE OF business_id ON user_credentials
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_sessions_ownership_immutable
BEFORE UPDATE OF business_id ON sessions
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_access_invites_ownership_immutable
BEFORE UPDATE OF business_id ON access_invites
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_login_attempts_ownership_immutable
BEFORE UPDATE OF business_id ON login_attempts
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_business_auth_state_ownership_immutable
BEFORE UPDATE OF business_id ON business_auth_state
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_audit_events_ownership_immutable
BEFORE UPDATE OF business_id ON audit_events
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_auth_email_challenges_ownership_immutable
BEFORE UPDATE OF business_id ON auth_email_challenges
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_auth_email_requests_ownership_immutable
BEFORE UPDATE OF business_id ON auth_email_requests
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_auth_email_deliveries_ownership_immutable
BEFORE UPDATE OF business_id ON auth_email_deliveries
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_auth_email_staging_bootstraps_ownership_immutable
BEFORE UPDATE OF business_id ON auth_email_staging_bootstraps
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_identity_sessions_ownership_immutable
BEFORE UPDATE OF business_id ON identity_sessions
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_identity_email_deliveries_ownership_immutable
BEFORE UPDATE OF business_id ON identity_email_deliveries
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_company_invitations_ownership_immutable
BEFORE UPDATE OF business_id ON company_invitations
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_platform_audit_events_ownership_immutable
BEFORE UPDATE OF business_id ON platform_audit_events
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

CREATE TRIGGER tenant_platform_provisioning_receipts_ownership_immutable
BEFORE UPDATE OF business_id ON platform_provisioning_receipts
WHEN NEW.business_id IS NOT OLD.business_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_OWNERSHIP_IMMUTABLE');
END;

