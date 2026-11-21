/**
 * Homepage editor: every block has a proper form (no code). Reorder, hide, add and delete blocks.
 * Changes are live on the site within seconds of saving.
 */
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Sheet, Spinner } from '@/components/ui';
import { del, get, post, put } from '@/lib/api';
import { colourFamilies } from '@/lib/format';
import { useBoot, useUI } from '@/store';
import { Field, PageHead, UploadButton } from './kit';

type Section = { id: string; type: string; title: string | null; data: Record<string, unknown>; isVisible: boolean; sortOrder: number };
type Coll = { handle: string; title: string; isEditorial: boolean };
type Prod = { id: string; name: string; slug: string };

export const BLOCKS: Record<string, { label: string; help: string; title?: string; data: Record<string, unknown> }> = {
  hero: {
    label: 'Hero — silk scene and headline',
    help: 'The full-screen opening with the moving silk, big headline and buttons.',
    data: { eyebrow: 'Handwoven in India since 1987', line1: 'Six yards', line2: 'of poetry.', cta: 'Explore the collection', ctaLink: '/shop', secondary: 'The Wedding Edit', secondaryLink: '/edits/wedding-edit', video: '', poster: '' },
  },
  marquee: { label: 'Scrolling fabric names', help: 'A gold strip of words that scrolls sideways.', data: { items: ['Kanjivaram', 'Banarasi', 'Paithani', 'Chanderi'] } },
  story: {
    label: 'Brand story (loom → weaver → drape)',
    help: 'A pinned section that tells your story in steps while a saree unfurls.',
    title: 'From loom to drape',
    data: { steps: [{ title: 'The loom', body: '' }, { title: 'The weaver', body: '' }, { title: 'The drape', body: '' }] },
  },
  collections: { label: 'Fabric gallery (sideways scroll)', help: 'Big photo panels for chosen collections.', title: 'Eight looms.\nOne obsession.', data: { handles: [] } },
  new: { label: 'New arrivals row', help: 'The newest sarees, picked automatically.', title: 'New on the loom', data: {} },
  bestsellers: { label: 'Bestsellers row', help: 'The most viewed and bought sarees, picked automatically.', title: 'Most loved', data: {} },
  pallu: { label: 'Pallu feature', help: 'One saree’s pallu with a magnifier to see the weave.', title: 'All the drama lives\nin the pallu.', data: { body: '', slug: '', cta: 'See the weave' } },
  colours: {
    label: 'Shop by colour',
    help: 'Colour orbs; tapping one tints the page and shows sarees in that colour.',
    title: 'Choose a mood.',
    data: { swatches: [{ name: 'Sindoor', family: 'red', hex: '#B3282D' }] },
  },
  edits: { label: 'Editorial edits', help: 'Your Wedding / Festive / Everyday look-books with a quote.', title: 'Edits', data: { handles: [], quote: '', quoteBy: '' } },
  craft: { label: 'Craft & trust points', help: 'Why buy from you — certification, weavers, quality.', title: 'Every saree, verifiably handwoven.', data: { points: [{ title: '', body: '' }] } },
  testimonials: { label: 'Customer quotes', help: 'Rotating quotes from happy customers.', title: 'Worn and loved', data: { items: [{ name: '', city: '', quote: '' }] } },
  instagram: { label: 'Instagram strip', help: 'A row of saree photos linking to your Instagram.', title: '@tarunsilks', data: {} },
  newsletter: { label: 'Newsletter sign-up', help: 'Collects emails (download them in Customers → Subscribers).', title: 'Letters from the loom', data: { body: 'New weaves, weaver stories and early access to festive drops.' } },
};

