import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Draw, Kolam, Peacock, TempleBorder } from '@/components/Ornaments';
import { Empty, Reveal, RichText, Spinner } from '@/components/ui';
import { cached } from '@/lib/api';
import { useSeo } from '@/lib/hooks';
import { useBoot } from '@/store';

type Page = { slug: string; title: string; body: string; seoTitle: string | null };

export function ContentPage() {
  const { slug = '' } = useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [missing, setMissing] = useState(false);
  const store = useBoot((b) => b.boot?.store);
  useSeo(page?.seoTitle || page?.title);
  useEffect(() => {
    setPage(null);
    setMissing(false);
    cached<{ page: Page }>(`/pages/${slug}`, 30_000)
      .then((r) => setPage(r.page))
      .catch(() => setMissing(true));
  }, [slug]);
  if (missing) return <NotFound />;
  if (!page)
    return (
      <div className="flex justify-center py-32">
        <Spinner />
      </div>
    );
  return (
    <article className="relative overflow-hidden">
      <Kolam className="pointer-events-none absolute -right-16 top-10 h-72 w-72 text-gold/15" />
      <div className="page-x relative max-w-3xl py-14 md:py-24">
        <Reveal lines={[page.title]} as="h1" className="font-serif text-d-2" />
        <TempleBorder className="my-8 h-4 w-40 text-gold" />
        <RichText html={page.body} className="text-[17px] leading-[1.75]" />
        {slug === 'contact' && store && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <a className="card block p-5" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer">
              <p className="font-serif text-xl">WhatsApp</p>
              <p className="text-muted">+{store.whatsapp}</p>
            </a>
            <a className="card block p-5" href={`mailto:${store.email}`}>
              <p className="font-serif text-xl">Email</p>
              <p className="text-muted">{store.email}</p>
            </a>
          </div>
        )}
        {slug === 'store-locator' && store?.address && (
          <div className="mt-10 card p-5">
            <p className="font-serif text-xl">{store.storeName}</p>
            <p className="text-muted">{store.address}</p>
            {store.mapUrl && (
              <a href={store.mapUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-4">
                Open in Google Maps
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function Journal() {
  useSeo('Journal — stories from the loom');
  return (
    <div className="page-x max-w-3xl py-16 text-center md:py-24">
      <Draw className="mx-auto mb-8 w-40 text-gold">
        <Peacock />
      </Draw>
      <h1 className="font-serif text-d-2">The Journal</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">Weaver stories, draping guides and the history behind every fabric. The first stories are being written.</p>
      <Link to="/pages/weavers" className="btn-primary mt-8">
        Meet our weavers
      </Link>
    </div>
  );
}

export function NotFound() {
  useSeo('Page not found');
  return <Empty title="This thread leads nowhere" body="The page you are looking for has moved or never existed." action={<Link to="/shop" className="btn-primary">Browse sarees</Link>} />;
}
