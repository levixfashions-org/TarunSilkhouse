import { ArrowDown, ArrowUp, Copy, Crop, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Framed, Spinner } from '@/components/ui';
import { del, get, post, put } from '@/lib/api';
import { colourFamilies, occasionLabel, workLabel } from '@/lib/format';
import { useUI } from '@/store';
import { AdjustDialog, Box, Field, PageHead, RichEditor, Toggle, UploadButton, useReorder } from './kit';

type Colour = { id?: string; colourName: string; hex: string; family: string | null; stock: number; priceDelta: number };
type Image = { id?: string; url: string; alt: string | null; tag: 'MODEL' | 'DETAIL' | 'FLATLAY' | 'OTHER'; colourIndex: number | null };
type Form = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  fabric: string;
  weave: string;
  work: string;
  border: string;
  pallu: string;
  origin: string;
  care: string;
  occasions: string[];
  lengthInfo: string;
  blouseIncluded: boolean;
  handloomMark: boolean;
  price: number;
  mrp: number;
  falloPicoPrice: number;
  stitchingPrice: number;
  isActive: boolean;
  isPinned: boolean;
  categoryId: string | null;
  seoTitle: string;
  seoDescription: string;
  colours: Colour[];
  images: Image[];
  collectionIds: string[];
};

const empty: Form = {
  name: '',
  slug: '',
  description: '',
  fabric: 'Kanjivaram',
  weave: '',
  work: 'zari',
  border: '',
  pallu: '',
  origin: '',
  care: '<ul><li>Dry clean only</li><li>Store folded in muslin</li></ul>',
  occasions: [],
  lengthInfo: 'Saree 5.5 m + blouse piece 0.8 m',
  blouseIncluded: true,
  handloomMark: false,
  price: 0,
  mrp: 0,
  falloPicoPrice: 199,
  stitchingPrice: 0,
  isActive: true,
  isPinned: false,
  categoryId: null,
  seoTitle: '',
  seoDescription: '',
  colours: [{ colourName: '', hex: '#6B1F2A', family: 'red', stock: 1, priceDelta: 0 }],
  images: [],
  collectionIds: [],
};

const FABRICS = ['Kanjivaram', 'Banarasi', 'Paithani', 'Chanderi', 'Gadwal', 'Pochampally', 'Tussar', 'Linen', 'Cotton', 'Organza', 'Soft Silk', 'Georgette', 'Mysore Silk'];

