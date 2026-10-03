CREATE INDEX audit_events_resource_time_idx ON audit_events
  (business_id, resource_type, resource_id, occurred_at DESC, id DESC);
