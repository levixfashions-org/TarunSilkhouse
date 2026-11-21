/** Small shared building blocks for the admin panel. */
import { Bold, GripVertical, Italic, List, ListOrdered, Move, Upload, X, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { frameStyle, parseFrame, variant, withFrame, type Frame } from '@/lib/image';
import { getAdminToken } from './token';

export function PageHead({ title, actions, sub }: { title: string; actions?: ReactNode; sub?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[2.2rem] leading-tight">{title}</h1>
        {sub && <p className="text-[14px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Box({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {title && <h2 className="mb-4 font-serif text-xl">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3">
      <span className="text-[14px]">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-maroon' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

/**
 * Minimal rich text editor (bold, italic, lists). Outputs HTML; the server sanitises it.
 * Pasted "*bold*" / "- bullet" text is also converted server-side, so customers never see raw asterisks.
 */
export function RichEditor({ value, onChange, minH = 140 }: { value: string; onChange: (html: string) => void; minH?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cmd = (c: string) => {
    document.execCommand(c);
    onChange(ref.current!.innerHTML);
    ref.current!.focus();
  };
  const btn = 'flex h-9 w-9 items-center justify-center rounded-lg hover:bg-blush';
  return (
    <div className="rounded-xl border border-line bg-paper focus-within:border-gold">
      <div className="flex gap-1 border-b border-line p-1">
        <button type="button" className={btn} onClick={() => cmd('bold')} aria-label="Bold">
          <Bold size={16} />
        </button>
        <button type="button" className={btn} onClick={() => cmd('italic')} aria-label="Italic">
          <Italic size={16} />
        </button>
        <button type="button" className={btn} onClick={() => cmd('insertUnorderedList')} aria-label="Bullet list">
          <List size={16} />
        </button>
        <button type="button" className={btn} onClick={() => cmd('insertOrderedList')} aria-label="Numbered list">
          <ListOrdered size={16} />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="rich px-4 py-3 text-[15px] outline-none"
        style={{ minHeight: minH }}
        onInput={() => onChange(ref.current!.innerHTML)}
        onPaste={(e) => {
          // paste as plain text to avoid Word/Docs styling; markdown-ish marks are converted on save
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
      />
    </div>
  );
}

/** Upload with progress (fetch can't report upload progress, so XHR). */
export function uploadFiles(files: File[], opts: { keepOriginal?: boolean; onProgress?: (pct: number) => void } = {}) {
  return new Promise<{ url: string; thumb: string; bytes: number; savedBytes: number; name: string }[]>(async (resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    if (opts.keepOriginal) fd.append('keepOriginal', 'true');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    const token = await getAdminToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 400) reject(new Error(data?.error?.message ?? 'Upload failed'));
      else resolve(data.files);
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(fd);
  });
}

export function UploadButton({ onDone, multiple = true, keepOriginal = false, label = 'Upload photos' }: { onDone: (urls: { url: string; name: string; bytes: number; savedBytes: number }[]) => void; multiple?: boolean; keepOriginal?: boolean; label?: string }) {
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button type="button" className="btn-ghost min-h-[42px] px-5" onClick={() => input.current?.click()} disabled={pct !== null}>
        <Upload size={16} /> {pct !== null ? `Uploading ${pct}%` : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={multiple}
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          setPct(0);
          setMsg(null);
          try {
            const r = await uploadFiles(files, { keepOriginal, onProgress: setPct });
            const before = r.reduce((s, f) => s + f.bytes, 0);
            const saved = r.reduce((s, f) => s + f.savedBytes, 0);
            setMsg(`${r.length} photo${r.length > 1 ? 's' : ''} uploaded · ${(before / 1048576).toFixed(1)} MB → ${((before - saved) / 1048576).toFixed(1)} MB for shoppers`);
            onDone(r);
          } catch (err) {
            setMsg((err as Error).message);
          } finally {
            setPct(null);
          }
        }}
      />
      {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
    </div>
  );
}

/**
 * Adjust tool: drag to position and slide to zoom inside the exact 4:5 frame shoppers see.
 * The framing is stored in the image link as #lx=x,y,zoom so every page honours it.
 */
export function AdjustDialog({ url, onClose, onSave, ratio = 125 }: { url: string; onClose: () => void; onSave: (url: string) => void; ratio?: number }) {
  const { src, frame } = parseFrame(url);
  const [f, setF] = useState<Frame>(frame);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; f: Frame } | null>(null);
  return (
    <div className="fixed left-0 top-0 z-[100] flex h-full w-full items-center justify-center bg-ink/60 p-4" role="dialog" aria-label="Adjust photo">
      <div className="w-full max-w-md rounded-sheet bg-ivory p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Adjust photo</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div
          ref={box}
          className="frame cursor-move touch-none rounded-card"
          style={{ paddingBottom: `${ratio}%` }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, f };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const r = box.current!.getBoundingClientRect();
            const dx = ((e.clientX - drag.current.x) / r.width) * 100 / f.zoom;
            const dy = ((e.clientY - drag.current.y) / r.height) * 100 / f.zoom;
            setF({ ...f, x: Math.min(100, Math.max(0, drag.current.f.x - dx)), y: Math.min(100, Math.max(0, drag.current.f.y - dy)) });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onWheel={(e) => setF({ ...f, zoom: Math.min(4, Math.max(1, f.zoom - e.deltaY * 0.002)) })}
        >
          <img src={variant(src, 'main')} alt="" draggable={false} className="pointer-events-none" style={frameStyle(f)} />
          <div className="pointer-events-none absolute left-1/3 top-0 h-full w-1/3 border-x border-white/40" />
          <div className="pointer-events-none absolute left-0 top-1/3 h-1/3 w-full border-y border-white/40" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ZoomIn size={18} className="text-muted" />
          <input type="range" min={1} max={4} step={0.01} value={f.zoom} onChange={(e) => setF({ ...f, zoom: Number(e.target.value) })} className="flex-1 accent-[rgb(var(--maroon))]" aria-label="Zoom" />
          <span className="w-12 text-right text-[13px] tabular-nums">{f.zoom.toFixed(2)}×</span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
          <Move size={14} /> Drag the photo to choose what stays in frame.
        </p>
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost min-h-[44px] flex-1" onClick={() => setF({ x: 50, y: 50, zoom: 1 })}>
            Reset
          </button>
          <button className="btn-primary min-h-[44px] flex-1" onClick={() => onSave(withFrame(src, f))}>
            Save framing
          </button>
        </div>
      </div>
    </div>
  );
}

/** Drag-to-reorder list helper (HTML5 drag; also has up/down buttons for touch + keyboard). */
export function useReorder<T>(items: T[], setItems: (v: T[]) => void) {
  const from = useRef<number | null>(null);
  const move = (a: number, b: number) => {
    if (b < 0 || b >= items.length || a === b) return;
    const next = [...items];
    const [x] = next.splice(a, 1);
    next.splice(b, 0, x);
    setItems(next);
  };
  const bind = (i: number) => ({
    draggable: true,
    onDragStart: () => {
      from.current = i;
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: () => {
      if (from.current !== null) move(from.current, i);
      from.current = null;
    },
  });
  return { bind, move, Grip: GripVertical };
}

export const adminFetch = api;
