const PDFDocument = require('pdfkit');

module.exports = async function generateInvoicePdf({ tx, Invoices, InvoiceLines, invoiceID, req }) {
  const invoice = await tx.run(req.query.SELECT.one.from(Invoices).where({ ID: invoiceID }));
  if (!invoice) return req.reject(404, 'Invoice not found.');
  if (!invoice.invoice_number || !invoice.issued_at || !invoice.immutable_on_issue) {
    return req.reject(409, 'Only issued invoices can be exported as a PDF.');
  }
  const lines = await tx.run(req.query.SELECT.from(InvoiceLines).where({ invoice_ID: invoiceID }));
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(20).text('Invoice', { align: 'right' });
  doc.moveDown();
  doc.fontSize(11).text('Invoice number: ' + invoice.invoice_number);
  doc.text('Issue date: ' + String(invoice.invoice_date || ''));
  doc.text('Due date: ' + String(invoice.due_date || ''));
  doc.moveDown();
  doc.fontSize(12).text('Bill to: ' + String(invoice.client_name_snapshot || ''));
  doc.text('Project: ' + String(invoice.project_name_snapshot || ''));
  doc.text('Currency: ' + String(invoice.currency_code || ''));
  doc.moveDown();
  doc.fontSize(10).text('Description', 48, doc.y, { continued: true, width: 250 });
  doc.text('Qty     Unit price       Total', { align: 'right' });
  doc.moveDown(0.5);
  for (const line of lines) {
    if (doc.y > 700) doc.addPage();
    doc.text(String(line.description || ''), 48, doc.y, { width: 250, continued: false });
    const y = doc.y - 12;
    doc.text(String(line.quantity) + '     ' + Number(line.unit_price).toFixed(2) + '     ' + Number(line.line_total).toFixed(2), 310, y, { width: 235, align: 'right' });
    doc.moveDown(0.4);
  }
  doc.moveDown();
  doc.fontSize(11).text('Subtotal: ' + Number(invoice.subtotal_amt || 0).toFixed(2), { align: 'right' });
  doc.text('Tax: ' + Number(invoice.tax_amt || 0).toFixed(2), { align: 'right' });
  doc.fontSize(13).text('Total: ' + String(invoice.currency_code) + ' ' + Number(invoice.total_amt || 0).toFixed(2), { align: 'right' });
  doc.moveDown();
  doc.fontSize(8).text('Generated from the issued invoice record. Tax values reflect the configuration recorded on the invoice.', { align: 'left' });
  doc.end();
  return completed;
};
