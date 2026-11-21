import { prisma } from './db.ts';
import { env } from './env.ts';
import { log } from './lib/log.ts';
import { layout, rupees, sendMail } from './lib/mail.ts';
import { expireUnpaid } from './lib/orders.ts';

/** Bags left for 3+ hours with an email get one gentle reminder. */
async function abandonedBags() {
  const cutoff = new Date(Date.now() - 3 * 3600_000);
  const old = new Date(Date.now() - 3 * 86400_000);
  const carts = await prisma.cart.findMany({
    where: { email: { not: null }, remindedAt: null, updatedAt: { lt: cutoff, gt: old }, items: { some: {} } },
    include: { items: { include: { product: true, colour: true } } },
    take: 25,
  });
  for (const c of carts) {
    const ordered = await prisma.order.count({ where: { email: c.email!, createdAt: { gt: c.updatedAt } } });
    if (!ordered) {
      const list = c.items.map((i) => `<li>${i.product.name} — ${i.colour.colourName} · ${rupees(i.product.price + i.colour.priceDelta)}</li>`).join('');
      await sendMail(c.email!, 'Your sarees are still waiting', await layout('Still thinking it over?', `<p>You left these in your bag:</p><ul>${list}</ul><p><a href="${env.PUBLIC_URL}/bag" style="color:#6B1F2A">Return to your bag</a></p>`));
    }
    await prisma.cart.update({ where: { id: c.id }, data: { remindedAt: new Date() } });
  }
}

/** "Notify me" — emails people once the colour is back in stock. */
async function backInStock() {
  const alerts = await prisma.stockAlert.findMany({
    where: { notifiedAt: null, email: { not: null }, OR: [{ colour: { stock: { gt: 0 } } }, { colourId: null, product: { colours: { some: { stock: { gt: 0 } } } } }] },
    include: { product: true, colour: true },
    take: 50,
  });
  for (const a of alerts) {
    await sendMail(
      a.email!,
      `${a.product.name} is back`,
      await layout('It is back in stock', `<p><strong>${a.product.name}</strong>${a.colour ? ` in ${a.colour.colourName}` : ''} is available again — handloom pieces go quickly.</p><p><a href="${env.PUBLIC_URL}/products/${a.product.slug}" style="color:#6B1F2A">View the saree</a></p>`),
    );
    await prisma.stockAlert.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
  }
}

export function startJobs() {
  const run = (name: string, fn: () => Promise<void>) => () => fn().catch((e) => log.error('job_failed', { name, err: String(e) }));
  setInterval(run('expireUnpaid', expireUnpaid), 5 * 60_000).unref();
  setInterval(run('abandonedBags', abandonedBags), 60 * 60_000).unref();
  setInterval(run('backInStock', backInStock), 15 * 60_000).unref();
  setTimeout(run('expireUnpaid', expireUnpaid), 10_000).unref();
}
