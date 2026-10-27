const cds = require('@sap/cds');
const { PDFDocument, StandardFonts } = require('pdf-lib');

module.exports = async function generateInvoicePdf({ tx, Invoices, InvoiceLines, invoiceID, req }) {
  const invoice = await tx.run(cds.ql.SELECT.one.from(Invoices).where({ ID: invoiceID }));
  if (!invoice) return req.reject(404, 'Invoice not found.');
  if (!invoice.invoice_number || !invoice.issued_at || !invoice.immutable_on_issue) {
    return req.reject(409, 'Only issued invoices can be exported as a PDF.');
  }
  const lines = await tx.run(require('@sap/cds').ql.SELECT.from(InvoiceLines).where({ invoice_ID: invoiceID }));
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let y = 790;
  const left = 48;
  const text = (value, x = left, size = 10, font = regular) => {
    page.drawText(String(value ?? ''), { x, y, size, font });
  };
  const newPageIfNeeded = () => {
    if (y < 90) {
      page = pdf.addPage(pageSize);
      y = 790;
    }
  };

  text('INVOICE', 400, 22, bold);
  y -= 38;
  text('Invoice number: ' + invoice.invoice_number, left, 11, bold); y -= 18;
  text('Issue date: ' + String(invoice.invoice_date || ''), left); y -= 15;
  text('Due date: ' + String(invoice.due_date || ''), left); y -= 25;
  text('Bill to: ' + String(invoice.client_name_snapshot || ''), left, 12, bold); y -= 18;
  text('Project: ' + String(invoice.project_name_snapshot || ''), left); y -= 15;
  text('Currency: ' + String(invoice.currency_code || ''), left); y -= 28;

  text('Description', left, 10, bold);
  text('Qty', 365, 10, bold);
  text('Unit price', 405, 10, bold);
  text('Total', 495, 10, bold);
  y -= 18;
  for (const line of lines) {
    newPageIfNeeded();
    const description = String(line.description || '').slice(0, 48);
    text(description, left);
    text(Number(line.quantity).toFixed(2), 365);
    text(Number(line.unit_price).toFixed(2), 405);
    text(Number(line.line_total).toFixed(2), 495);
    y -= 18;
  }
  y -= 18;
  text('Subtotal: ' + Number(invoice.subtotal_amt || 0).toFixed(2), 390, 10, regular); y -= 16;
  text('Tax: ' + Number(invoice.tax_amt || 0).toFixed(2), 390, 10, regular); y -= 18;
  text('Total: ' + String(invoice.currency_code || '') + ' ' + Number(invoice.total_amt || 0).toFixed(2), 350, 13, bold); y -= 28;
  text('Generated from the issued invoice record.', left, 8);
  return Buffer.from(await pdf.save());
};
