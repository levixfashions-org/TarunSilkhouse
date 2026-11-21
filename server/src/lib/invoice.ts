import PDFDocument from 'pdfkit';
import type { Settings } from './settings.ts';

type InvoiceOrder = {
  number: string;
  createdAt: Date;
  paymentMethod: string;
  email: string;
  phone: string;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipLandmark: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  total: number;
  couponCode: string | null;
  giftMessage: string | null;
  items: { name: string; colourName: string; qty: number; unitPrice: number; servicesFee: number; options: unknown }[];
};

// PDFKit's built-in fonts can't draw "₹", so amounts use "Rs."
const rs = (p: number) => `Rs. ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderInvoice(o: InvoiceOrder, s: Settings, kind: 'invoice' | 'packing'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const maroon = '#6B1F2A';
    const gold = '#B8893B';
    doc.fillColor(maroon).font('Times-Roman').fontSize(24).text(s.store.storeName.toUpperCase(), { characterSpacing: 4 });
    doc.fillColor('#555').font('Helvetica').fontSize(9).text([s.store.address, s.store.email, s.store.phone, s.store.gstin ? `GSTIN ${s.store.gstin}` : ''].filter(Boolean).join('  ·  '));
    doc.moveDown(0.5).strokeColor(gold).lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();

    doc.moveDown();
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(14).text(kind === 'invoice' ? 'TAX INVOICE' : 'PACKING SLIP');
    doc.font('Helvetica').fontSize(10).text(`Order ${o.number}   ·   ${o.createdAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}   ·   ${o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Prepaid'}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Ship to');
    doc.font('Helvetica').text([o.shipName, o.shipLine1, o.shipLine2, o.shipLandmark ? `Near ${o.shipLandmark}` : null, `${o.shipCity}, ${o.shipState} ${o.shipPincode}`, `Phone ${o.phone}`].filter(Boolean).join('\n'));

    doc.moveDown();
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Item', 48, top);
    doc.text('Qty', 350, top, { width: 40, align: 'right' });
    if (kind === 'invoice') {
      doc.text('Price', 395, top, { width: 70, align: 'right' });
      doc.text('Amount', 470, top, { width: 77, align: 'right' });
    }
    doc.moveTo(48, doc.y + 4).lineTo(547, doc.y + 4).strokeColor('#ccc').stroke();
    doc.font('Helvetica');
    let y = doc.y + 10;
    for (const it of o.items) {
      const opts = (it.options ?? {}) as { fallPico?: boolean; stitching?: object };
      const extra = [opts.fallPico ? 'Fall & pico' : null, opts.stitching ? 'Stitched blouse' : null].filter(Boolean).join(', ');
      doc.text(`${it.name} — ${it.colourName}${extra ? `\n${extra}` : ''}`, 48, y, { width: 290 });
      const h = doc.y - y;
      doc.text(String(it.qty), 350, y, { width: 40, align: 'right' });
      if (kind === 'invoice') {
        doc.text(rs(it.unitPrice + it.servicesFee), 395, y, { width: 70, align: 'right' });
        doc.text(rs((it.unitPrice + it.servicesFee) * it.qty), 470, y, { width: 77, align: 'right' });
      }
      y += Math.max(h, 14) + 8;
    }
    doc.moveTo(48, y).lineTo(547, y).strokeColor('#ccc').stroke();

    if (kind === 'invoice') {
      y += 10;
      const row = (label: string, val: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 330, y, { width: 135, align: 'right' });
        doc.text(val, 470, y, { width: 77, align: 'right' });
        y += 16;
      };
      row('Subtotal', rs(o.subtotal));
      if (o.discount) row(`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`, `- ${rs(o.discount)}`);
      row('Shipping', o.shipping ? rs(o.shipping) : 'Free');
      if (o.codFee) row('COD fee', rs(o.codFee));
      if (o.giftWrap) row('Gift wrap', rs(o.giftWrap));
      row('Total', rs(o.total), true);
      const gst = Math.round(o.total - o.total / (1 + s.shipping.gstPercent / 100));
      doc.font('Helvetica').fontSize(8).fillColor('#666').text(`Prices include GST @ ${s.shipping.gstPercent}% (${rs(gst)}).`, 330, y + 4, { width: 217, align: 'right' });
    }
    if (o.giftMessage) {
      doc.fillColor('#111').fontSize(10).font('Helvetica-Bold').text('Gift message', 48, y + 40);
      doc.font('Times-Italic').fontSize(12).text(o.giftMessage, { width: 400 });
    }
    doc.fillColor('#888').font('Helvetica').fontSize(8).text('Thank you for choosing handloom.', 48, 780, { align: 'center', width: 499 });
    doc.end();
  });
}
