import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, FileDown, MapPin, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { Framed, Sheet, Spinner } from '@/components/ui';
import { currentToken, del, get, patch, post, put } from '@/lib/api';
import { dateIN, inr, occasionLabel, statusLabel, waLink } from '@/lib/format';
import { useBoot, useUI } from '@/store';
import { AdjustDialog, Box, Field, PageHead, RichEditor, Toggle, UploadButton } from './kit';

/* ================================================================ orders */
type OrderRow = { id: string; number: string; createdAt: string; name: string; city: string; phone: string; total: number; status: string; paymentMethod: string; items: number };
const STATUSES = ['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'PENDING_PAYMENT'];
const NEXT: Record<string, string[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PLACED: ['PACKED', 'SHIPPED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};
const pill = (s: string) =>
  `rounded-full px-2.5 py-1 text-[12px] ${s === 'DELIVERED' ? 'bg-sage/20' : s === 'CANCELLED' || s === 'RETURNED' ? 'bg-danger/10 text-danger' : s === 'PENDING_PAYMENT' ? 'bg-line text-muted' : 'bg-gold/20'}`;

function OrdersList() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ items: OrderRow[]; total: number; pages: number } | null>(null);
  const status = params.get('status') ?? 'ALL';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  useEffect(() => {
    const t = setTimeout(() => {
      get<{ items: OrderRow[]; total: number; pages: number }>(`/admin/orders?status=${status}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(setData);
    }, 200);
    return () => clearTimeout(t);
  }, [status, q, page]);
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k !== 'page') p.delete('page');
    setParams(p, { replace: true });
  };
  return (
    <div>
      <PageHead title="Orders" sub={data ? `${data.total} orders` : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="Order no., phone, name, email" value={q} onChange={(e) => set('q', e.target.value || null)} />
        {['ALL', ...STATUSES].map((s) => (
          <button key={s} className="chip" aria-pressed={status === s} onClick={() => set('status', s === 'ALL' ? null : s)}>
            {s === 'ALL' ? 'All' : statusLabel[s]}
          </button>
        ))}
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="p-3 font-normal">Order</th>
                <th className="p-3 font-normal">Customer</th>
                <th className="p-3 font-normal">Payment</th>
                <th className="p-3 font-normal">Total</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((o) => (
                <tr key={o.id} className="hover:bg-blush/40">
                  <td className="p-3">
                    <Link to={`/admin/orders/${o.id}`} className="font-medium hover:text-maroon">
                      {o.number}
                    </Link>
                    <p className="text-muted">{dateIN(o.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                  </td>
                  <td className="p-3">
                    {o.name}
                    <p className="text-muted">
                      {o.city} · {o.phone}
                    </p>
                  </td>
                  <td className="p-3">{o.paymentMethod === 'COD' ? 'COD' : 'Online'}</td>
                  <td className="p-3">{inr(o.total)}</td>
                  <td className="p-3">
                    <span className={pill(o.status)}>{statusLabel[o.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.pages > 1 && (
            <div className="flex justify-center gap-2 p-3">
              {Array.from({ length: data.pages }, (_, i) => (
                <button key={i} className="chip" aria-pressed={page === i + 1} onClick={() => set('page', String(i + 1))}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type OrderFull = {
  id: string;
  number: string;
  status: string;
  paymentMethod: string;
  email: string;
  phone: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  total: number;
  couponCode: string | null;
  giftMessage: string | null;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipLandmark: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  lat: number | null;
  lng: number | null;
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
  notes: string | null;
  mapsUrl: string;
  items: { id: string; name: string; colourName: string; qty: number; unitPrice: number; servicesFee: number; image: string | null; options: { fallPico?: boolean; stitching?: Record<string, number | string> } | null }[];
  events: { id: string; status: string; note: string | null; createdAt: string }[];
  payments: { id: string; method: string; status: string; amount: number; refundedAmount: number; razorpayPaymentId: string | null }[];
};

async function openPdf(id: string, kind: 'invoice' | 'packing') {
  const token = await currentToken();
  const r = await fetch(`/api/admin/orders/${id}/${kind}.pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const blob = await r.blob();
  window.open(URL.createObjectURL(blob), '_blank');
}

function OrderDetail() {
  const { id = '' } = useParams();
  const [o, setO] = useState<OrderFull | null>(null);
  const [ship, setShip] = useState({ courier: '', awb: '', trackingUrl: '', notes: '' });
  const [refund, setRefund] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useUI((s) => s.toast);
  const load = () =>
    get<{ order: OrderFull }>(`/admin/orders/${id}`).then((r) => {
      setO(r.order);
      setShip({ courier: r.order.courier ?? '', awb: r.order.awb ?? '', trackingUrl: r.order.trackingUrl ?? '', notes: r.order.notes ?? '' });
    });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!o) return <Spinner />;
  const paid = o.payments.find((p) => p.method === 'RAZORPAY' && p.razorpayPaymentId);
  const move = async (status: string) => {
    if ((status === 'CANCELLED' || status === 'RETURNED') && !confirm(`Mark ${o.number} as ${statusLabel[status].toLowerCase()}? Stock will be returned.`)) return;
    setBusy(true);
    try {
      await post(`/admin/orders/${id}/status`, { status });
      toast(`Marked ${statusLabel[status].toLowerCase()}`);
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHead
        title={o.number}
        sub={`${dateIN(o.createdAt, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} · ${o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'}`}
        actions={
          <>
            <button className="btn-ghost min-h-[42px] px-5" onClick={() => openPdf(o.id, 'invoice')}>
              <FileDown size={16} /> Invoice
            </button>
            <button className="btn-ghost min-h-[42px] px-5" onClick={() => openPdf(o.id, 'packing')}>
              <FileDown size={16} /> Packing slip
            </button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Box title="Status">
            <p className="mb-4">
              <span className={pill(o.status)}>{statusLabel[o.status]}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {NEXT[o.status].map((s) => (
                <button key={s} disabled={busy} className={s === 'CANCELLED' || s === 'RETURNED' ? 'btn-ghost min-h-[42px] px-5' : 'btn-primary min-h-[42px] px-5'} onClick={() => move(s)}>
                  Mark {statusLabel[s].toLowerCase()}
                </button>
              ))}
            </div>
            <ol className="mt-6 space-y-2 border-l border-line pl-4 text-[14px]">
              {o.events.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{statusLabel[e.status]}</span> <span className="text-muted">· {dateIN(e.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  {e.note && <p className="text-muted">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Box>
          <Box title="Items">
            <ul className="divide-y divide-line">
              {o.items.map((it) => (
                <li key={it.id} className="flex gap-4 py-3 text-[14px]">
                  <div className="w-14 shrink-0">
                    <Framed url={it.image} alt="" sizes="56px" className="rounded-lg" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{it.name}</p>
                    <p className="text-muted">
                      {it.colourName} × {it.qty}
                    </p>
                    {it.options?.fallPico && <p className="text-maroon">+ Fall &amp; pico</p>}
                    {it.options?.stitching && (
                      <div className="mt-1 rounded-lg bg-blush p-2 text-[13px]">
                        <p className="font-medium">Stitched blouse — measurements (in)</p>
                        <p>
                          {Object.entries(it.options.stitching)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      </div>
                    )}
                  </div>
                  <p>{inr((it.unitPrice + it.servicesFee) * it.qty)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{inr(o.subtotal)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount {o.couponCode && `(${o.couponCode})`}</dt><dd>−{inr(o.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{o.shipping ? inr(o.shipping) : 'Free'}</dd></div>
              {o.codFee > 0 && <div className="flex justify-between"><dt className="text-muted">COD fee</dt><dd>{inr(o.codFee)}</dd></div>}
              {o.giftWrap > 0 && <div className="flex justify-between"><dt className="text-muted">Gift wrap</dt><dd>{inr(o.giftWrap)}</dd></div>}
              <div className="flex justify-between text-[16px] font-medium"><dt>Total</dt><dd>{inr(o.total)}</dd></div>
            </dl>
            {o.giftMessage && <p className="mt-4 rounded-lg bg-blush p-3 font-serif text-lg italic">Gift note: “{o.giftMessage}”</p>}
          </Box>
          <Box title="Shipping & notes">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Courier">
                <input className="field" value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} placeholder="Delhivery, DTDC…" />
              </Field>
              <Field label="AWB number">
                <input className="field" value={ship.awb} onChange={(e) => setShip({ ...ship, awb: e.target.value })} />
              </Field>
              <Field label="Tracking link">
                <input className="field" value={ship.trackingUrl} onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} placeholder="https://" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Internal notes (never shown to customers)">
                <textarea className="field" rows={3} value={ship.notes} onChange={(e) => setShip({ ...ship, notes: e.target.value })} />
              </Field>
            </div>
            <button
              className="btn-primary mt-4 min-h-[42px] px-5"
              onClick={async () => {
                try {
                  await patch(`/admin/orders/${id}`, ship);
                  toast('Saved');
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              Save
            </button>
          </Box>
        </div>
        <div className="space-y-6">
          <Box title="Customer">
            <p className="font-medium">{o.shipName}</p>
            <p className="text-[14px]">
              <a href={`tel:${o.phone}`} className="hover:text-maroon">
                {o.phone}
              </a>
              <br />
              <a href={`mailto:${o.email}`} className="hover:text-maroon">
                {o.email}
              </a>
            </p>
            <a className="chip mt-3" href={waLink(`91${o.phone}`, `Hello ${o.shipName.split(' ')[0]}, this is Tarun Silks about your order ${o.number}.`)} target="_blank" rel="noreferrer">
              WhatsApp customer
            </a>
          </Box>
          <Box title="Ship to">
            <p className="text-[14px]">
              {o.shipLine1}
              {o.shipLine2 && (
                <>
                  <br />
                  {o.shipLine2}
                </>
              )}
              {o.shipLandmark && (
                <>
                  <br />
                  Near {o.shipLandmark}
                </>
              )}
              <br />
              {o.shipCity}, {o.shipState} {o.shipPincode}
            </p>
            <a className="chip mt-3" href={o.mapsUrl} target="_blank" rel="noreferrer">
              <MapPin size={15} /> {o.lat ? 'Open exact location in Google Maps' : 'Find address in Google Maps'}
            </a>
          </Box>
          <Box title="Payment">
            {o.payments.map((p) => (
              <p key={p.id} className="text-[14px]">
                {p.method === 'COD' ? 'Cash on delivery' : 'Razorpay'} · {p.status.replace('_', ' ').toLowerCase()} · {inr(p.amount)}
                {p.refundedAmount > 0 && <span className="text-danger"> · refunded {inr(p.refundedAmount)}</span>}
                {p.razorpayPaymentId && <span className="block text-muted">{p.razorpayPaymentId}</span>}
              </p>
            ))}
            {paid && paid.refundedAmount < paid.amount && (
              <form
                className="mt-4 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!confirm(`Refund ${refund ? `₹${refund}` : 'the full remaining amount'} to the customer via Razorpay?`)) return;
                  try {
                    await post(`/admin/orders/${id}/refund`, refund ? { amount: Number(refund) } : {});
                    toast('Refund started — Razorpay will credit it in 5–7 days');
                    setRefund('');
                    await load();
                  } catch (err) {
                    toast((err as Error).message, 'error');
                  }
                }}
              >
                <input className="field" inputMode="decimal" placeholder="Amount ₹ (blank = full)" value={refund} onChange={(e) => setRefund(e.target.value)} />
                <button className="btn-ghost min-h-[48px] px-4">Refund</button>
              </form>
            )}
          </Box>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ customers */
function Customers() {
  const [rows, setRows] = useState<{ id: string; name: string | null; email: string | null; phone: string | null; orders: number; spent: number; createdAt: string; role: string }[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => get<{ items: NonNullable<typeof rows> }>(`/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => setRows(r.items)), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <PageHead title="Customers" sub="Signed-in customers. Guest buyers appear in Orders." />
      <input className="field mb-4 max-w-xs" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      {!rows ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-[14px]">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="p-3 font-normal">Name</th>
                <th className="p-3 font-normal">Contact</th>
                <th className="p-3 font-normal">Orders</th>
                <th className="p-3 font-normal">Spent</th>
                <th className="p-3 font-normal">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="p-3">
                    {c.name ?? '—'} {c.role === 'ADMIN' && <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px]">Admin</span>}
                  </td>
                  <td className="p-3">
                    {c.email}
                    <p className="text-muted">{c.phone}</p>
                  </td>
                  <td className="p-3">{c.orders}</td>
                  <td className="p-3">{inr(c.spent)}</td>
                  <td className="p-3">{dateIN(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================ discounts */
type Coupon = { id?: string; code: string; type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING'; value: number; minCart: number; maxDiscount: number | null; usageLimit: number | null; perUser: number | null; usedCount?: number; expiresAt: string | null; isActive: boolean };
function Discounts() {
  const [rows, setRows] = useState<Coupon[] | null>(null);
  const [edit, setEdit] = useState<Coupon | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useUI((s) => s.toast);
  const load = () => get<{ items: Coupon[] }>('/admin/coupons').then((r) => setRows(r.items));
  useEffect(() => {
    void load();
  }, []);
  const toUi = (c: Coupon): Coupon => ({ ...c, value: c.type === 'FLAT' ? c.value / 100 : c.value, minCart: c.minCart / 100, maxDiscount: c.maxDiscount ? c.maxDiscount / 100 : null, expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : null });
  return (
    <div>
      <PageHead
        title="Discounts"
        actions={
          <button className="btn-primary min-h-[42px] px-5" onClick={() => setEdit({ code: '', type: 'PERCENT', value: 10, minCart: 0, maxDiscount: null, usageLimit: null, perUser: 1, expiresAt: null, isActive: true })}>
            <Plus size={16} /> New code
          </button>
        }
      />
      {!rows ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <button key={c.id} className="card p-5 text-left hover:border-ink" onClick={() => setEdit(toUi(c))}>
              <p className="font-mono text-lg">{c.code}</p>
              <p className="text-[14px]">{c.type === 'PERCENT' ? `${c.value}% off` : c.type === 'FLAT' ? `${inr(c.value)} off` : 'Free shipping'}{c.minCart ? ` above ${inr(c.minCart)}` : ''}</p>
              <p className="mt-1 text-[13px] text-muted">
                Used {c.usedCount}
                {c.usageLimit ? `/${c.usageLimit}` : ''} · {c.isActive ? 'active' : 'off'}
                {c.expiresAt ? ` · ends ${dateIN(c.expiresAt)}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit code' : 'New code'}>
        {edit && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              const body = { ...edit, expiresAt: edit.expiresAt ? new Date(`${edit.expiresAt}T23:59:59+05:30`).toISOString() : null };
              try {
                if (edit.id) await put(`/admin/coupons/${edit.id}`, body);
                else await post('/admin/coupons', body);
                toast('Saved');
                setEdit(null);
                void load();
              } catch (e2) {
                setErr((e2 as Error).message);
              }
            }}
          >
            <Field label="Code">
              <input className="field uppercase" required value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
            </Field>
            <Field label="Type">
              <select className="field" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Coupon['type'] })}>
                <option value="PERCENT">Percent off</option>
                <option value="FLAT">Flat ₹ off</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </select>
            </Field>
            {edit.type !== 'FREE_SHIPPING' && (
              <Field label={edit.type === 'PERCENT' ? 'Percent' : 'Amount (₹)'}>
                <input className="field" type="number" min={0} value={edit.value} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum bag (₹)">
                <input className="field" type="number" min={0} value={edit.minCart} onChange={(e) => setEdit({ ...edit, minCart: Number(e.target.value) })} />
              </Field>
              {edit.type === 'PERCENT' && (
                <Field label="Max discount (₹)">
                  <input className="field" type="number" min={0} value={edit.maxDiscount ?? ''} onChange={(e) => setEdit({ ...edit, maxDiscount: e.target.value ? Number(e.target.value) : null })} />
                </Field>
              )}
              <Field label="Total uses">
                <input className="field" type="number" min={1} placeholder="Unlimited" value={edit.usageLimit ?? ''} onChange={(e) => setEdit({ ...edit, usageLimit: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Uses per customer">
                <input className="field" type="number" min={1} placeholder="Unlimited" value={edit.perUser ?? ''} onChange={(e) => setEdit({ ...edit, perUser: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            </div>
            <Field label="Expires on">
              <input className="field" type="date" value={edit.expiresAt ?? ''} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value || null })} />
            </Field>
            <Toggle label="Active" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
            {err && <p className="text-[14px] text-danger">{err}</p>}
            <div className="flex gap-2">
              <button className="btn-primary flex-1">Save</button>
              {edit.id && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    if (!confirm('Delete this code?')) return;
                    await del(`/admin/coupons/${edit.id}`);
                    setEdit(null);
                    void load();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}

/* ================================================================ reviews */
function Reviews() {
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [rows, setRows] = useState<{ id: string; rating: number; title: string | null; body: string; createdAt: string; product: { name: string; slug: string }; user: { name: string | null; email: string | null } }[] | null>(null);
  const load = () => get<{ items: NonNullable<typeof rows> }>(`/admin/reviews?status=${status}`).then((r) => setRows(r.items));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  return (
    <div>
      <PageHead title="Reviews" sub="Only customers whose order was delivered can review." />
      <div className="mb-4 flex gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <button key={s} className="chip capitalize" aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s.toLowerCase()}
          </button>
        ))}
      </div>
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="text-muted">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-5">
              <p className="text-[13px] text-muted">
                {r.product.name} · {r.user.name ?? r.user.email} · {dateIN(r.createdAt)}
              </p>
              <p className="mt-1">
                {'★'.repeat(r.rating)}
                <span className="text-line">{'★'.repeat(5 - r.rating)}</span> {r.title && <strong>{r.title}</strong>}
              </p>
              <p className="mt-1 text-[15px]">{r.body}</p>
              <div className="mt-3 flex gap-2">
                {status !== 'APPROVED' && (
                  <button className="btn-primary min-h-[38px] px-4" onClick={async () => { await patch(`/admin/reviews/${r.id}`, { status: 'APPROVED' }); void load(); }}>
                    Approve
                  </button>
                )}
                {status !== 'REJECTED' && (
                  <button className="btn-ghost min-h-[38px] px-4" onClick={async () => { await patch(`/admin/reviews/${r.id}`, { status: 'REJECTED' }); void load(); }}>
                    Reject
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================================================================ collections + categories */
type Coll = { id?: string; title: string; handle: string; description: string | null; image: string | null; accent: string | null; isRuleBased: boolean; rules: { fabric?: string[]; occasion?: string[]; minPrice?: number; maxPrice?: number } | null; showInNav: boolean; isEditorial: boolean; sortOrder: number; productIds?: string[]; _count?: { products: number } };

function Collections() {
  const [rows, setRows] = useState<Coll[] | null>(null);
  const [edit, setEdit] = useState<Coll | null>(null);
  const [adjust, setAdjust] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const toast = useUI((s) => s.toast);
  const reloadBoot = useBoot((b) => b.load);
  const load = () => get<{ items: Coll[] }>('/admin/collections').then((r) => setRows(r.items));
  useEffect(() => {
    void load();
    get<{ items: { id: string; name: string }[] }>('/admin/products').then((r) => setProducts(r.items));
  }, []);
  const save = async () => {
    if (!edit) return;
    const body = { ...edit, rules: edit.isRuleBased ? edit.rules : null };
    try {
      if (edit.id) await put(`/admin/collections/${edit.id}`, body);
      else await post('/admin/collections', body);
      toast('Collection saved');
      setEdit(null);
      void load();
      void reloadBoot();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const move = async (i: number, d: number) => {
    if (!rows) return;
    const a = rows[i];
    const b = rows[i + d];
    if (!b) return;
    await Promise.all([put(`/admin/collections/${a.id}`, { ...a, sortOrder: b.sortOrder }), put(`/admin/collections/${b.id}`, { ...b, sortOrder: a.sortOrder })]);
    void load();
  };
  const csv = (v?: string[]) => (v ?? []).join(', ');
  const parseCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  return (
    <div>
      <PageHead
        title="Collections"
        sub="Rule-based collections fill themselves (by fabric, occasion or price). Editorial ones get an art-directed look-book page."
        actions={
          <button className="btn-primary min-h-[42px] px-5" onClick={() => setEdit({ title: '', handle: '', description: '', image: null, accent: '#6B1F2A', isRuleBased: true, rules: { fabric: [] }, showInNav: true, isEditorial: false, sortOrder: (rows?.length ?? 0) + 1, productIds: [] })}>
            <Plus size={16} /> New collection
          </button>
        }
      />
      {!rows ? (
        <Spinner />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c, i) => (
            <li key={c.id} className="card flex gap-3 p-3">
              <button className="w-20 shrink-0" onClick={() => setEdit(c)}>
                <Framed url={c.image} alt="" sizes="80px" className="rounded-lg" />
              </button>
              <div className="min-w-0 flex-1">
                <button className="block text-left font-serif text-xl hover:text-maroon" onClick={() => setEdit(c)}>
                  {c.title}
                </button>
                <p className="text-[13px] text-muted">
                  {c.isRuleBased ? 'Automatic' : `${c._count?.products ?? 0} sarees`} {c.isEditorial && '· editorial'} {!c.showInNav && '· hidden from menu'}
                </p>
                <div className="mt-2 flex gap-1">
                  <button className="rounded-lg p-1.5 hover:bg-blush" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                  <button className="rounded-lg p-1.5 hover:bg-blush" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
                  <a className="rounded-lg p-1.5 hover:bg-blush" href={c.isEditorial ? `/edits/${c.handle}` : `/collections/${c.handle}`} target="_blank" rel="noreferrer" aria-label="Open"><ExternalLink size={14} /></a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit collection' : 'New collection'} wide footer={<button className="btn-primary w-full" onClick={save}>Save collection</button>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Title">
              <input className="field" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="URL handle" hint="Leave empty to create from the title">
              <input className="field" value={edit.handle} onChange={(e) => setEdit({ ...edit, handle: e.target.value })} />
            </Field>
            <div>
              <span className="label">Cover image</span>
              <div className="flex items-end gap-3">
                <div className="w-28">
                  <Framed url={edit.image} alt="" sizes="112px" className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <UploadButton multiple={false} keepOriginal label="Upload cover" onDone={(f) => setEdit({ ...edit, image: `${f[0].url}#lx=50,50,1` })} />
                  {edit.image && (
                    <button type="button" className="chip" onClick={() => setAdjust(true)}>
                      Adjust framing
                    </button>
                  )}
                </div>
              </div>
            </div>
            <Field label="Accent colour (editorial pages)">
              <input type="color" className="h-11 w-20 rounded-lg border border-line" value={edit.accent ?? '#6B1F2A'} onChange={(e) => setEdit({ ...edit, accent: e.target.value })} />
            </Field>
            <div>
              <span className="label">Description</span>
              <RichEditor value={edit.description ?? ''} onChange={(v) => setEdit({ ...edit, description: v })} minH={80} />
            </div>
            <Toggle label="Show in menu" checked={edit.showInNav} onChange={(v) => setEdit({ ...edit, showInNav: v })} />
            <Toggle label="Editorial look-book page" checked={edit.isEditorial} onChange={(v) => setEdit({ ...edit, isEditorial: v })} />
            <Toggle label="Fill automatically by rules" checked={edit.isRuleBased} onChange={(v) => setEdit({ ...edit, isRuleBased: v, rules: v ? (edit.rules ?? {}) : null })} />
            {edit.isRuleBased ? (
              <div className="space-y-3 rounded-xl bg-blush p-4">
                <Field label="Fabrics (comma separated)">
                  <input className="field" defaultValue={csv(edit.rules?.fabric)} onBlur={(e) => setEdit({ ...edit, rules: { ...edit.rules, fabric: parseCsv(e.target.value) } })} placeholder="Kanjivaram, Banarasi" />
                </Field>
                <div>
                  <span className="label">Occasions</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(occasionLabel).map(([v, l]) => (
                      <button key={v} type="button" className="chip" aria-pressed={edit.rules?.occasion?.includes(v) ?? false} onClick={() => { const cur = edit.rules?.occasion ?? []; setEdit({ ...edit, rules: { ...edit.rules, occasion: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } }); }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Min price (₹)">
                    <input className="field" type="number" defaultValue={edit.rules?.minPrice ? edit.rules.minPrice / 100 : ''} onBlur={(e) => setEdit({ ...edit, rules: { ...edit.rules, minPrice: e.target.value ? Number(e.target.value) * 100 : undefined } })} />
                  </Field>
                  <Field label="Max price (₹)">
                    <input className="field" type="number" defaultValue={edit.rules?.maxPrice ? edit.rules.maxPrice / 100 : ''} onBlur={(e) => setEdit({ ...edit, rules: { ...edit.rules, maxPrice: e.target.value ? Number(e.target.value) * 100 : undefined } })} />
                  </Field>
                </div>
              </div>
            ) : (
              <div>
                <span className="label">Sarees in this collection</span>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] hover:bg-blush">
                      <input type="checkbox" checked={edit.productIds?.includes(p.id) ?? false} onChange={(e) => setEdit({ ...edit, productIds: e.target.checked ? [...(edit.productIds ?? []), p.id] : (edit.productIds ?? []).filter((x) => x !== p.id) })} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {edit.id && (
              <button
                type="button"
                className="text-[14px] text-danger"
                onClick={async () => {
                  if (!confirm('Delete this collection? Sarees are not deleted.')) return;
                  await del(`/admin/collections/${edit.id}`);
                  setEdit(null);
                  void load();
                }}
              >
                Delete collection
              </button>
            )}
          </div>
        )}
      </Sheet>
      {adjust && edit?.image && (
        <AdjustDialog
          url={edit.image}
          onClose={() => setAdjust(false)}
          onSave={(url) => {
            setEdit({ ...edit, image: url });
            setAdjust(false);
          }}
        />
      )}
    </div>
  );
}

function Categories() {
  const [rows, setRows] = useState<{ id: string; name: string; slug: string; kind: string; sortOrder: number; showInNav: boolean }[] | null>(null);
  const [name, setName] = useState('');
  const load = () => get<{ items: NonNullable<typeof rows> }>('/admin/categories').then((r) => setRows(r.items));
  useEffect(() => {
    void load();
  }, []);
  return (
    <div>
      <PageHead title="Categories" sub="Fabric families used for filters and breadcrumbs." />
      <form
        className="mb-4 flex max-w-md gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await post('/admin/categories', { name, kind: 'fabric', sortOrder: rows?.length ?? 0, showInNav: true });
          setName('');
          void load();
        }}
      >
        <input className="field" placeholder="New category, e.g. Mysore Silk" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary min-h-[48px] px-5">Add</button>
      </form>
      {!rows ? (
        <Spinner />
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-[14px]">
              <span>
                {c.name} <span className="text-muted">/{c.slug}</span>
              </span>
              <span className="flex gap-1">
                <button className="rounded-lg p-2 hover:bg-blush" aria-label={c.showInNav ? 'Hide from menu' : 'Show in menu'} onClick={async () => { await put(`/admin/categories/${c.id}`, { ...c, showInNav: !c.showInNav }); void load(); }}>
                  {c.showInNav ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button className="rounded-lg p-2 text-danger hover:bg-blush" aria-label="Delete" onClick={async () => { if (confirm(`Delete ${c.name}?`)) { await del(`/admin/categories/${c.id}`); void load(); } }}>
                  <Trash2 size={15} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================================================================ homepage sections */
type Section = { id: string; type: string; title: string | null; data: Record<string, unknown>; isVisible: boolean; sortOrder: number };
const SECTION_LABEL: Record<string, string> = {
  hero: 'Hero (silk scene, headline, buttons, video)',
  marquee: 'Scrolling fabric names',
  story: 'Loom → weaver → drape story',
  collections: 'Horizontal fabric gallery',
  new: 'New arrivals',
  bestsellers: 'Bestsellers',
  pallu: 'Pallu feature',
  colours: 'Shop by colour',
  edits: 'Editorial edits',
  craft: 'Craft & authenticity',
  testimonials: 'Testimonials',
  instagram: 'Instagram strip',
  newsletter: 'Newsletter',
};

function Homepage() {
  const [rows, setRows] = useState<Section[] | null>(null);
  const [edit, setEdit] = useState<Section | null>(null);
  const [json, setJson] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const toast = useUI((s) => s.toast);
  const reloadBoot = useBoot((b) => b.load);
  const load = () => get<{ items: Section[] }>('/admin/home').then((r) => setRows(r.items));
  useEffect(() => {
    void load();
  }, []);
  const reorder = async (i: number, d: number) => {
    if (!rows || !rows[i + d]) return;
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRows(next);
    await post('/admin/home/reorder', { ids: next.map((r) => r.id) });
    void reloadBoot();
  };
  const hero = edit?.type === 'hero';
  const hd = (edit?.data ?? {}) as Record<string, string>;
  const setHd = (k: string, v: string) => edit && setEdit({ ...edit, data: { ...edit.data, [k]: v } });
  return (
    <div>
      <PageHead title="Homepage" sub="Reorder, hide or edit each block. Changes are live within seconds." />
      {!rows ? (
        <Spinner />
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 p-3">
              <span className="flex flex-col">
                <button className="rounded p-1 hover:bg-blush" onClick={() => reorder(i, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                <button className="rounded p-1 hover:bg-blush" onClick={() => reorder(i, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
              </span>
              <button className="min-w-0 flex-1 text-left" onClick={() => { setEdit(s); setJson(JSON.stringify(s.data, null, 2)); setErr(null); }}>
                <p className="font-medium">{s.title || SECTION_LABEL[s.type] || s.type}</p>
                <p className="text-[13px] text-muted">{SECTION_LABEL[s.type] ?? s.type}</p>
              </button>
              <button
                className={`rounded-full px-3 py-1 text-[12px] ${s.isVisible ? 'bg-sage/20' : 'bg-line'}`}
                onClick={async () => {
                  await put(`/admin/home/${s.id}`, { ...s, isVisible: !s.isVisible });
                  void load();
                  void reloadBoot();
                }}
              >
                {s.isVisible ? 'Visible' : 'Hidden'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? SECTION_LABEL[edit.type] ?? edit.type : ''}
        wide
        footer={
          <button
            className="btn-primary w-full"
            onClick={async () => {
              if (!edit) return;
              let data = edit.data;
              if (!hero) {
                try {
                  data = JSON.parse(json);
                } catch {
                  return setErr('The content is not valid — check commas and quotes.');
                }
              }
              await put(`/admin/home/${edit.id}`, { ...edit, data });
              toast('Section saved');
              setEdit(null);
              void load();
              void reloadBoot();
            }}
          >
            Save section
          </button>
        }
      >
        {edit && (
          <div className="space-y-4">
            <Field label="Heading">
              <input className="field" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            {hero ? (
              <>
                <Field label="Small line above the headline">
                  <input className="field" value={hd.eyebrow ?? ''} onChange={(e) => setHd('eyebrow', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Headline line 1">
                    <input className="field" value={hd.line1 ?? ''} onChange={(e) => setHd('line1', e.target.value)} />
                  </Field>
                  <Field label="Headline line 2 (italic gold)">
                    <input className="field" value={hd.line2 ?? ''} onChange={(e) => setHd('line2', e.target.value)} />
                  </Field>
                  <Field label="Button text">
                    <input className="field" value={hd.cta ?? ''} onChange={(e) => setHd('cta', e.target.value)} />
                  </Field>
                  <Field label="Button link">
                    <input className="field" value={hd.ctaLink ?? ''} onChange={(e) => setHd('ctaLink', e.target.value)} />
                  </Field>
                  <Field label="Second link text">
                    <input className="field" value={hd.secondary ?? ''} onChange={(e) => setHd('secondary', e.target.value)} />
                  </Field>
                  <Field label="Second link">
                    <input className="field" value={hd.secondaryLink ?? ''} onChange={(e) => setHd('secondaryLink', e.target.value)} />
                  </Field>
                </div>
                <Field label="Fallback video URL (MP4)" hint="Plays on phones that skip the 3D silk. Upload to /uploads or paste a link. Leave empty to use the poster image.">
                  <input className="field" value={hd.video ?? ''} onChange={(e) => setHd('video', e.target.value)} placeholder="https://…/hero.mp4" />
                </Field>
                <div>
                  <span className="label">Poster image</span>
                  <UploadButton multiple={false} keepOriginal label="Upload poster" onDone={(f) => setHd('poster', f[0].url.replace('main.webp', 'main.jpg'))} />
                  {hd.poster && <p className="mt-1 text-[12px] text-muted">{hd.poster}</p>}
                </div>
              </>
            ) : (
              <Field label="Content" hint="Text, links and lists for this block. Keep the quotes and commas as they are.">
                <textarea className="field font-mono text-[13px]" rows={16} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
              </Field>
            )}
            {err && <p className="text-[14px] text-danger">{err}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ================================================================ announcement + settings */
type Settings = {
  store: Record<string, string | boolean>;
  shipping: { freeShippingAbove: number; defaultRate: number; defaultDays: number; giftWrapPrice: number; gstPercent: number; zones: { name: string; prefixes: string[]; rate: number; days: number }[] };
  cod: { enabled: boolean; fee: number; maxOrder: number; blockedPrefixes: string[] };
};

function useSettings() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    get<Settings>('/admin/settings').then(setS);
  }, []);
  return [s, setS] as const;
}

function Announcement() {
  const [s, setS] = useSettings();
  const toast = useUI((t) => t.toast);
  const reloadBoot = useBoot((b) => b.load);
  if (!s) return <Spinner />;
  return (
    <div className="max-w-2xl">
      <PageHead title="Announcement bar" />
      <Box>
        <Field label="Text">
          <input className="field" value={String(s.store.announcement)} onChange={(e) => setS({ ...s, store: { ...s.store, announcement: e.target.value } })} />
        </Field>
        <div className="mt-3">
          <Toggle label="Show on the site" checked={!!s.store.announcementVisible} onChange={(v) => setS({ ...s, store: { ...s.store, announcementVisible: v } })} />
        </div>
        <button className="btn-primary mt-4 min-h-[42px] px-5" onClick={async () => { await put('/admin/settings/store', s.store); toast('Announcement updated'); void reloadBoot(); }}>
          Save
        </button>
      </Box>
    </div>
  );
}

function SettingsPage() {
  const [s, setS] = useSettings();
  const toast = useUI((t) => t.toast);
  const reloadBoot = useBoot((b) => b.load);
  if (!s) return <Spinner />;
  const st = s.store;
  const setStore = (k: string, v: string) => setS({ ...s, store: { ...st, [k]: v } });
  const rs = (p: number) => p / 100;
  const ps = (r: string) => Math.round(Number(r || 0) * 100);
  const saveAll = async () => {
    try {
      await put('/admin/settings/store', s.store);
      await put('/admin/settings/shipping', s.shipping);
      await put('/admin/settings/cod', s.cod);
      toast('Settings saved');
      void reloadBoot();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const field = (k: string, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className="field" value={String(st[k] ?? '')} onChange={(e) => setStore(k, e.target.value)} />
    </Field>
  );
  return (
    <div className="pb-20">
      <PageHead title="Settings" actions={<button className="btn-primary min-h-[42px] px-6" onClick={saveAll}>Save all</button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Box title="Store">
          <div className="grid gap-3 sm:grid-cols-2">
            {field('storeName', 'Store name')}
            {field('tagline', 'Tagline')}
            {field('email', 'Email')}
            {field('phone', 'Phone')}
            {field('whatsapp', 'WhatsApp number', 'With country code, digits only: 919876543210')}
            {field('instagram', 'Instagram handle')}
            {field('gstin', 'GSTIN')}
            {field('logoUrl', 'Logo image URL', 'Upload below, then it replaces the text logo')}
          </div>
          <div className="mt-3">{field('address', 'Store address')}</div>
          <div className="mt-3">{field('mapUrl', 'Google Maps link for the store')}</div>
          <div className="mt-3">
            <UploadButton multiple={false} keepOriginal label="Upload logo" onDone={(f) => setStore('logoUrl', f[0].url.replace('main.webp', 'main.webp'))} />
          </div>
        </Box>
        <Box title="Shipping">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Free shipping above (₹)">
              <input className="field" type="number" value={rs(s.shipping.freeShippingAbove)} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, freeShippingAbove: ps(e.target.value) } })} />
            </Field>
            <Field label="Default rate (₹)">
              <input className="field" type="number" value={rs(s.shipping.defaultRate)} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, defaultRate: ps(e.target.value) } })} />
            </Field>
            <Field label="Default delivery days">
              <input className="field" type="number" value={s.shipping.defaultDays} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, defaultDays: Number(e.target.value) } })} />
            </Field>
            <Field label="Gift wrap (₹)">
              <input className="field" type="number" value={rs(s.shipping.giftWrapPrice)} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, giftWrapPrice: ps(e.target.value) } })} />
            </Field>
            <Field label="GST % (shown on invoices)">
              <input className="field" type="number" value={s.shipping.gstPercent} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, gstPercent: Number(e.target.value) } })} />
            </Field>
          </div>
          <h3 className="mb-2 mt-5 font-medium">Zones by pincode prefix</h3>
          <div className="space-y-2">
            {s.shipping.zones.map((z, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_70px_60px_auto] items-center gap-2">
                <input className="field py-2" value={z.name} onChange={(e) => { const zones = [...s.shipping.zones]; zones[i] = { ...z, name: e.target.value }; setS({ ...s, shipping: { ...s.shipping, zones } }); }} aria-label="Zone name" />
                <input className="field py-2" value={z.prefixes.join(',')} onChange={(e) => { const zones = [...s.shipping.zones]; zones[i] = { ...z, prefixes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }; setS({ ...s, shipping: { ...s.shipping, zones } }); }} aria-label="Pincode prefixes" />
                <input className="field py-2" type="number" value={rs(z.rate)} onChange={(e) => { const zones = [...s.shipping.zones]; zones[i] = { ...z, rate: ps(e.target.value) }; setS({ ...s, shipping: { ...s.shipping, zones } }); }} aria-label="Rate ₹" />
                <input className="field py-2" type="number" value={z.days} onChange={(e) => { const zones = [...s.shipping.zones]; zones[i] = { ...z, days: Number(e.target.value) }; setS({ ...s, shipping: { ...s.shipping, zones } }); }} aria-label="Days" />
                <button className="p-2 text-danger" onClick={() => setS({ ...s, shipping: { ...s.shipping, zones: s.shipping.zones.filter((_, j) => j !== i) } })} aria-label="Remove zone"><Trash2 size={15} /></button>
              </div>
            ))}
            <p className="text-[12px] text-muted">Name · pincode prefixes (comma separated) · rate ₹ · days</p>
            <button className="chip" onClick={() => setS({ ...s, shipping: { ...s.shipping, zones: [...s.shipping.zones, { name: 'New zone', prefixes: [], rate: 9900, days: 5 }] } })}>
              <Plus size={14} /> Add zone
            </button>
          </div>
        </Box>
        <Box title="Cash on delivery">
          <Toggle label="Offer COD" checked={s.cod.enabled} onChange={(v) => setS({ ...s, cod: { ...s.cod, enabled: v } })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="COD fee (₹)">
              <input className="field" type="number" value={rs(s.cod.fee)} onChange={(e) => setS({ ...s, cod: { ...s.cod, fee: ps(e.target.value) } })} />
            </Field>
            <Field label="Max COD order (₹)">
              <input className="field" type="number" value={rs(s.cod.maxOrder)} onChange={(e) => setS({ ...s, cod: { ...s.cod, maxOrder: ps(e.target.value) } })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="No COD for pincodes starting with" hint="Comma separated, e.g. 79, 19">
              <input className="field" value={s.cod.blockedPrefixes.join(', ')} onChange={(e) => setS({ ...s, cod: { ...s.cod, blockedPrefixes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } })} />
            </Field>
          </div>
        </Box>
        <Box title="Analytics & social">
          <div className="grid gap-3 sm:grid-cols-2">
            {field('gaId', 'Google Analytics 4 ID', 'G-XXXXXXX')}
            {field('metaPixelId', 'Meta Pixel ID')}
            {field('facebook', 'Facebook page URL')}
            {field('youtube', 'YouTube URL')}
          </div>
          <p className="mt-3 text-[13px] text-muted">Analytics load only after the visitor accepts the cookie notice.</p>
          <a className="chip mt-4" href="/api/admin/subscribers.csv" onClick={async (e) => { e.preventDefault(); const t = await currentToken(); const r = await fetch('/api/admin/subscribers.csv', { headers: t ? { Authorization: `Bearer ${t}` } : {} }); window.open(URL.createObjectURL(await r.blob())); }}>
            <FileDown size={15} /> Download newsletter subscribers
          </a>
        </Box>
      </div>
    </div>
  );
}

/* ================================================================ content pages */
function Pages() {
  const [rows, setRows] = useState<{ slug: string; title: string; body: string; seoTitle: string | null }[] | null>(null);
  const [edit, setEdit] = useState<{ slug: string; title: string; body: string; seoTitle: string | null; isNew?: boolean } | null>(null);
  const toast = useUI((s) => s.toast);
  const load = () => get<{ items: NonNullable<typeof rows> }>('/admin/pages').then((r) => setRows(r.items));
  useEffect(() => {
    void load();
  }, []);
  return (
    <div>
      <PageHead title="Pages" sub="About, policies, FAQ and other content." actions={<button className="btn-primary min-h-[42px] px-5" onClick={() => setEdit({ slug: '', title: '', body: '', seoTitle: null, isNew: true })}><Plus size={16} /> New page</button>} />
      {!rows ? (
        <Spinner />
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((p) => (
            <li key={p.slug} className="flex items-center justify-between p-3">
              <button className="text-left hover:text-maroon" onClick={() => setEdit(p)}>
                {p.title} <span className="text-[13px] text-muted">/pages/{p.slug}</span>
              </button>
              <a href={`/pages/${p.slug}`} target="_blank" rel="noreferrer" className="p-2" aria-label="Open"><ExternalLink size={15} /></a>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.isNew ? 'New page' : edit?.title ?? ''}
        wide
        footer={
          <button
            className="btn-primary w-full"
            onClick={async () => {
              if (!edit) return;
              const slug = edit.slug || edit.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              try {
                await put(`/admin/pages/${slug}`, { title: edit.title, body: edit.body, seoTitle: edit.seoTitle });
                toast('Page saved');
                setEdit(null);
                void load();
              } catch (e) {
                toast((e as Error).message, 'error');
              }
            }}
          >
            Save page
          </button>
        }
      >
        {edit && (
          <div className="space-y-4">
            <Field label="Title">
              <input className="field" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            {edit.isNew && (
              <Field label="URL" hint="e.g. size-guide">
                <input className="field" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
              </Field>
            )}
            <div>
              <span className="label">Content</span>
              <RichEditor value={edit.body} onChange={(v) => setEdit({ ...edit, body: v })} minH={280} />
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function Ops() {
  return (
    <Routes>
      <Route path="orders" element={<OrdersList />} />
      <Route path="orders/:id" element={<OrderDetail />} />
      <Route path="customers" element={<Customers />} />
      <Route path="discounts" element={<Discounts />} />
      <Route path="reviews" element={<Reviews />} />
      <Route path="collections" element={<Collections />} />
      <Route path="categories" element={<Categories />} />
      <Route path="homepage" element={<Homepage />} />
      <Route path="announcement" element={<Announcement />} />
      <Route path="pages" element={<Pages />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<p className="text-muted">Page not found.</p>} />
    </Routes>
  );
}