export default function ProductEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useUI((s) => s.toast);
  const [f, setF] = useState<Form | null>(id ? null : empty);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [cols, setCols] = useState<{ id: string; title: string; isRuleBased: boolean }[]>([]);
  const [adjust, setAdjust] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    get<{ items: { id: string; name: string }[] }>('/admin/categories').then((r) => setCats(r.items));
    get<{ items: { id: string; title: string; isRuleBased: boolean }[] }>('/admin/collections').then((r) => setCols(r.items));
    if (id)
      get<{ product: Form & { weave: string | null } }>(`/admin/products/${id}`).then((r) => {
        const p = r.product;
        setF({ ...empty, ...p, weave: p.weave ?? '', border: p.border ?? '', pallu: p.pallu ?? '', origin: p.origin ?? '', care: p.care ?? '', work: p.work ?? '', seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '' });
      });
  }, [id]);

  const imgs = useReorder(f?.images ?? [], (images) => setF((x) => (x ? { ...x, images } : x)));
  if (!f) return <Spinner />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const setColour = (i: number, patch: Partial<Colour>) => set('colours', f.colours.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setImage = (i: number, patch: Partial<Image>) => set('images', f.images.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const body = { ...f, weave: f.weave || null, work: f.work || null, border: f.border || null, pallu: f.pallu || null, origin: f.origin || null, seoTitle: f.seoTitle || null, seoDescription: f.seoDescription || null, slug: f.slug || undefined };
      const r = id ? await put<{ product: Form }>(`/admin/products/${id}`, body) : await post<{ product: Form }>('/admin/products', body);
      toast('Saved — live on the site now');
      if (!id) nav(`/admin/products/${r.product.id}`, { replace: true });
      else setF({ ...f, ...r.product });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHead
        title={id ? f.name || 'Edit saree' : 'New saree'}
        sub={id && f.slug ? `/products/${f.slug}` : undefined}
        actions={
          <>
            {id && (
              <>
                <a className="btn-ghost min-h-[42px] px-5" href={`/products/${f.slug}`} target="_blank" rel="noreferrer">
                  View on site
                </a>
                <button
                  className="btn-ghost min-h-[42px] px-5"
                  onClick={async () => {
                    const r = await post<{ product: { id: string } }>(`/admin/products/${id}/duplicate`);
                    toast('Duplicated (hidden until you publish it)');
                    nav(`/admin/products/${r.product.id}`);
                  }}
                >
                  <Copy size={16} /> Duplicate
                </button>
              </>
            )}
            <button className="btn-primary min-h-[42px] px-6" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : null} Save
            </button>
          </>
        }
      />
      {err && <p className="mb-4 rounded-xl bg-danger/10 p-3 text-[14px] text-danger">{err}</p>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Box title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input className="field" value={f.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="URL slug" hint="Leave empty to create from the name">
                <input className="field" value={f.slug} onChange={(e) => set('slug', e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <span className="label">Description</span>
              <RichEditor value={f.description} onChange={(v) => set('description', v)} />
            </div>
          </Box>

          <Box title="Photos">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-muted">Drag to reorder — the first photo is the cover. Use Adjust to frame each photo in the 4:5 shape shoppers see.</p>
              <UploadButton onDone={(files) => set('images', [...f.images, ...files.map((u) => ({ url: `${u.url}#lx=50,50,1`, alt: null, tag: 'MODEL' as const, colourIndex: f.colours.length === 1 ? 0 : null }))])} />
            </div>
            {f.images.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">No photos yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {f.images.map((im, i) => (
                  <li key={`${im.url}-${i}`} {...imgs.bind(i)} className="rounded-card border border-line bg-paper p-2">
                    <div className="relative">
                      <Framed url={im.url} alt="" sizes="200px" className="rounded-xl" />
                      {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] text-ivory">Cover</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <select className="rounded-lg border border-line bg-paper px-2 py-1.5 text-[12px]" value={im.tag} onChange={(e) => setImage(i, { tag: e.target.value as Image['tag'] })} aria-label="Photo type">
                        <option value="MODEL">Model wearing</option>
                        <option value="DETAIL">Fabric detail</option>
                        <option value="FLATLAY">Flat lay / pallu</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <select
                        className="rounded-lg border border-line bg-paper px-2 py-1.5 text-[12px]"
                        value={im.colourIndex ?? ''}
                        onChange={(e) => setImage(i, { colourIndex: e.target.value === '' ? null : Number(e.target.value) })}
                        aria-label="Colour"
                      >
                        <option value="">All colours</option>
                        {f.colours.map((c, ci) => (
                          <option key={ci} value={ci}>
                            {c.colourName || `Colour ${ci + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] hover:bg-blush" onClick={() => setAdjust(i)}>
                        <Crop size={14} /> Adjust
                      </button>
                      <span className="flex">
                        <button type="button" className="rounded-lg p-1.5 hover:bg-blush" onClick={() => imgs.move(i, i - 1)} aria-label="Move earlier">
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" className="rounded-lg p-1.5 hover:bg-blush" onClick={() => imgs.move(i, i + 1)} aria-label="Move later">
                          <ArrowDown size={14} />
                        </button>
                        <button type="button" className="rounded-lg p-1.5 text-danger hover:bg-blush" onClick={() => set('images', f.images.filter((_, j) => j !== i))} aria-label="Remove photo">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Box>

          <Box title="Colours & stock">
            <p className="mb-4 text-[14px] text-muted">Sarees have no sizes — each colour has its own stock and photos.</p>
            <div className="space-y-3">
              {f.colours.map((c, i) => (
                <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[auto_1fr_1fr_100px_110px_auto]">
                  <label className="block">
                    <span className="label">Swatch</span>
                    <input type="color" value={c.hex} onChange={(e) => setColour(i, { hex: e.target.value })} className="h-12 w-14 cursor-pointer rounded-xl border border-line bg-paper" />
                  </label>
                  <Field label="Colour name">
                    <input className="field" value={c.colourName} onChange={(e) => setColour(i, { colourName: e.target.value })} placeholder="e.g. Sindoor Red" />
                  </Field>
                  <Field label="Shop-by-colour group">
                    <select className="field" value={c.family ?? ''} onChange={(e) => setColour(i, { family: e.target.value || null })}>
                      <option value="">—</option>
                      {colourFamilies.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Stock">
                    <input className="field" type="number" min={0} value={c.stock} onChange={(e) => setColour(i, { stock: Math.max(0, Number(e.target.value)) })} />
                  </Field>
                  <Field label="Price ± (₹)">
                    <input className="field" type="number" value={c.priceDelta} onChange={(e) => setColour(i, { priceDelta: Number(e.target.value) })} />
                  </Field>
                  <button type="button" className="mb-1 flex h-11 w-11 items-center justify-center rounded-full text-danger hover:bg-blush disabled:opacity-30" disabled={f.colours.length === 1} onClick={() => set('colours', f.colours.filter((_, j) => j !== i))} aria-label="Remove colour">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="chip mt-3" onClick={() => set('colours', [...f.colours, { colourName: '', hex: '#B8893B', family: null, stock: 1, priceDelta: 0 }])}>
              <Plus size={16} /> Add colour
            </button>
          </Box>

          <Box title="Fabric details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fabric">
                <input className="field" list="fabrics" value={f.fabric} onChange={(e) => set('fabric', e.target.value)} />
                <datalist id="fabrics">
                  {FABRICS.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </Field>
              <Field label="Weave">
                <input className="field" value={f.weave} onChange={(e) => set('weave', e.target.value)} placeholder="Korvai, kadhua, ikat…" />
              </Field>
              <Field label="Work type">
                <select className="field" value={f.work} onChange={(e) => set('work', e.target.value)}>
                  {Object.entries(workLabel).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Origin">
                <input className="field" value={f.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Kanchipuram, Tamil Nadu" />
              </Field>
              <Field label="Border">
                <input className="field" value={f.border} onChange={(e) => set('border', e.target.value)} />
              </Field>
              <Field label="Pallu">
                <input className="field" value={f.pallu} onChange={(e) => set('pallu', e.target.value)} />
              </Field>
              <Field label="Length text">
                <input className="field" value={f.lengthInfo} onChange={(e) => set('lengthInfo', e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <span className="label">Occasions</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(occasionLabel).map(([v, l]) => (
                  <button key={v} type="button" className="chip" aria-pressed={f.occasions.includes(v)} onClick={() => set('occasions', f.occasions.includes(v) ? f.occasions.filter((x) => x !== v) : [...f.occasions, v])}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <span className="label">Care</span>
              <RichEditor value={f.care} onChange={(v) => set('care', v)} minH={80} />
            </div>
          </Box>
        </div>

        <div className="space-y-6">
          <Box title="Visibility">
            <Toggle label="Visible on site" checked={f.isActive} onChange={(v) => set('isActive', v)} />
            <Toggle label="Pin to top of listings" checked={f.isPinned} onChange={(v) => set('isPinned', v)} />
            <Toggle label="Handloom Mark badge" checked={f.handloomMark} onChange={(v) => set('handloomMark', v)} />
            <Toggle label="Blouse piece included" checked={f.blouseIncluded} onChange={(v) => set('blouseIncluded', v)} />
          </Box>
          <Box title="Pricing (₹)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling price">
                <input className="field" type="number" min={0} value={f.price} onChange={(e) => set('price', Number(e.target.value))} />
              </Field>
              <Field label="MRP">
                <input className="field" type="number" min={0} value={f.mrp} onChange={(e) => set('mrp', Number(e.target.value))} />
              </Field>
              <Field label="Fall & pico" hint="0 = not offered">
                <input className="field" type="number" min={0} value={f.falloPicoPrice} onChange={(e) => set('falloPicoPrice', Number(e.target.value))} />
              </Field>
              <Field label="Blouse stitching" hint="0 = not offered">
                <input className="field" type="number" min={0} value={f.stitchingPrice} onChange={(e) => set('stitchingPrice', Number(e.target.value))} />
              </Field>
            </div>
            {f.mrp > f.price && f.price > 0 && <p className="mt-2 text-[13px] text-sage">Shows as {Math.round(((f.mrp - f.price) / f.mrp) * 100)}% off</p>}
          </Box>
          <Box title="Organise">
            <Field label="Category">
              <select className="field" value={f.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || null)}>
                <option value="">—</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <span className="label mt-4">Manual collections</span>
            <div className="flex flex-wrap gap-2">
              {cols
                .filter((c) => !c.isRuleBased)
                .map((c) => (
                  <button key={c.id} type="button" className="chip" aria-pressed={f.collectionIds.includes(c.id)} onClick={() => set('collectionIds', f.collectionIds.includes(c.id) ? f.collectionIds.filter((x) => x !== c.id) : [...f.collectionIds, c.id])}>
                    {c.title}
                  </button>
                ))}
              {cols.every((c) => c.isRuleBased) && <p className="text-[13px] text-muted">All collections are automatic (by fabric/occasion/price).</p>}
            </div>
          </Box>
          <Box title="Search engines">
            <Field label="SEO title" hint={`${f.seoTitle.length}/70`}>
              <input className="field" maxLength={70} value={f.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
            </Field>
            <div className="mt-3">
              <Field label="SEO description" hint={`${f.seoDescription.length}/170`}>
                <textarea className="field" rows={3} maxLength={170} value={f.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} />
              </Field>
            </div>
          </Box>
          {id && (
            <button
              className="w-full rounded-full border border-danger/40 py-3 text-[14px] text-danger hover:bg-danger/10"
              onClick={async () => {
                if (!confirm(`Delete “${f.name}” permanently? Past orders keep their copy. Consider hiding it instead.`)) return;
                await del(`/admin/products/${id}`);
                toast('Deleted');
                nav('/admin/products');
              }}
            >
              Delete saree
            </button>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-ivory/95 p-3 backdrop-blur md:left-64">
        <div className="flex items-center justify-end gap-3">
          <Link to="/admin/products" className="text-[14px] text-muted">
            Back to products
          </Link>
          <button className="btn-primary min-h-[44px] px-8" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : null} Save
          </button>
        </div>
      </div>
      {adjust !== null && f.images[adjust] && (
        <AdjustDialog
          url={f.images[adjust].url}
          onClose={() => setAdjust(null)}
          onSave={(url) => {
            setImage(adjust, { url });
            setAdjust(null);
          }}
        />
      )}
    </div>
  );
}
