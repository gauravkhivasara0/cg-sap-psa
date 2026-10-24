# Billing Domain: Current Design and Next Steps

This document describes the billing code as it currently exists on `feature/frd-first-cap-foundation`. It is an implementation note, not evidence of a successful build or finance approval.

## Folder ownership

- `srv/psa-services.cds`: OData action and entity contracts.
- `srv/psa-services.js`: thin CAP service registrar and shared audit helper.
- `srv/billing/handlers.js`: registers invoice guard and billing action handlers.
- `srv/timesheets/handlers.js`: registers time-entry validation and timesheet workflow handlers.
- `srv/projects/handlers.js`: registers project/task/milestone validation and budget recalculation.
- `srv/billing/generate-time-and-material-invoice.js`: T&M draft invoice creation and source traceability.
- `srv/billing/invoice-lifecycle.js`: issue and payment lifecycle handlers.
- `db/schema.cds`: invoice, line, source-link and related persistence entities.

The extraction is deliberately gradual. Domain modules now live directly under `srv/`; a separate `lib/` directory is not required. Keep simple, named modules; do not introduce a generic repository/service framework without a concrete need. Fiori app code stays under `app/` and does not own billing rules.

## Current T&M flow

1. Finance requests invoice generation with a project and inclusive period start/end.
2. The handler validates real calendar dates and period order, confirms the project is T&M, loads its client and budget, and checks the budget rate/currency.
3. It selects only Approved timesheets and billable entries whose actual work date is in the requested period.
4. It rejects the request if a source entry already has an invoice source link.
5. It creates a Draft invoice, snapshots client/project names, creates a line per source entry, and links each line to its source entry.
6. Every financial action writes an audit record through the existing audit helper.

## Lifecycle controls

- Issue requires a Draft invoice, at least one line, a valid three-letter currency, and non-negative finite line totals.
- Issue stores issue/due dates and marks the invoice snapshot immutable. The current due-date default is 30 calendar days and still requires Finance confirmation.
- Payment requires an Issued or Overdue invoice and a real calendar date in `YYYY-MM-DD` format.
- Existing service guards prevent direct financial-field edits after issue and prevent invoice-line create/update/delete against an issued invoice.

## Known gaps — do not treat billing as production-ready

1. **Invoice numbering:** the schema has an `invoice_number` field, but no database-backed counter or concurrency-safe allocation yet.
2. **Tax:** the current zero-tax calculation is provisional only. A Finance-approved tax configuration, jurisdiction, inclusive/exclusive rules, and rounding policy are not supplied. Do not interpret zero as a tax determination.
3. **Fixed billing:** eligible milestone status, milestone fee source, partial milestone invoicing, and contract-specific rules need confirmation before implementing the generator.
4. **Retainer billing:** allowed period values, billing calendar, proration, and duplicate-period key rules need confirmation before implementing the generator.
5. **Duplicate-billing race:** source links are checked before draft creation, but there is no database uniqueness/concurrency guarantee. Two simultaneous requests could race until a database-level control is added.
6. **Cancellation and reversals:** cancelling a draft and releasing its source links, and handling issued-invoice credit/reversal flows, are not implemented.
7. **Real email:** issue/payment notifications need the approved provider and secure BTP configuration. Do not replace this with a mock sender.
8. **PDF:** on-demand PDF generation and a stable issued snapshot remain to be implemented.

## Next safe implementation order

1. Confirm invoice-number format and allocation semantics; add database-backed, concurrency-safe numbering.
2. Obtain approved tax rules and block issue where required configuration is absent.
3. Confirm fixed-fee milestone eligibility and retainer period semantics, then implement each as a separate module with source keys.
4. Design draft cancellation/source-link release and issued-invoice reversal/credit-note policy.
5. Connect real email after the provider configuration is supplied.
6. Implement PDF generation from stored issued values.

No tests, build, or runtime checks have been run for the current changes. Ask the developer before any verification commands.
