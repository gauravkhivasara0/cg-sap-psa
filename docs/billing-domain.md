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

## Service registration note

The service implementation file now exports separate implementations for the service definitions in `psa-services.cds`. Billing actions are registered on the `BillingService` instance by action name. This correction is source-only and still requires an approved build/runtime verification step.

## Database-backed invoice numbering

- Invoice numbers are assigned when a Draft invoice is issued, not when the draft is generated.
- Format: `INV-YYYY-000001`; the six-digit sequence resets to `000001` when the UTC calendar year changes.
- `db/schema.cds` adds a singleton `InvoiceNumberCounter` record and a uniqueness constraint on `Invoices.invoice_number`.
- `db/data/psa-InvoiceNumberCounter.csv` seeds the singleton counter row. Ensure this seed row is deployed to the target database before issuing invoices; the handler returns a configuration error if it is missing.
- The issue handler updates the singleton counter row within the invoice transaction before reading/incrementing the counter. The database write lock serializes concurrent allocations; invoice number, issue status, and counter update commit or roll back together.
- Sequence is capped at six digits for this format. At `999999`, issuing is blocked rather than silently producing a different format.
- The annual reset uses UTC calendar year. If Finance requires a local timezone, legal entity, or fiscal-year numbering, confirm it before production.
- Source-only implementation: no build, test, or runtime verification has been run yet.

## Invoice generation

The BillingService `generateInvoice` action dispatches by the project's `billing_type`:

- **T&M**: bills Approved billable timesheet entries in the requested work-date period and links each line to its source entry.
- **Fixed**: bills milestones only when `status = 'Completed'` and `is_billable = true`. Each milestone must have a positive `fixed_fee_amt`; each line links to its milestone.
- **Retainer**: bills `Projects.retainer_fee_amt` once for a complete calendar month. The source key is project plus year/month, preventing a second invoice for that month.

All three create Draft invoices and use the project budget's currency. Tax remains provisionally zero until an approved tax configuration is supplied. Source keys have a database uniqueness constraint to protect against duplicate links, including simultaneous requests.

## Lifecycle controls

- Issue requires a Draft invoice, at least one line, a valid three-letter currency, and non-negative finite line totals.
- Issue stores issue/due dates and marks the issued snapshot immutable. The 30-calendar-day due-date default still requires Finance confirmation.
- Payment requires an Issued or Overdue invoice and a real calendar date.
- Issued invoice financial fields and lines are protected from direct changes.
- Draft invoices can be cancelled with a reason. Cancellation preserves the invoice header and an audit record of its former lines, then removes active lines/source links so those sources can be invoiced again. Issued invoices cannot be cancelled through this action.

## Invoice PDF

The `downloadInvoicePdf(invoiceID)` action creates a PDF on demand using `pdf-lib`. It only accepts issued invoices and reads the stored invoice header and lines, including the client/project name snapshots and stored amounts. It does not save a permanent PDF copy. The returned OData binary value can be converted to a downloadable PDF by the client app. Standard built-in PDF fonts are used for a simple MVP layout; unusual non-Latin characters may need a later embedded-font improvement.

## Remaining gaps — not production-ready

1. Tax rules are not configured; zero tax is provisional and must not be treated as a tax determination.
2. The invoice-number counter locking strategy still needs database-specific concurrency verification.
3. Invoice numbering's UTC calendar-year reset and 30-day due-date term require Finance confirmation.
4. Cancellation/reversal of issued invoices needs a credit-note or reversal policy; only draft cancellation is implemented.
5. Real email notifications need an approved provider and secure BTP configuration.
6. PDF output and all billing behavior still need an approved verification step before deployment.

## Verification status

Source changes only. No tests, builds, runtime checks, or database deployment were run as part of this increment. Ask before any such verification.
