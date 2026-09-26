-- EXPLAIN QUERY PLAN on the reporting detail page showed a temporary B-tree
-- for order_number/id tie-breaking with orders_business_date_idx. This index
-- serves the default date-desc page without a cross-business scan or temp sort.
CREATE INDEX orders_reporting_detail_date_idx
  ON orders (business_id, order_date DESC, order_number DESC, id DESC);
