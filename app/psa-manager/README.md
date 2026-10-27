# PSA Billing UI

This is the first real SAPUI5 freestyle UI for the PSA billing domain.

## First-screen scope

- Reads invoice records from the CAP BillingService OData V4 endpoint at `/odata/v4/billing/`.
- Lists invoice number, client, project, date, total, currency, and payment status.
- Supports basic text filtering and refresh.
- Shows invoice header fields and associated invoice lines after selecting a row.
- Calls the CAP `downloadInvoicePdf` action for issued invoices and initiates a browser PDF download.

## Access requirements

The CAP BillingService requires the `FinanceRole`. A user without that role will receive an authorization error from the backend. Assign the role in the configured identity/BTP environment; the UI does not bypass backend authorization.

## Local development

Start the CAP server using the project's usual local development command, then open the app's `index.html` through the CAP-served app route. The app loads SAPUI5 from the SAPUI5 CDN, so a network connection is needed. The exact local route depends on the CAP development setup.

## Current limitations

- This is the first billing screen, not yet the complete PSA navigation shell.
- The PDF action response is handled as a base64-encoded OData binary result; confirm the exact response shape when the first approved manual UI verification is performed.
- The UI has not been built or run yet. No tests, build, or runtime checks were run for this increment.
- The UI currently uses a SAPUI5 CDN bootstrap. Production deployment should use the project's intended SAP BTP approuter and UI deployment setup.
