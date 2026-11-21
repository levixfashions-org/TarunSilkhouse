import { BarChart3, FileText, Home, LayoutGrid, LogOut, Megaphone, Package, Percent, Pin, Settings, ShoppingBag, Star, Tags, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { Wordmark } from '@/components/Ornaments';
import { Framed, Spinner } from '@/components/ui';
import { get, patch, post } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { dateIN, inr, statusLabel } from '@/lib/format';
import { useSeo } from '@/lib/hooks';
import { useAuth, useUI } from '@/store';
import { Box, PageHead } from './kit';

const ProductEdit = lazy(() => import('./ProductEdit'));
const Ops = lazy(() => import('./Ops'));

const NAV: [string, string, typeof Home][] = [
  ['/admin', 'Dashboard', BarChart3],
  ['/admin/orders', 'Orders', ShoppingBag],
  ['/admin/products', 'Products', Package],
  ['/admin/collections', 'Collections', LayoutGrid],
  ['/admin/categories', 'Categories', Tags],
  ['/admin/customers', 'Customers', Users],
  ['/admin/discounts', 'Discounts', Percent],
  ['/admin/reviews', 'Reviews', Star],
  ['/admin/homepage', 'Homepage', Home],
  ['/admin/announcement', 'Announcement', Megaphone],
  ['/admin/pages', 'Pages', FileText],
  ['/admin/settings', 'Settings', Settings],
];

type Dash = {
  today: number;
  revenueToday: number;
  revenue30: number;
  orders30: number;
  pendingShipments: number;
  lowStock: { productId: string; name: string; colour: string; stock: number }[];
  top: { productId: string | null; name: string; qty: number }[];
  recent: { id: string; number: string; total: number; status: string; name: string; city: string; createdAt: string }[];
};

function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => {
    get<Dash>('/admin/dashboard').then(setD);
  }, []);
  if (!d) return <Spinner />;
  const stat = (label: string, value: string, to?: string) => (
    <Link to={to ?? '#'} className="card block p-5 transition-colors hover:border-ink">
      <p className="text-[14px] text-muted">{label}</p>
      <p className="mt-1 font-serif text-[2rem] leading-tight">{value}</p>
    </Link>
  );
  return (
    <div>
      <PageHead title="Today at Tarun Silks" sub={dateIN(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat("Today's orders", String(d.today), '/admin/orders')}
        {stat("Today's revenue", inr(d.revenueToday))}
        {stat('To pack & ship', String(d.pendingShipments), '/admin/orders?status=PLACED')}
        {stat('Last 30 days', `${inr(d.revenue30)} · ${d.orders30}`)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Box title="Recent orders" className="lg:col-span-2">
          <ul className="divide-y divide-line">
            {d.recent.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-4 py-3 text-[14px] hover:text-maroon">
                  <span>
                    <span className="font-medium">{o.number}</span> · {o.name}, {o.city}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted">{statusLabel[o.status]}</span>
                    {inr(o.total)}
                  </span>
                </Link>
              </li>
            ))}
            {!d.recent.length && <p className="text-muted">No orders yet.</p>}
          </ul>
        </Box>
        <div className="space-y-6">
          <Box title="Low stock">
            <ul className="space-y-2 text-[14px]">
              {d.lowStock.map((l) => (
                <li key={`${l.productId}${l.colour}`}>
                  <Link to={`/admin/products/${l.productId}`} className="flex justify-between gap-3 hover:text-maroon">
                    <span className="truncate">
                      {l.name} · {l.colour}
                    </span>
                    <span className={l.stock === 0 ? 'text-danger' : 'text-maroon'}>{l.stock === 0 ? 'Sold out' : `${l.stock} left`}</span>
                  </Link>
                </li>
              ))}
              {!d.lowStock.length && <p className="text-muted">Everything is well stocked.</p>}
            </ul>
          </Box>
          <Box title="Top sarees · 30 days">
            <ol className="list-decimal space-y-1 pl-5 text-[14px]">
              {d.top.map((t) => (
                <li key={t.name}>
                  {t.name} <span className="text-muted">× {t.qty}</span>
                </li>
              ))}
              {!d.top.length && <p className="text-muted">No sales yet.</p>}
            </ol>
          </Box>
        </div>
      </div>
    </div>
  );
}

type Row = { id: string; name: string; slug: string; fabric: string; price: number; mrp: number; isActive: boolean; isPinned: boolean; stock: number; colours: { id: string; name: string; hex: string; stock: number }[]; image: string | null };

