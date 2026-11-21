import nodemailer from 'nodemailer';
import { env } from '../env.ts';
import { log } from './log.ts';
import { getSettings } from './settings.ts';

const transport =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

export async function sendMail(to: string, subject: string, html: string) {
  if (!transport) {
    log.info('mail_skipped_no_smtp', { to, subject });
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, html });
  } catch (e) {
    log.error('mail_failed', { to, subject, err: String(e) });
  }
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function layout(title: string, body: string) {
  const s = await getSettings();
  return `<!doctype html><html><body style="margin:0;background:#FBF7F0;font-family:Georgia,serif;color:#1B1612">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;letter-spacing:.35em;font-size:20px;color:#6B1F2A">${esc(s.store.storeName.toUpperCase())}</div>
    <div style="height:1px;background:#B8893B;margin:16px 0 28px"></div>
    <h1 style="font-weight:400;font-size:26px;margin:0 0 16px">${esc(title)}</h1>
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${body}</div>
    <div style="height:1px;background:#e8dccb;margin:32px 0 16px"></div>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#7a6d60;text-align:center">
      ${esc(s.store.storeName)} · ${esc(s.store.email)} · WhatsApp +${esc(s.store.whatsapp)}</p>
  </div></body></html>`;
}

type OrderForMail = {
  number: string;
  email: string;
  total: number;
  paymentMethod: string;
  shipName: string;
  shipCity: string;
  items: { name: string; colourName: string; qty: number; unitPrice: number; servicesFee: number }[];
};

export async function sendOrderConfirmation(o: OrderForMail) {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.name)} <span style="color:#7a6d60">· ${esc(i.colourName)} × ${i.qty}</span></td>
         <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${rupees((i.unitPrice + i.servicesFee) * i.qty)}</td></tr>`,
    )
    .join('');
  const html = await layout(
    `Thank you, ${o.shipName.split(' ')[0]}`,
    `<p>Your order <strong>${esc(o.number)}</strong> is confirmed. We'll message you when it ships.</p>
     <table style="width:100%;border-collapse:collapse">${rows}
     <tr><td style="padding:12px 0"><strong>Total</strong> (${o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'})</td>
     <td style="text-align:right"><strong>${rupees(o.total)}</strong></td></tr></table>
     <p><a href="${env.PUBLIC_URL}/track?order=${encodeURIComponent(o.number)}" style="color:#6B1F2A">Track your order</a></p>`,
  );
  await sendMail(o.email, `Order ${o.number} confirmed — Tarun Silks`, html);
  if (env.ORDER_ALERT_EMAIL) {
    await sendMail(env.ORDER_ALERT_EMAIL, `New order ${o.number} · ${rupees(o.total)} · ${o.shipCity}`, html);
  }
}

/** Ready-to-send WhatsApp text (customer taps it on the confirmation page or admin sends it). */
export function whatsappOrderText(o: OrderForMail) {
  return [
    `Hello! I placed order ${o.number} on Tarun Silks.`,
    ...o.items.map((i) => `• ${i.name} (${i.colourName}) × ${i.qty}`),
    `Total: ${rupees(o.total)} (${o.paymentMethod === 'COD' ? 'COD' : 'Paid'})`,
  ].join('\n');
}
