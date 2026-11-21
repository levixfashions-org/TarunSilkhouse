import { Check, Copy, Download, ExternalLink, Film, Image as ImageIcon, Mail, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { currentToken, del, get, put } from '@/lib/api';
import { dateIN } from '@/lib/format';
import { useUI } from '@/store';
import { VideoUpload } from './HomeEditor';
import { Box, PageHead, UploadButton } from './kit';

type Status = {
  integrations: {
    signIn: { ok: boolean; detail: string | null };
    payments: { ok: boolean; mode: 'live' | 'test' | null; webhook: boolean };
    email: { ok: boolean; detail: string | null };
    maps: { ok: boolean; detail: string };
    uploads: { ok: boolean; detail: string };
    analytics: { ok: boolean };
  };
  checklist: Record<string, boolean>;
  counts: { totalProducts: number; sampleProducts: number; collections: number; homeSections: number; orders: number };
  publicUrl: string;
};

/** Downloads a file from an admin endpoint (needs the sign-in token, so a plain link won't do). */
export async function downloadAdminFile(path: string, filename: string) {
  const t = await currentToken();
  const r = await fetch(`/api/admin${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!r.ok) throw new Error('Download failed');
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ================================================================ dashboard checklist */
const STEPS: { key: string; title: string; body: string; to: string; cta: string }[] = [
  { key: 'storeDetails', title: 'Add your store details', body: 'Store email and phone number shown to customers and on invoices.', to: '/admin/settings', cta: 'Open settings' },
  { key: 'whatsapp', title: 'Set your WhatsApp number', body: 'Powers every “Chat on WhatsApp” and “Ask about this saree” button.', to: '/admin/settings', cta: 'Set number' },
  { key: 'logo', title: 'Upload your logo', body: 'Replaces the text logo in the header (optional).', to: '/admin/settings', cta: 'Upload logo' },
  { key: 'address', title: 'Add your shop address', body: 'Shown on the Visit the store page and invoices.', to: '/admin/settings', cta: 'Add address' },
  { key: 'ownProducts', title: 'Add your first saree', body: 'Photos, colours with stock, price and details.', to: '/admin/products/new', cta: 'Add saree' },
  { key: 'samplesRemoved', title: 'Remove the 12 sample sarees', body: 'They are there so the store looks complete while you set up.', to: '/admin/settings#samples', cta: 'Remove samples' },
  { key: 'homepage', title: 'Make the homepage yours', body: 'Headline, story, featured collections, quotes — no code needed.', to: '/admin/homepage', cta: 'Edit homepage' },
  { key: 'policies', title: 'Write your policies', body: 'Privacy, terms, shipping and returns pages.', to: '/admin/pages', cta: 'Edit pages' },
  { key: 'payments', title: 'Turn on online payments', body: 'Add Razorpay keys to the server settings (Cash on Delivery works already).', to: '/admin', cta: 'See below' },
];

export function SetupChecklist() {
  const [s, setS] = useState<Status | null>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    get<Status>('/admin/setup-status').then(setS).catch(() => {});
  }, []);
  if (!s) return null;
  const done = STEPS.filter((x) => s.checklist[x.key]).length;
  const i = s.integrations;
  const svc = (ok: boolean, name: string, detail: string, fix?: string) => (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-sage text-white' : 'bg-line text-muted'}`}>{ok ? <Check size={13} /> : <X size={13} />}</span>
      <span className="text-[14px]">
        <span className="font-medium">{name}</span> — <span className="text-muted">{detail}</span>
        {!ok && fix && <span className="block text-[12px] text-muted">{fix}</span>}
      </span>
    </li>
  );
  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-3">
      <section className="card p-5 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Set up your store</h2>
            <p className="text-[14px] text-muted">
              {done} of {STEPS.length} done
            </p>
          </div>
          <button className="text-[13px] underline underline-offset-4" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} steps
          </button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-gold transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
        </div>
        {open && (
          <ol className="mt-4 divide-y divide-line">
            {STEPS.map((st) => {
              const ok = !!s.checklist[st.key];
              return (
                <li key={st.key} className="flex items-center gap-3 py-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${ok ? 'border-sage bg-sage text-white' : 'border-line'}`}>{ok && <Check size={14} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${ok ? 'text-muted line-through' : ''}`}>{st.title}</p>
                    {!ok && <p className="text-[13px] text-muted">{st.body}</p>}
                  </div>
                  {!ok && st.key !== 'payments' && (
                    <Link to={st.to} className="btn-ghost min-h-[36px] shrink-0 px-4 text-[13px]">
                      {st.cta}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section className="card p-5">
        <h2 className="font-serif text-2xl">Connected services</h2>
        <p className="mb-2 text-[13px] text-muted">These are set in Hostinger → Environment variables.</p>
        <ul className="divide-y divide-line">
          {svc(i.signIn.ok, 'Customer sign-in', i.signIn.ok ? `Firebase (${i.signIn.detail})` : 'Not set up', 'Add the FIREBASE_ values.')}
          {svc(
            i.payments.ok,
            'Online payments',
            i.payments.ok ? `Razorpay ${i.payments.mode === 'live' ? 'LIVE' : 'test mode'}${i.payments.webhook ? '' : ' — webhook secret missing'}` : 'Off — Cash on Delivery only',
            'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
          )}
          {svc(i.email.ok, 'Order emails', i.email.ok ? `Sending from ${i.email.detail}` : 'Off', 'Add SMTP_USER and SMTP_PASS (Hostinger mailbox).')}
          {svc(i.maps.ok, 'Location autofill', i.maps.detail)}
          {svc(i.uploads.ok, 'Photo storage', i.uploads.ok ? 'Working' : `Can’t write to ${i.uploads.detail}`, 'Check UPLOAD_DIR.')}
          {svc(i.analytics.ok, 'Analytics', i.analytics.ok ? 'Google / Meta tracking on' : 'Not set', 'Add IDs in Settings → Analytics.')}
        </ul>
        <a href={s.publicUrl} target="_blank" rel="noreferrer" className="chip mt-3">
          <ExternalLink size={14} /> Open the store
        </a>
      </section>
    </div>
  );
}

/* ================================================================ media library */
type Media = { id: string; main: string; thumb: string; original: string; width: number; height: number; bytes: number; mime: string; createdAt: string };

export function MediaLibrary() {
  const [items, setItems] = useState<Media[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const toast = useUI((s) => s.toast);
  const load = () => get<{ items: Media[] }>('/admin/media').then((r) => setItems(r.items));
  useEffect(() => {
    void load();
  }, []);
  const copy = async (url: string) => {
    const full = `${location.origin}${url}`;
    await navigator.clipboard.writeText(full).catch(() => {});
    toast('Link copied');
  };
  const shown = (items ?? []).filter((m) => filter === 'all' || m.mime.startsWith(filter));
  return (
    <div>
      <PageHead
        title="Media library"
        sub="Every photo and video uploaded to the store. Product photos are best uploaded inside the product itself."
        actions={
          <>
            <UploadButton onDone={() => void load()} />
            <UploadButton keepOriginal label="Upload banner (full quality)" onDone={() => void load()} />
            <VideoUpload onDone={() => void load()} />
          </>
        }
      />
      <div className="mb-4 flex gap-2">
        {(['all', 'image', 'video'] as const).map((f) => (
          <button key={f} className="chip capitalize" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'image' ? 'Photos' : 'Videos'}
          </button>
        ))}
      </div>
      {!items ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="text-muted">Nothing uploaded yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((m) => {
            const video = m.mime.startsWith('video');
            return (
              <li key={m.id} className="card overflow-hidden">
                <div className="relative bg-blush" style={{ paddingBottom: '100%' }}>
                  {video ? (
                    <video src={m.main} className="absolute left-0 top-0 h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={m.thumb} alt="" loading="lazy" className="absolute left-0 top-0 h-full w-full object-cover" />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-ink/70 p-1.5 text-ivory">{video ? <Film size={12} /> : <ImageIcon size={12} />}</span>
                </div>
                <div className="p-2 text-[12px]">
                  <p className="text-muted">
                    {video ? 'Video' : `${m.width}×${m.height}`} · {(m.bytes / 1048576).toFixed(1)} MB
                  </p>
                  <p className="text-muted">{dateIN(m.createdAt)}</p>
                  <div className="mt-1.5 flex gap-1">
                    <button className="chip min-h-[32px] px-2.5 text-[12px]" onClick={() => copy(m.main)}>
                      <Copy size={12} /> Copy link
                    </button>
                    <a className="chip min-h-[32px] px-2.5 text-[12px]" href={video ? m.main : m.original} target="_blank" rel="noreferrer" aria-label="Open">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ================================================================ team */
export function TeamPage() {
  const [locked, setLocked] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[] | null>(null);
  const [add, setAdd] = useState('');
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    get<{ locked: string[]; emails: string[] }>('/admin/team').then((r) => {
      setLocked(r.locked);
      setEmails(r.emails);
    });
  }, []);
  const save = async (next: string[]) => {
    try {
      const r = await put<{ locked: string[]; emails: string[] }>('/admin/team', { emails: next });
      setEmails(r.emails);
      toast('Team updated');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  if (!emails) return <Spinner />;
  return (
    <div className="max-w-2xl">
      <PageHead title="Team" sub="People who can open this admin panel. They sign in on the store with this email (Google, email or phone)." />
      <Box>
        <ul className="divide-y divide-line">
          {locked.map((e) => (
            <li key={e} className="flex items-center justify-between py-3 text-[14px]">
              <span>{e}</span>
              <span className="rounded-full bg-gold/20 px-3 py-1 text-[12px]">Owner (server setting)</span>
            </li>
          ))}
          {emails.map((e) => (
            <li key={e} className="flex items-center justify-between py-3 text-[14px]">
              <span>{e}</span>
              <button className="flex items-center gap-1 text-[13px] text-muted hover:text-danger" onClick={() => confirm(`Remove ${e} from the admin team?`) && save(emails.filter((x) => x !== e))}>
                <Trash2 size={14} /> Remove
              </button>
            </li>
          ))}
          {!locked.length && !emails.length && <p className="py-3 text-muted">No admins yet.</p>}
        </ul>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = add.trim().toLowerCase();
            if (!/^\S+@\S+\.\S+$/.test(v)) return toast('Enter a valid email', 'error');
            void save([...emails, v]);
            setAdd('');
          }}
        >
          <input className="field" type="email" placeholder="staff@example.com" value={add} onChange={(e) => setAdd(e.target.value)} />
          <button className="btn-primary min-h-[48px] px-5">
            <UserPlus size={16} /> Add
          </button>
        </form>
        <p className="mt-3 text-[13px] text-muted">Team members can do everything in the admin panel. Owners listed in the server setting ADMIN_EMAILS can’t be removed here.</p>
      </Box>
    </div>
  );
}

/* ================================================================ audience: subscribers + back-in-stock */
export function AudiencePage() {
  const [tab, setTab] = useState<'subs' | 'alerts'>('subs');
  const [subs, setSubs] = useState<{ id: string; email: string; createdAt: string }[] | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; product: string; productId: string; colour: string | null; inStockNow: boolean; email: string | null; phone: string | null; notifiedAt: string | null; createdAt: string }[] | null>(null);
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    get<{ items: NonNullable<typeof subs> }>('/admin/subscribers').then((r) => setSubs(r.items));
    get<{ items: NonNullable<typeof alerts> }>('/admin/stock-alerts').then((r) => setAlerts(r.items));
  }, []);
  return (
    <div>
      <PageHead
        title="Subscribers & requests"
        actions={
          tab === 'subs' && (
            <button className="btn-ghost min-h-[42px] px-5" onClick={() => downloadAdminFile('/subscribers.csv', 'subscribers.csv').catch((e) => toast((e as Error).message, 'error'))}>
              <Download size={16} /> Download CSV
            </button>
          )
        }
      />
      <div className="mb-4 flex gap-2">
        <button className="chip" aria-pressed={tab === 'subs'} onClick={() => setTab('subs')}>
          <Mail size={14} /> Newsletter ({subs?.length ?? '…'})
        </button>
        <button className="chip" aria-pressed={tab === 'alerts'} onClick={() => setTab('alerts')}>
          Back-in-stock requests ({alerts?.length ?? '…'})
        </button>
      </div>
      {tab === 'subs' &&
        (!subs ? (
          <Spinner />
        ) : subs.length === 0 ? (
          <p className="text-muted">No subscribers yet — the sign-up box is the last block on the homepage.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3 text-[14px]">
                <span>{s.email}</span>
                <span className="flex items-center gap-3 text-muted">
                  {dateIN(s.createdAt)}
                  <button
                    className="p-1 hover:text-danger"
                    aria-label={`Remove ${s.email}`}
                    onClick={async () => {
                      if (!confirm(`Remove ${s.email}?`)) return;
                      await del(`/admin/subscribers/${s.id}`);
                      setSubs(subs.filter((x) => x.id !== s.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ))}
      {tab === 'alerts' &&
        (!alerts ? (
          <Spinner />
        ) : alerts.length === 0 ? (
          <p className="text-muted">When a colour is sold out, customers can ask to be told when it’s back. Their requests appear here.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[600px] text-[14px]">
              <thead className="border-b border-line text-left text-muted">
                <tr>
                  <th className="p-3 font-normal">Saree</th>
                  <th className="p-3 font-normal">Customer</th>
                  <th className="p-3 font-normal">Asked on</th>
                  <th className="p-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="p-3">
                      <Link to={`/admin/products/${a.productId}`} className="hover:text-maroon">
                        {a.product}
                      </Link>
                      {a.colour && <span className="text-muted"> · {a.colour}</span>}
                    </td>
                    <td className="p-3">{a.email ?? a.phone}</td>
                    <td className="p-3">{dateIN(a.createdAt)}</td>
                    <td className="p-3">
                      {a.notifiedAt ? <span className="text-sage">Emailed {dateIN(a.notifiedAt)}</span> : a.inStockNow ? 'Back in stock — email going out' : <span className="text-maroon">Waiting for restock</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