function Products() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [bulk, setBulk] = useState(false);
  const [edits, setEdits] = useState<{ p: Record<string, { price?: number; mrp?: number }>; c: Record<string, number> }>({ p: {}, c: {} });
  const toast = useUI((s) => s.toast);
  const load = () => get<{ items: Row[] }>(`/admin/products?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then((r) => setRows(r.items));
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const saveBulk = async () => {
    await post('/admin/products/bulk', {
      products: Object.entries(edits.p).map(([id, v]) => ({ id, ...v })),
      colours: Object.entries(edits.c).map(([id, stock]) => ({ id, stock })),
    });
    setEdits({ p: {}, c: {} });
    setBulk(false);
    toast('Prices and stock updated');
    void load();
  };

  return (
    <div>
      <PageHead
        title="Products"
        sub={rows ? `${rows.length} sarees` : undefined}
        actions={
          <>
            {bulk ? (
              <>
                <button className="btn-ghost min-h-[42px] px-5" onClick={() => setBulk(false)}>
                  Cancel
                </button>
                <button className="btn-primary min-h-[42px] px-5" onClick={saveBulk}>
                  Save changes
                </button>
              </>
            ) : (
              <button className="btn-ghost min-h-[42px] px-5" onClick={() => setBulk(true)}>
                Bulk edit price &amp; stock
              </button>
            )}
            <Link to="/admin/products/new" className="btn-primary min-h-[42px] px-5">
              Add saree
            </Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="Search name or fabric" value={q} onChange={(e) => setQ(e.target.value)} />
        {[
          ['all', 'All'],
          ['active', 'Visible'],
          ['hidden', 'Hidden'],
          ['low', 'Low stock'],
        ].map(([v, l]) => (
          <button key={v} className="chip" aria-pressed={status === v} onClick={() => setStatus(v)}>
            {l}
          </button>
        ))}
      </div>
      {!rows ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="p-3 font-normal">Saree</th>
                <th className="p-3 font-normal">Price (₹)</th>
                <th className="p-3 font-normal">MRP (₹)</th>
                <th className="p-3 font-normal">Stock by colour</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-middle">
                  <td className="p-3">
                    <Link to={`/admin/products/${r.id}`} className="flex items-center gap-3 hover:text-maroon">
                      <span className="w-10 shrink-0">
                        <Framed url={r.image} alt="" sizes="40px" className="rounded-md" />
                      </span>
                      <span>
                        <span className="flex items-center gap-1 font-medium">
                          {r.isPinned && <Pin size={13} className="text-gold" aria-label="Pinned" />}
                          {r.name}
                        </span>
                        <span className="text-muted">{r.fabric}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="p-3">
                    {bulk ? (
                      <input className="field w-28 py-2" type="number" defaultValue={r.price} onChange={(e) => setEdits((x) => ({ ...x, p: { ...x.p, [r.id]: { ...x.p[r.id], price: Number(e.target.value) } } }))} />
                    ) : (
                      r.price.toLocaleString('en-IN')
                    )}
                  </td>
                  <td className="p-3">
                    {bulk ? (
                      <input className="field w-28 py-2" type="number" defaultValue={r.mrp} onChange={(e) => setEdits((x) => ({ ...x, p: { ...x.p, [r.id]: { ...x.p[r.id], mrp: Number(e.target.value) } } }))} />
                    ) : (
                      r.mrp.toLocaleString('en-IN')
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {r.colours.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1.5" title={c.name}>
                          <span className="h-3 w-3 rounded-full border border-ink/10" style={{ background: c.hex }} />
                          {bulk ? (
                            <input className="w-14 rounded-lg border border-line bg-paper px-2 py-1" type="number" min={0} defaultValue={c.stock} onChange={(e) => setEdits((x) => ({ ...x, c: { ...x.c, [c.id]: Number(e.target.value) } }))} aria-label={`${c.name} stock`} />
                          ) : (
                            <span className={c.stock === 0 ? 'text-danger' : c.stock <= 2 ? 'text-maroon' : ''}>{c.stock}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <button
                      className={`rounded-full px-3 py-1 text-[12px] ${r.isActive ? 'bg-sage/20' : 'bg-line'}`}
                      onClick={async () => {
                        await patch(`/admin/products/${r.id}`, { isActive: !r.isActive });
                        void load();
                      }}
                    >
                      {r.isActive ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Firebase login + email allow-list; the server re-checks on every /api/admin request. */
export default function Admin() {
  useSeo('Admin');
  const { user, ready } = useAuth();
  const [menu, setMenu] = useState(false);
  if (!ready) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/signin?next=/admin" replace />;
  if (!user.isAdmin)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <p className="font-serif text-3xl">This account is not an admin</p>
        <p className="mt-2 max-w-sm text-muted">Signed in as {user.email ?? user.phone}. Ask the owner to add this email to ADMIN_EMAILS on the server.</p>
        <Link to="/" className="btn-primary mt-6">
          Back to the store
        </Link>
      </div>
    );
  return (
    <div className="min-h-screen md:flex">
      <aside className={`fixed left-0 top-0 z-50 h-full w-64 shrink-0 border-r border-line bg-paper transition-transform md:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center px-5">
          <Link to="/admin">
            <Wordmark className="scale-90" />
          </Link>
        </div>
        <nav className="space-y-0.5 px-3 pb-6" onClick={() => setMenu(false)}>
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-[14px] text-muted hover:bg-blush aria-[current=page]:bg-blush aria-[current=page]:text-ink">
              <Icon size={17} strokeWidth={1.6} /> {label}
            </NavLink>
          ))}
          <div className="my-3 h-px bg-line" />
          <a href="/" target="_blank" className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-[14px] text-muted hover:bg-blush">
            View store
          </a>
          <button onClick={() => void signOut()} className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 text-[14px] text-muted hover:bg-blush">
            <LogOut size={17} /> Sign out
          </button>
        </nav>
      </aside>
      {menu && <div className="fixed left-0 top-0 z-40 h-full w-full bg-ink/30 md:hidden" onClick={() => setMenu(false)} />}
      <div className="min-w-0 flex-1 md:ml-64">
        <div className="sticky top-0 z-30 flex h-14 items-center border-b border-line bg-ivory/90 px-4 backdrop-blur md:hidden">
          <button onClick={() => setMenu(true)} className="chip">
            Menu
          </button>
        </div>
        <div className="mx-auto max-w-[1280px] p-4 md:p-8">
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductEdit />} />
              <Route path="products/:id" element={<ProductEdit />} />
              <Route path="*" element={<Ops />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
