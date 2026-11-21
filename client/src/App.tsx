import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnnouncementBar, Footer, Header, MobileDrawer, TabBar } from '@/components/Layout';
import { Cursor, SmoothScroll } from '@/components/Motion';
import { Intro } from '@/components/Intro';
import { BagDrawer, ConsentBanner, SearchOverlay, UpdatePrompt } from '@/components/Overlays';
import { EASE, Spinner, Toasts } from '@/components/ui';
import { pageview } from '@/lib/analytics';
import { initAuth } from '@/lib/auth';
import { useBoot } from '@/store';
import Home from '@/pages/Home';

const Shop = lazy(() => import('@/pages/Shop'));
const Product = lazy(() => import('@/pages/Product'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const Orders = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.OrderConfirmed })));
const Track = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.Track })));
const SignIn = lazy(() => import('@/pages/Account').then((m) => ({ default: m.SignIn })));
const Account = lazy(() => import('@/pages/Account').then((m) => ({ default: m.Account })));
const Wishlist = lazy(() => import('@/pages/Account').then((m) => ({ default: m.Wishlist })));
const ContentPage = lazy(() => import('@/pages/Content').then((m) => ({ default: m.ContentPage })));
const Journal = lazy(() => import('@/pages/Content').then((m) => ({ default: m.Journal })));
const NotFound = lazy(() => import('@/pages/Content').then((m) => ({ default: m.NotFound })));
const Admin = lazy(() => import('@/admin/Admin'));

function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-gold">
      <Spinner />
    </div>
  );
}

function Storefront() {
  const location = useLocation();
  const shopKey = location.pathname.split('/').slice(0, 3).join('/');
  return (
    <>
      <Intro />
      <AnnouncementBar />
      <Header />
      <main id="main" className="min-h-[70vh]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={shopKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            <Suspense fallback={<Loading />}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/collections/:handle" element={<Shop />} />
                <Route path="/edits/:handle" element={<Shop editorial />} />
                <Route path="/products/:slug" element={<Product />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/bag" element={<Checkout />} />
                <Route path="/order/:number" element={<Orders />} />
                <Route path="/track" element={<Track />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/account/*" element={<Account />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/pages/:slug" element={<ContentPage />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <TabBar />
      <MobileDrawer />
      <SearchOverlay />
      <BagDrawer />
      <ConsentBanner />
      <Cursor />
    </>
  );
}

export default function App() {
  const { boot, error, load } = useBoot();
  const location = useLocation();

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (boot) void initAuth();
  }, [boot]);
  useEffect(() => {
    pageview(location.pathname);
  }, [location.pathname]);

  if (error && !boot)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
        <p className="font-serif text-3xl">We could not reach the store</p>
        <p className="mt-2 text-muted">{error}</p>
        <button className="btn-primary mt-6" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  if (!boot) return <div className="min-h-screen bg-ivory" />;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <SmoothScroll />
      {location.pathname.startsWith('/admin') ? (
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/admin/*" element={<Admin />} />
          </Routes>
        </Suspense>
      ) : (
        <Storefront />
      )}
      <Toasts />
      <UpdatePrompt />
    </>
  );
}
