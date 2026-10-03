-- Operators can apply the same order discount/surcharge adjustment used during checkout.
-- Scope only the built-in operator role; custom roles remain unchanged.
INSERT INTO role_capabilities (business_id, role_id, capability)
SELECT business_id, id, 'orders.discount'
FROM roles
WHERE code = 'operator' AND is_builtin = 1
ON CONFLICT (business_id, role_id, capability) DO NOTHING;
