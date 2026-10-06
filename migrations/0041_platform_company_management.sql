ALTER TABLE businesses ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'enabled' CHECK(lifecycle_status IN ('enabled','suspended','deleted'));
ALTER TABLE businesses ADD COLUMN management_revision INTEGER NOT NULL DEFAULT 0 CHECK(typeof(management_revision)='integer' AND management_revision>=0);

CREATE TABLE platform_grants_expanded (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  capability TEXT NOT NULL CHECK(capability IN ('platform.businesses.view','platform.businesses.create','platform.invitations.resend','platform.businesses.manage','platform.businesses.delete','platform.memberships.view','platform.memberships.manage','platform.invitations.cancel')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(account_id,capability)
);
INSERT INTO platform_grants_expanded SELECT account_id,capability,created_at FROM platform_grants;
DROP TABLE platform_grants;
ALTER TABLE platform_grants_expanded RENAME TO platform_grants;
INSERT INTO platform_grants(account_id,capability,created_at)
SELECT p.account_id,c.capability,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM platform_bootstraps p CROSS JOIN (
 SELECT 'platform.businesses.manage' AS capability UNION ALL SELECT 'platform.businesses.delete'
 UNION ALL SELECT 'platform.memberships.view' UNION ALL SELECT 'platform.memberships.manage' UNION ALL SELECT 'platform.invitations.cancel'
) c WHERE 1 ON CONFLICT(account_id,capability) DO NOTHING;

ALTER TABLE platform_audit_events ADD COLUMN reason TEXT;
ALTER TABLE platform_audit_events ADD COLUMN resource_type TEXT;
ALTER TABLE platform_audit_events ADD COLUMN resource_id TEXT;
ALTER TABLE platform_audit_events ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json) AND json_type(metadata_json)='object');
CREATE INDEX platform_audit_business_created_idx ON platform_audit_events(business_id,created_at DESC,id DESC);

CREATE TABLE platform_management_receipts (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 operation TEXT NOT NULL CHECK(operation IN ('suspend','resume','delete','restore','membership.revoke','membership.reactivate','invitation.cancel','invitation.resend')),
 idempotency_key TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 result_json TEXT NOT NULL CHECK(json_valid(result_json) AND json_type(result_json)='object'),
 created_at TEXT NOT NULL,
 UNIQUE(account_id,idempotency_key)
);
