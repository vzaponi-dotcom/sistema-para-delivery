## Summary

Describe what changes, why it is needed, and whether it changes customer-facing behavior.

## Validation
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run d1:migrate:local`
- [ ] Staging deployment/acceptance completed when behavior or infrastructure changed

## Migration impact
- [ ] No migration in this PR
- [ ] Migration is additive/forward-compatible
- [ ] Data backfill/transformation reviewed
- [ ] Production data is not copied into staging

If this PR contains a migration, describe its production impact and the order in which schema/data/code changes are expected to run.

## Rollback
Describe the last known-good code version and whether the previous application version remains compatible with the resulting schema.

## Staging
Record the staging workflow/run used for acceptance and the behavior that was checked. Do not include real customer or production data.

## Production data
Confirm this PR does not contain customer/order/payment exports, real PINs, addresses, phone numbers, or database dumps.