/* ---------------- small form helpers ---------------- */
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function Text({ label, value, onChange, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
function Area({ label, value, onChange, hint, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number }) {
  return (
    <Field label={label} hint={hint}>
      <textarea className="field" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** Edits a list of objects: add, remove, move up/down. */
function ListEditor<T extends Record<string, string>>({
  label,
  items,
  onChange,
  blank,
  render,
  max = 12,
}: {
  label: string;
  items: T[];
  onChange: (v: T[]) => void;
  blank: T;
  render: (item: T, set: (patch: Partial<T>) => void) => ReactNode;
  max?: number;
}) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-line bg-paper p-3">
            <div className="mb-2 flex items-center justify-between text-[13px] text-muted">
              <span>#{i + 1}</span>
              <span className="flex">
                <button type="button" className="rounded p-1.5 hover:bg-blush" onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="rounded p-1.5 hover:bg-blush" onClick={() => move(i, 1)} aria-label="Move down">
                  <ArrowDown size={14} />
                </button>
                <button type="button" className="rounded p-1.5 text-danger hover:bg-blush" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
            <div className="space-y-3">{render(it, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
          </div>
        ))}
      </div>
      {items.length < max && (
        <button type="button" className="chip mt-3" onClick={() => onChange([...items, { ...blank }])}>
          <Plus size={14} /> Add
        </button>
      )}
    </div>
  );
}

/** Pick collections in a chosen order. */
function CollectionPicker({ value, onChange, all, onlyEditorial, max = 12 }: { value: string[]; onChange: (v: string[]) => void; all: Coll[]; onlyEditorial?: boolean; max?: number }) {
  const pool = all.filter((c) => (onlyEditorial ? c.isEditorial : true));
  const title = (h: string) => all.find((c) => c.handle === h)?.title ?? h;
  return (
    <div>
      <span className="label">{onlyEditorial ? 'Edits to show (up to 3, in order)' : 'Collections to show (in order)'}</span>
      <div className="flex flex-wrap gap-2">
        {value.map((h, i) => (
          <span key={h} className="chip border-ink bg-ink text-ivory">
            {i + 1}. {title(h)}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== h))} aria-label={`Remove ${title(h)}`}>
              <X size={14} />
            </button>
          </span>
        ))}
        {!value.length && <span className="text-[13px] text-muted">Nothing chosen yet.</span>}
      </div>
      {value.length < max && (
        <select className="field mt-2" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">+ Add a {onlyEditorial ? 'look-book edit' : 'collection'}…</option>
          {pool
            .filter((c) => !value.includes(c.handle))
            .map((c) => (
              <option key={c.handle} value={c.handle}>
                {c.title}
              </option>
            ))}
        </select>
      )}
      {onlyEditorial && !pool.length && <p className="mt-2 text-[13px] text-muted">No edits yet — in Collections, turn on “Editorial look-book page” for a collection.</p>}
    </div>
  );
}

