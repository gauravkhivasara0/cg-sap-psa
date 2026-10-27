const cds = require('@sap/cds');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

module.exports = async function generateInvoicePdf({ tx, Invoices, InvoiceLines, invoiceID, req }) {
  const invoice = await tx.run(cds.ql.SELECT.one.from(Invoices).where({ ID: invoiceID }));
  if (!invoice) return req.reject(404, 'Invoice not found.');
  if (!invoice.invoice_number || !invoice.issued_at || !invoice.immutable_on_issue) {
    return req.reject(409, 'Only issued invoices can be exported as a PDF.');
  }

  const lines = await tx.run(cds.ql.SELECT.from(InvoiceLines).where({ invoice_ID: invoiceID }));
  const pdf = await PDFDocument.create();
  pdf.setTitle('Invoice ' + invoice.invoice_number);
  pdf.setSubject('Issued PSA invoice');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89];
  const left = 48;
  const right = 547;
  let page;
  let y;
  const money = value => Number(value || 0).toFixed(2);
  const currency = invoice.currency_code || '';

  const draw = (value, x, yy, size = 10, font = regular, color = rgb(0.12, 0.16, 0.22)) => {
    page.drawText(String(value ?? ''), { x, y: yy, size, font, color, maxWidth: right - x });
  };
  const rule = (yy, x1 = left, x2 = right) => page.drawLine({
    start: { x: x1, y: yy }, end: { x: x2, y: yy },
    thickness: 0.7, color: rgb(0.82, 0.85, 0.89)
  });
  const addPage = (continued = false) => {
    page = pdf.addPage(pageSize);
    y = 790;
    draw('INVOICE', left, y, 24, bold, rgb(0.08, 0.25, 0.43));
    draw(invoice.invoice_number, 390, y + 3, 12, bold);
    y -= 20;
    rule(y);
    y -= 28;
    if (continued) {
      draw('Invoice items (continued)', left, y, 10, bold);
      y -= 22;
    }
  };
  const ensureSpace = height => {
    if (y - height < 95) addPage(true);
  };

  addPage();
  draw('ISSUED INVOICE', left, y, 9, bold, rgb(0.25, 0.43, 0.57));
  y -= 30;
  draw('BILL TO', left, y, 8, bold, rgb(0.35, 0.39, 0.44));
  draw('INVOICE DETAILS', 330, y, 8, bold, rgb(0.35, 0.39, 0.44));
  y -= 18;
  draw(invoice.client_name_snapshot || 'Client not specified', left, y, 12, bold);
  draw('Invoice date: ' + (invoice.invoice_date || '—'), 330, y, 9);
  y -= 16;
  draw('Project: ' + (invoice.project_name_snapshot || '—'), left, y, 10);
  draw('Due date: ' + (invoice.due_date || '—'), 330, y, 9);
  y -= 16;
  draw('Currency: ' + currency, left, y, 9);
  draw('Status: Issued', 330, y, 9);
  y -= 24;
  if (invoice.period_from || invoice.period_to) {
    draw('Billing period: ' + (invoice.period_from || '—') + ' to ' + (invoice.period_to || '—'), left, y, 9);
    y -= 24;
  }
  rule(y);
  y -= 22;

  const columns = { description: left + 6, quantity: 356, unitPrice: 414, amount: 493 };
  const tableHeader = () => {
    page.drawRectangle({
      x: left, y: y - 7, width: right - left, height: 25,
      color: rgb(0.93, 0.95, 0.97)
    });
    draw('DESCRIPTION', columns.description, y, 8, bold);
    draw('QTY', columns.quantity, y, 8, bold);
    draw('UNIT PRICE', columns.unitPrice, y, 8, bold);
    draw('AMOUNT', columns.amount, y, 8, bold);
    y -= 24;
  };
  tableHeader();

  for (const line of lines) {
    const words = String(line.description || 'Invoice item').split(/\\s+/);
    const wrapped = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (regular.widthOfTextAtSize(candidate, 9) > 275 && current) {
        wrapped.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) wrapped.push(current);
    const rowHeight = Math.max(24, wrapped.length * 12 + 10);
    ensureSpace(rowHeight + 6);
    wrapped.forEach((part, index) => draw(part, columns.description, y - index * 12, 9));
    draw(money(line.quantity), columns.quantity, y, 9);
    draw(money(line.unit_price), columns.unitPrice, y, 9);
    draw(money(line.line_subtotal ?? line.line_total), columns.amount, y, 9, bold);
    y -= rowHeight;
    rule(y + 5);
    y -= 2;
  }

  ensureSpace(112);
  y -= 12;
  draw('Subtotal', 370, y, 10);
  draw(currency + ' ' + money(invoice.subtotal_amt), 465, y, 10);
  y -= 18;
  draw('Tax (' + money(invoice.tax_rate) + '%)', 370, y, 10);
  draw(currency + ' ' + money(invoice.tax_amt), 465, y, 10);
  y -= 12;
  rule(y, 365, right);
  y -= 24;
  draw('TOTAL DUE', 370, y, 11, bold, rgb(0.08, 0.25, 0.43));
  draw(currency + ' ' + money(invoice.total_amt), 450, y, 12, bold, rgb(0.08, 0.25, 0.43));
  y -= 35;
  draw('This PDF reflects the saved issued invoice record.', left, y, 8, regular, rgb(0.4, 0.43, 0.47));
  draw('Generated on ' + new Date().toISOString().slice(0, 10), left, y - 12, 8, regular, rgb(0.4, 0.43, 0.47));
  return Buffer.from(await pdf.save());
};
