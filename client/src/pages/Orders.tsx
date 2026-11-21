import { CheckCircle2, MessageCircle, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Draw, Lotus } from '@/components/Ornaments';
import { Empty, Framed, Spinner } from '@/components/ui';
import { get, post } from '@/lib/api';
import { dateIN, inr, statusLabel, waLink } from '@/lib/format';
import { useSeo } from '@/lib/hooks';
import type { PublicOrder } from '@/lib/types';
import { useBoot } from '@/store';

const FLOW = ['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED'];

export function Timeline({ order }: { order: PublicOrder }) {
  const ended = order.status === 'CANCELLED' || order.status === 'RETURNED';
  const at = (s: string) => order.events.find((e) => e.status === s)?.at;
  const idx = FLOW.indexOf(order.status);
  if (ended)
    return (
      <p className="rounded-xl bg-blush px-4 py-3 text-[15px]">
        {statusLabel[order.status]} {order.events.at(-1)?.note ? `— ${order.events.at(-1)!.note}` : ''}
      </p>
    );
  return (
    <ol className="relative ml-2 border-l border-line pl-6">
      {FLOW.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="relative pb-6 last:pb-0">
            <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${done ? 'border-maroon bg-maroon' : 'border-line bg-ivory'}`} />
            <p className={done ? 'font-medium' : 'text-muted'}>{statusLabel[s]}</p>
            {at(s) && <p className="text-[13px] text-muted">{dateIN(at(s)!, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
            {s === 'SHIPPED' && done && order.awb && (
              <p className="mt-1 text-[14px]">
                {order.courier ?? 'Courier'} · AWB {order.awb}{' '}
                {order.trackingUrl && (
                  <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-maroon underline underline-offset-4">
                    Track parcel
                  </a>
                )}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderSummary({ order }: { order: PublicOrder }) {
  return (
    <div className="card p-5">
      <ul className="divide-y divide-line">
        {order.items.map((it, i) => (
          <li key={i} className="flex gap-3 py-3">
            <div className="w-14 shrink-0">
              <Framed url={it.image} alt={it.name} sizes="56px" className="rounded-lg" />
            </div>
            <div className="flex-1 text-[14px]">
              <p className="font-medium">{it.name}</p>
              <p className="text-muted">
                {it.colourName} × {it.qty}
              </p>
            </div>
            <p className="text-[14px]">{inr((it.unitPrice + it.servicesFee) * it.qty)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd>{inr(order.subtotal)}</dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-sage">
            <dt>Discount</dt>
            <dd>−{inr(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd>{order.shipping ? inr(order.shipping) : 'Free'}</dd>
        </div>
        {order.codFee > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">COD fee</dt>
            <dd>{inr(order.codFee)}</dd>
          </div>
        )}
        {order.giftWrap > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Gift wrap</dt>
            <dd>{inr(order.giftWrap)}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 text-[16px] font-medium">
          <dt>Total ({order.paymentMethod === 'COD' ? 'cash on delivery' : 'paid'})</dt>
          <dd>{inr(order.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function OrderConfirmed() {
  const { number = '' } = useParams();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const wa = useBoot((b) => b.boot?.store.whatsapp);
  useSeo('Order confirmed');
  useEffect(() => {
    let last: { number: string; key: string } | null = null;
    try {
      last = JSON.parse(sessionStorage.getItem('ts-last-order') ?? 'null');
    } catch {
      /* ignore */
    }
    if (!last || last.number !== number) return setErr('Open your order from the confirmation email, or track it with your phone number.');
    post<{ order: PublicOrder }>('/orders/confirmation', { number, idempotencyKey: last.key })
      .then((r) => setOrder(r.order))
      .catch((e) => setErr((e as Error).message));
  }, [number]);

  if (err)
    return (
      <Empty
        title={`Order ${number}`}
        body={err}
        action={
          <Link to={`/track?order=${number}`} className="btn-primary">
            Track this order
          </Link>
        }
      />
    );
  if (!order)
    return (
      <div className="flex justify-center py-32">
        <Spinner />
      </div>
    );
  return (
    <div className="page-x max-w-3xl py-12 md:py-20">
      <div className="text-center">
        <Draw className="mx-auto mb-6 w-24 text-gold">
          <Lotus />
        </Draw>
        <p className="mb-2 inline-flex items-center gap-2 text-sage">
          <CheckCircle2 size={18} /> {order.paymentMethod === 'COD' ? 'Order placed' : 'Payment received'}
        </p>
        <h1 className="font-serif text-d-2">Thank you, {order.shipName.split(' ')[0]}.</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Order <strong className="text-ink">{order.number}</strong> is confirmed. A receipt is on its way to your email, and we will message you when it ships to {order.shipCity}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {wa && (
            <a className="btn-primary" href={waLink(wa, order.whatsappText)} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Send order on WhatsApp
            </a>
          )}
          <Link to="/shop" className="btn-ghost">
            Continue shopping
          </Link>
        </div>
      </div>
      <div className="mt-14 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-4 font-serif text-2xl">Status</h2>
          <Timeline order={order} />
        </div>
        <div>
          <h2 className="mb-4 font-serif text-2xl">Summary</h2>
          <OrderSummary order={order} />
        </div>
      </div>
    </div>
  );
}

export function Track() {
  const [params] = useSearchParams();
  const [num, setNum] = useState(params.get('order') ?? '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useSeo('Track your order');
  return (
    <div className="page-x max-w-3xl py-12 md:py-20">
      <h1 className="font-serif text-d-2">Track your order</h1>
      <p className="mt-3 text-muted">No account needed — use the order number from your email and the phone number you ordered with.</p>
      <form
        className="mt-8 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const r = await get<{ order: PublicOrder }>(`/orders/track?number=${encodeURIComponent(num.trim())}&phone=${encodeURIComponent(phone)}`);
            setOrder(r.order);
          } catch (e2) {
            setErr((e2 as Error).message);
            setOrder(null);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className="field uppercase" placeholder="Order number, e.g. TS261121-12345" value={num} onChange={(e) => setNum(e.target.value)} required aria-label="Order number" />
        <input className="field" placeholder="Mobile number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required aria-label="Mobile number" />
        <button className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : <Package size={18} />} Track
        </button>
      </form>
      {err && <p className="mt-4 text-danger">{err}</p>}
      {order && (
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-1 font-serif text-2xl">{order.number}</h2>
            <p className="mb-6 text-[14px] text-muted">Placed {dateIN(order.createdAt)}</p>
            <Timeline order={order} />
          </div>
          <OrderSummary order={order} />
        </div>
      )}
    </div>
  );
}