/* ---------------- the form for each block ---------------- */
function BlockForm({ s, set, colls, prods }: { s: Section; set: (patch: Partial<Section>) => void; colls: Coll[]; prods: Prod[] }) {
  const d = s.data;
  const setD = (patch: Record<string, unknown>) => set({ data: { ...d, ...patch } });
  const titleField = (hint?: string) => (
    <Area label="Heading" rows={2} value={s.title ?? ''} onChange={(v) => set({ title: v })} hint={hint ?? 'Press Enter to split it onto two lines — the second line is shown in italics.'} />
  );

  switch (s.type) {
    case 'hero':
      return (
        <div className="space-y-4">
          <Text label="Small line above the headline" value={str(d.eyebrow)} onChange={(v) => setD({ eyebrow: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Headline — line 1" value={str(d.line1)} onChange={(v) => setD({ line1: v })} />
            <Text label="Headline — line 2 (gold italic)" value={str(d.line2)} onChange={(v) => setD({ line2: v })} />
            <Text label="Main button text" value={str(d.cta)} onChange={(v) => setD({ cta: v })} />
            <Text label="Main button goes to" value={str(d.ctaLink)} onChange={(v) => setD({ ctaLink: v })} hint="e.g. /shop or /collections/kanjivaram" />
            <Text label="Second link text" value={str(d.secondary)} onChange={(v) => setD({ secondary: v })} hint="Leave empty to hide" />
            <Text label="Second link goes to" value={str(d.secondaryLink)} onChange={(v) => setD({ secondaryLink: v })} />
          </div>
          <div className="rounded-xl bg-blush p-4">
            <p className="mb-3 text-[13px]">Phones that can’t run the moving silk show this video (or the poster image) instead. Use an MP4 under 15 MB.</p>
            <div className="flex flex-wrap items-start gap-3">
              <VideoUpload onDone={(url) => setD({ video: url })} />
              <UploadButton multiple={false} keepOriginal label="Upload poster image" onDone={(f) => setD({ poster: f[0].url.replace('main.webp', 'main.jpg') })} />
            </div>
            {str(d.video) && (
              <p className="mt-2 flex items-center gap-2 text-[13px]">
                Video: <a className="underline" href={str(d.video)} target="_blank" rel="noreferrer">{str(d.video).split('/').pop()}</a>
                <button type="button" className="text-danger" onClick={() => setD({ video: '' })}>Remove</button>
              </p>
            )}
            {str(d.poster) && (
              <p className="mt-1 flex items-center gap-2 text-[13px]">
                Poster: <a className="underline" href={str(d.poster)} target="_blank" rel="noreferrer">{str(d.poster).split('/').slice(-2).join('/')}</a>
                <button type="button" className="text-danger" onClick={() => setD({ poster: '' })}>Remove</button>
              </p>
            )}
          </div>
        </div>
      );
    case 'marquee':
      return (
        <Area
          label="Words (one per line)"
          rows={8}
          value={arr<string>(d.items).join('\n')}
          onChange={(v) => setD({ items: v.split('\n').map((x) => x.trim()).filter(Boolean) })}
        />
      );
    case 'story':
      return (
        <div className="space-y-4">
          {titleField('The heading next to the steps.')}
          <ListEditor
            label="Steps (shown in order)"
            items={arr<{ title: string; body: string }>(d.steps)}
            onChange={(v) => setD({ steps: v })}
            blank={{ title: '', body: '' }}
            max={5}
            render={(it, upd) => (
              <>
                <Text label="Step title" value={it.title} onChange={(v) => upd({ title: v })} />
                <Area label="Text" rows={2} value={it.body} onChange={(v) => upd({ body: v })} />
              </>
            )}
          />
        </div>
      );
    case 'collections':
      return (
        <div className="space-y-4">
          {titleField()}
          <CollectionPicker value={arr<string>(d.handles)} onChange={(v) => setD({ handles: v })} all={colls} />
        </div>
      );
    case 'new':
    case 'bestsellers':
    case 'instagram':
      return (
        <div className="space-y-4">
          <Text label="Heading" value={s.title ?? ''} onChange={(v) => set({ title: v })} />
          <p className="text-[13px] text-muted">
            {s.type === 'instagram' ? 'Shows your most loved saree photos and links to the Instagram handle in Settings.' : 'The sarees are picked automatically — nothing else to set.'}
          </p>
        </div>
      );
    case 'pallu':
      return (
        <div className="space-y-4">
          {titleField()}
          <Area label="Text" value={str(d.body)} onChange={(v) => setD({ body: v })} />
          <Field label="Saree to feature" hint="Its flat-lay / pallu photo is used (tag a photo “Flat lay / pallu” in the product).">
            <select className="field" value={str(d.slug)} onChange={(e) => setD({ slug: e.target.value })}>
              <option value="">Choose a saree…</option>
              {prods.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Text label="Button text" value={str(d.cta)} onChange={(v) => setD({ cta: v })} />
        </div>
      );
    case 'colours':
      return (
        <div className="space-y-4">
          <Text label="Heading" value={s.title ?? ''} onChange={(v) => set({ title: v })} />
          <ListEditor
            label="Colour orbs"
            items={arr<{ name: string; family: string; hex: string }>(d.swatches)}
            onChange={(v) => setD({ swatches: v })}
            blank={{ name: '', family: 'red', hex: '#B3282D' }}
            max={10}
            render={(it, upd) => (
              <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-3">
                <label className="block">
                  <span className="label">Colour</span>
                  <input type="color" className="h-12 w-14 cursor-pointer rounded-xl border border-line bg-paper" value={it.hex} onChange={(e) => upd({ hex: e.target.value })} />
                </label>
                <Text label="Name shown" value={it.name} onChange={(v) => upd({ name: v })} placeholder="e.g. Sindoor" />
                <Field label="Shows sarees from">
                  <select className="field" value={it.family} onChange={(e) => upd({ family: e.target.value })}>
                    {colourFamilies.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          />
          <p className="text-[13px] text-muted">Each saree colour has a “Shop-by-colour group” in the product form — that decides which orb it appears under.</p>
        </div>
      );
    case 'edits':
      return (
        <div className="space-y-4">
          <CollectionPicker value={arr<string>(d.handles)} onChange={(v) => setD({ handles: v })} all={colls} onlyEditorial max={3} />
          <Area label="Quote" rows={2} value={str(d.quote)} onChange={(v) => setD({ quote: v })} />
          <Text label="Quote by" value={str(d.quoteBy)} onChange={(v) => setD({ quoteBy: v })} placeholder="a weaver in Kanchipuram" />
        </div>
      );
    case 'craft':
      return (
        <div className="space-y-4">
          {titleField('The heading on the maroon panel.')}
          <ListEditor
            label="Points"
            items={arr<{ title: string; body: string }>(d.points)}
            onChange={(v) => setD({ points: v })}
            blank={{ title: '', body: '' }}
            max={6}
            render={(it, upd) => (
              <>
                <Text label="Title" value={it.title} onChange={(v) => upd({ title: v })} />
                <Area label="Text" rows={2} value={it.body} onChange={(v) => upd({ body: v })} />
              </>
            )}
          />
        </div>
      );
    case 'testimonials':
      return (
        <div className="space-y-4">
          <Text label="Heading (not shown, for your reference)" value={s.title ?? ''} onChange={(v) => set({ title: v })} />
          <ListEditor
            label="Quotes"
            items={arr<{ name: string; city: string; quote: string }>(d.items)}
            onChange={(v) => setD({ items: v })}
            blank={{ name: '', city: '', quote: '' }}
            render={(it, upd) => (
              <>
                <Area label="What they said" rows={2} value={it.quote} onChange={(v) => upd({ quote: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Text label="Name" value={it.name} onChange={(v) => upd({ name: v })} />
                  <Text label="City" value={it.city} onChange={(v) => upd({ city: v })} />
                </div>
              </>
            )}
          />
        </div>
      );
    case 'newsletter':
      return (
        <div className="space-y-4">
          <Text label="Heading" value={s.title ?? ''} onChange={(v) => set({ title: v })} />
          <Area label="Text" value={str(d.body)} onChange={(v) => setD({ body: v })} />
        </div>
      );
    default:
      return <p className="text-muted">This block has no settings.</p>;
  }
}

export function VideoUpload({ onDone }: { onDone: (url: string) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <label className="btn-ghost min-h-[42px] cursor-pointer px-5">
        {pct !== null ? `Uploading ${pct}%` : 'Upload video'}
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > 80 * 1024 * 1024) return setMsg('Video is over 80 MB — please compress it (under 15 MB is ideal).');
            setPct(0);
            setMsg(null);
            try {
              const { currentToken } = await import('@/lib/api');
              const token = await currentToken();
              const url = await new Promise<string>((resolve, reject) => {
                const fd = new FormData();
                fd.append('file', f);
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/admin/media/video');
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100));
                xhr.onload = () => {
                  const j = JSON.parse(xhr.responseText || '{}');
                  if (xhr.status >= 400) reject(new Error(j?.error?.message ?? 'Upload failed'));
                  else resolve(j.file.url);
                };
                xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
                xhr.send(fd);
              });
              onDone(url);
              setMsg(`Uploaded (${(f.size / 1048576).toFixed(1)} MB)`);
            } catch (err) {
              setMsg((err as Error).message);
            } finally {
              setPct(null);
            }
          }}
        />
      </label>
      {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
    </div>
  );
}

/* ---------------- page ---------------- */
export default function HomeEditor() {
  const [rows, setRows] = useState<Section[] | null>(null);
  const [edit, setEdit] = useState<Section | null>(null);
  const [adding, setAdding] = useState(false);
  const [colls, setColls] = useState<Coll[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const toast = useUI((s) => s.toast);
  const reloadBoot = useBoot((b) => b.load);
  const load = () => get<{ items: Section[] }>('/admin/home').then((r) => setRows(r.items));
  useEffect(() => {
    void load();
    get<{ items: Coll[] }>('/admin/collections').then((r) => setColls(r.items));
    get<{ items: Prod[] }>('/admin/products').then((r) => setProds(r.items));
  }, []);

  const refresh = () => {
    void load();
    void reloadBoot();
  };
  const reorder = async (i: number, d: number) => {
    if (!rows || !rows[i + d]) return;
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRows(next);
    await post('/admin/home/reorder', { ids: next.map((r) => r.id) });
    void reloadBoot();
  };

  return (
    <div>
      <PageHead
        title="Homepage"
        sub="Each block is one band of the homepage, top to bottom. Click a block to edit it."
        actions={
          <>
            <a href="/" target="_blank" rel="noreferrer" className="btn-ghost min-h-[42px] px-5">
              <ExternalLink size={16} /> View homepage
            </a>
            <button className="btn-primary min-h-[42px] px-5" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add block
            </button>
          </>
        }
      />
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-serif text-2xl">The homepage is empty</p>
          <p className="mt-2 text-muted">Add a Hero block first, then any others you like.</p>
          <button className="btn-primary mt-5" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add block
          </button>
        </div>
      ) : (
        <ol className="card divide-y divide-line">
          {rows.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-3 p-3 ${s.isVisible ? '' : 'opacity-60'}`}>
              <span className="flex flex-col">
                <button className="rounded p-1 hover:bg-blush disabled:opacity-30" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up">
                  <ArrowUp size={14} />
                </button>
                <button className="rounded p-1 hover:bg-blush disabled:opacity-30" disabled={i === rows.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down">
                  <ArrowDown size={14} />
                </button>
              </span>
              <span className="w-6 text-center text-[13px] text-muted">{i + 1}</span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(s)}>
                <p className="truncate font-medium">{BLOCKS[s.type]?.label ?? s.type}</p>
                <p className="truncate text-[13px] text-muted">{(s.title ?? '').replace(/\n/g, ' ') || BLOCKS[s.type]?.help}</p>
              </button>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-blush"
                aria-label={s.isVisible ? 'Hide block' : 'Show block'}
                title={s.isVisible ? 'Visible — click to hide' : 'Hidden — click to show'}
                onClick={async () => {
                  await put(`/admin/home/${s.id}`, { ...s, isVisible: !s.isVisible });
                  refresh();
                }}
              >
                {s.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button className="btn-ghost min-h-[36px] px-4 text-[13px]" onClick={() => setEdit(s)}>
                Edit
              </button>
            </li>
          ))}
        </ol>
      )}

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? (BLOCKS[edit.type]?.label ?? edit.type) : ''}
        wide
        footer={
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              onClick={async () => {
                if (!edit) return;
                try {
                  await put(`/admin/home/${edit.id}`, { type: edit.type, title: edit.title, data: edit.data, isVisible: edit.isVisible });
                  toast('Saved — live on the homepage');
                  setEdit(null);
                  refresh();
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              Save block
            </button>
            <button
              className="btn-ghost px-4 text-danger"
              onClick={async () => {
                if (!edit || !confirm('Delete this block from the homepage?')) return;
                await del(`/admin/home/${edit.id}`);
                toast('Block deleted');
                setEdit(null);
                refresh();
              }}
              aria-label="Delete block"
            >
              <Trash2 size={16} />
            </button>
          </div>
        }
      >
        {edit && (
          <div>
            <p className="mb-5 text-[14px] text-muted">{BLOCKS[edit.type]?.help}</p>
            <BlockForm s={edit} set={(patch) => setEdit({ ...edit, ...patch })} colls={colls} prods={prods} />
          </div>
        )}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a block">
        <ul className="space-y-2">
          {Object.entries(BLOCKS).map(([type, b]) => (
            <li key={type}>
              <button
                className="card w-full p-4 text-left hover:border-ink"
                onClick={async () => {
                  const r = await post<{ section: Section }>('/admin/home', { type, title: b.title ?? null, data: b.data, isVisible: true });
                  setAdding(false);
                  refresh();
                  setEdit(r.section);
                }}
              >
                <p className="font-medium">{b.label}</p>
                <p className="text-[13px] text-muted">{b.help}</p>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
