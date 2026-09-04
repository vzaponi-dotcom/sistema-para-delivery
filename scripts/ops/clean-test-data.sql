PRAGMA foreign_keys = ON;

DELETE FROM print_jobs WHERE business_id = 'amor-e-sabor';
DELETE FROM print_stations WHERE business_id = 'amor-e-sabor';
DELETE FROM movements WHERE business_id = 'amor-e-sabor';
DELETE FROM payments WHERE business_id = 'amor-e-sabor';
DELETE FROM order_items WHERE business_id = 'amor-e-sabor';
DELETE FROM orders WHERE business_id = 'amor-e-sabor';
DELETE FROM table_tabs WHERE business_id = 'amor-e-sabor';
DELETE FROM clients WHERE business_id = 'amor-e-sabor';
DELETE FROM finance_settings WHERE business_id = 'amor-e-sabor';
