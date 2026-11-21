import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Home, Menu, Moon, Search, ShoppingBag, Store, Sun, User, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { colourFamilies, occasionLabel, waLink } from '@/lib/format';
import { useAuth, useBag, useBoot, useUI, useWish } from '@/store';
import { Kolam, TempleBorder, Wordmark } from './Ornaments';
import { EASE } from './ui';

function Instagram({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AnnouncementBar() {
  const s = useBoot((b) => b.boot?.store);
  if (!s?.announcementVisible || !s.announcement) return null;
  return (
    <div className="bg-maroon text-ivory dark:bg-[#3a141b] dark:text-[#f3ece2]">
      <p className="page-x py-2 text-center text-[13px] leading-snug">{s.announcement}</p>
    </div>
  );
}

const MEGA = {
  Fabric: ['Kanjivaram', 'Banarasi', 'Paithani', 'Chanderi', 'Gadwal', 'Pochampally', 'Tussar', 'Linen', 'Cotton', 'Organza', 'Soft Silk'],
  Occasion: Object.keys(occasionLabel),
  Price: [
    ['Under ₹5,000', 'max=5000'],
    ['₹5,000 – ₹15,000', 'min=5000&max=15000'],
    ['Above ₹15,000', 'min=15000'],
  ] as [string, string][],
};

function MegaMenu({ onClose }: { onClose: () => void }) {
  const boot = useBoot((b) => b.boot);
  const edits = boot?.collections.filter((c) => c.isEditorial) ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="absolute left-0 top-full w-full border-b border-line bg-ivory/95 shadow-[0_30px_60px_-30px_rgba(27,22,18,.25)] backdrop-blur-xl"
      onMouseLeave={onClose}
    >
      <div className="page-x grid grid-cols-12 gap-8 py-10">
        <div className="col-span-3">
          <h3 className="mb-4 font-serif text-xl">Fabric</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
            {MEGA.Fabric.map((f) => (
              <li key={f}>
                <Link onClick={onClose} to={`/shop?fabric=${encodeURIComponent(f)}`} className="hover:text-maroon">
                  {f}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-2">
          <h3 className="mb-4 font-serif text-xl">Occasion</h3>
          <ul className="space-y-2 text-[15px]">
            {MEGA.Occasion.map((o) => (
              <li key={o}>
                <Link onClick={onClose} to={`/shop?occasion=${o}`} className="hover:text-maroon">
                  {occasionLabel[o]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-2">
          <h3 className="mb-4 font-serif text-xl">Colour</h3>
          <ul className="space-y-2 text-[15px]">
            {colourFamilies.slice(0, 8).map((c) => (
              <li key={c.value}>
                <Link onClick={onClose} to={`/shop?colour=${c.value}`} className="inline-flex items-center gap-2 hover:text-maroon">
                  <span className="h-3 w-3 rounded-full border border-ink/10" style={{ background: c.hex }} />
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="mb-3 mt-6 font-serif text-xl">Price</h3>
          <ul className="space-y-2 text-[15px]">
            {MEGA.Price.map(([l, q]) => (
              <li key={q}>
                <Link onClick={onClose} to={`/shop?${q}`} className="hover:text-maroon">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-5 grid grid-cols-3 gap-4">
          {edits.slice(0, 3).map((c) => (
            <Link key={c.handle} to={`/edits/${c.handle}`} onClick={onClose} className="group block" data-cursor="view">
              <div className="frame rounded-card">
                {c.image && <img src={c.image.split('#')[0].replace('main.webp', 'thumb.webp')} alt="" className="transition-transform duration-1200 ease-silk group-hover:scale-105" loading="lazy" />}
              </div>
              <p className="mt-3 font-serif text-lg leading-tight">{c.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function Header() {
  const [mega, setMega] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const count = useBag((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const openBag = useBag((s) => s.setOpen);
  const wishCount = useWish((s) => s.ids.length);
  const { setSearch, setMenu, toggleDark, sound, setSound } = useUI();
  const user = useAuth((s) => s.user);
  const logo = useBoot((b) => b.boot?.store.logoUrl);
  const onHome = pathname === '/';

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setMega(false), [pathname]);

  const glass = scrolled || mega || !onHome;
  const overHero = onHome && !glass; // light text over the dark silk hero
  const iconBtn = 'flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-ink/5';

  return (
    <header
      className={`sticky top-0 z-[60] transition-[background-color,border-color,backdrop-filter] duration-600 ease-silk ${glass ? 'border-b border-line/70 bg-ivory/80 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'} ${overHero ? 'text-[#FBF7F0] [&_.text-maroon]:!text-[#E6C27A]' : ''}`}
      style={{ WebkitBackdropFilter: glass ? 'blur(20px)' : undefined }}
    >
      <div className="page-x relative flex h-[var(--header-h)] items-center justify-between gap-2 md:gap-4">
        <div className="flex flex-1 items-center gap-1 lg:gap-6">
          <button className={`${iconBtn} lg:hidden`} onClick={() => setMenu(true)} aria-label="Open menu">
            <Menu size={22} strokeWidth={1.5} />
          </button>
          <nav className="hidden items-center gap-7 text-[15px] lg:flex" aria-label="Main">
            <button onMouseEnter={() => setMega(true)} onClick={() => setMega((m) => !m)} aria-expanded={mega} className="py-5 hover:text-maroon">
              Shop
            </button>
            <NavLink to="/edits/wedding-edit" className="py-5 hover:text-maroon">
              Wedding
            </NavLink>
            <NavLink to="/edits/festive-edit" className="py-5 hover:text-maroon">
              Festive
            </NavLink>
            <NavLink to="/pages/weavers" className="py-5 hover:text-maroon">
              Our weavers
            </NavLink>
          </nav>
        </div>

        <Link to="/" className="shrink-0" aria-label="Tarun Silks home">
          <Wordmark logoUrl={logo} />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-0.5">
          <button className={iconBtn} onClick={() => setSearch(true)} aria-label="Search">
            <Search size={20} strokeWidth={1.5} />
          </button>
          <button className={`${iconBtn} hidden md:flex`} onClick={toggleDark} aria-label="Toggle dark mode">
            <Moon size={19} strokeWidth={1.5} className="dark:hidden" />
            <Sun size={19} strokeWidth={1.5} className="hidden dark:block" />
          </button>
          <button className={`${iconBtn} hidden md:flex`} onClick={() => setSound(!sound)} aria-label={sound ? 'Mute ambient sound' : 'Play ambient sound'} aria-pressed={sound}>
            {sound ? <Volume2 size={19} strokeWidth={1.5} /> : <VolumeX size={19} strokeWidth={1.5} />}
          </button>
          <Link to="/wishlist" className={`${iconBtn} relative hidden md:flex`} aria-label={`Wishlist (${wishCount})`}>
            <Heart size={20} strokeWidth={1.5} />
            {wishCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-maroon" />}
          </Link>
          <Link to={user ? '/account' : '/signin'} className={`${iconBtn} hidden md:flex`} aria-label="Account">
            <User size={20} strokeWidth={1.5} />
          </Link>
          <button className={`${iconBtn} relative`} onClick={() => openBag(true)} aria-label={`Bag (${count} items)`} id="bag-icon">
            <ShoppingBag size={20} strokeWidth={1.5} />
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-maroon px-1 text-[11px] font-semibold text-ivory dark:bg-gold dark:text-[#1B1612]"
              >
                {count}
              </motion.span>
            )}
          </button>
        </div>
      </div>
      <AnimatePresence>{mega && <MegaMenu onClose={() => setMega(false)} />}</AnimatePresence>
    </header>
  );
}

export function MobileDrawer() {
  const { menuOpen, setMenu, theme, setTheme, sound, setSound } = useUI();
  const boot = useBoot((b) => b.boot);
  const { pathname } = useLocation();
  useEffect(() => setMenu(false), [pathname, setMenu]);
  const close = () => setMenu(false);
  return (
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          className="fixed left-0 top-0 z-[90] flex h-full w-full flex-col bg-ivory"
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: 0.8, ease: EASE }}
          data-lenis-prevent
        >
          <div className="page-x flex h-[var(--header-h)] items-center justify-between">
            <Wordmark logoUrl={boot?.store.logoUrl} />
            <button onClick={close} className="flex h-11 w-11 items-center justify-center" aria-label="Close menu">
              <X size={24} strokeWidth={1.5} />
            </button>
          </div>
          <nav className="page-x flex-1 overflow-y-auto pb-10 pt-6" aria-label="Mobile">
            <ul className="space-y-1 font-serif text-[2.4rem] leading-[1.15]">
              {[
                ['/shop', 'Shop all'],
                ['/edits/wedding-edit', 'Wedding edit'],
                ['/edits/festive-edit', 'Festive edit'],
                ['/edits/everyday-silk', 'Everyday silk'],
                ['/pages/weavers', 'Our weavers'],
              ].map(([to, l], i) => (
                <motion.li key={to} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: EASE }}>
                  <Link to={to} className="block py-1">
                    {l}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <TempleBorder className="my-8 h-4 w-full text-gold" />
            <h3 className="mb-3 text-[14px] font-medium text-muted">By fabric</h3>
            <div className="flex flex-wrap gap-2">
              {MEGA.Fabric.map((f) => (
                <Link key={f} to={`/shop?fabric=${encodeURIComponent(f)}`} className="chip">
                  {f}
                </Link>
              ))}
            </div>
            <h3 className="mb-3 mt-8 text-[14px] font-medium text-muted">Appearance</h3>
            <div className="flex gap-2">
              {(['light', 'dark', 'auto'] as const).map((t) => (
                <button key={t} className="chip capitalize" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                  {t}
                </button>
              ))}
            </div>
            <button className="chip mt-3" aria-pressed={sound} onClick={() => setSound(!sound)}>
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Ambient sound {sound ? 'on' : 'off'}
            </button>
            <div className="mt-8 flex gap-4 text-[15px]">
              <Link to="/track">Track order</Link>
              <Link to="/pages/contact">Contact</Link>
              <Link to="/pages/faq">FAQ</Link>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TabBar() {
  const { setSearch } = useUI();
  const user = useAuth((s) => s.user);
  const wish = useWish((s) => s.ids.length);
  const { pathname } = useLocation();
  if (/^\/(products|checkout|admin)/.test(pathname)) return null; // product page has its own sticky buy bar
  const item = 'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-muted aria-[current=page]:text-ink';
  return (
    <nav
      className="safe-bottom fixed bottom-0 left-0 z-[55] w-full border-t border-line bg-ivory/90 backdrop-blur-xl md:hidden"
      style={{ WebkitBackdropFilter: 'blur(20px)' }}
      aria-label="Quick"
    >
      <div className="flex h-[var(--tabbar-h)]">
        <NavLink to="/" end className={item}>
          <Home size={21} strokeWidth={1.5} />
          Home
        </NavLink>
        <NavLink to="/shop" className={item}>
          <Store size={21} strokeWidth={1.5} />
          Shop
        </NavLink>
        <button className={item} onClick={() => setSearch(true)}>
          <Search size={21} strokeWidth={1.5} />
          Search
        </button>
        <NavLink to="/wishlist" className={`${item} relative`}>
          <Heart size={21} strokeWidth={1.5} />
          Wishlist
          {wish > 0 && <span className="absolute right-[30%] top-2 h-1.5 w-1.5 rounded-full bg-maroon" />}
        </NavLink>
        <NavLink to={user ? '/account' : '/signin'} className={item}>
          <User size={21} strokeWidth={1.5} />
          Account
        </NavLink>
      </div>
    </nav>
  );
}

export function Footer() {
  const s = useBoot((b) => b.boot?.store);
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-[#1B1612] pb-[calc(var(--tabbar-h)+24px)] text-[#E9DFD2] md:pb-10">
      <div className="zari-band" aria-hidden />
      <Kolam className="pointer-events-none absolute -right-10 top-16 h-72 w-72 text-[#B8893B]/15" />
      <div className="page-x relative grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="max-w-sm font-serif text-[2rem] leading-tight text-[#FBF7F0]">Handloom sarees, chosen thread by thread since 1987.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {s?.whatsapp && (
              <a className="btn border border-[#E9DFD2]/30 text-[#FBF7F0] hover:bg-[#FBF7F0] hover:text-[#1B1612]" href={waLink(s.whatsapp, 'Hello Tarun Silks!')} target="_blank" rel="noreferrer">
                Chat on WhatsApp
              </a>
            )}
            {s?.instagram && (
              <a className="btn border border-[#E9DFD2]/30 text-[#FBF7F0] hover:bg-[#FBF7F0] hover:text-[#1B1612]" href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noreferrer">
                <Instagram size={18} /> Instagram
              </a>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 text-[15px] md:col-span-7 md:grid-cols-3">
          <div>
            <h4 className="mb-4 font-serif text-xl text-[#FBF7F0]">Shop</h4>
            <ul className="space-y-2.5 text-[#E9DFD2]/80">
              <li><Link to="/shop">All sarees</Link></li>
              <li><Link to="/collections/kanjivaram">Kanjivaram</Link></li>
              <li><Link to="/collections/banarasi">Banarasi</Link></li>
              <li><Link to="/edits/wedding-edit">Wedding edit</Link></li>
              <li><Link to="/collections/under-5000">Under ₹5,000</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-serif text-xl text-[#FBF7F0]">Help</h4>
            <ul className="space-y-2.5 text-[#E9DFD2]/80">
              <li><Link to="/track">Track your order</Link></li>
              <li><Link to="/pages/shipping">Shipping</Link></li>
              <li><Link to="/pages/returns">Returns &amp; exchange</Link></li>
              <li><Link to="/pages/care-guide">Saree care</Link></li>
              <li><Link to="/pages/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-serif text-xl text-[#FBF7F0]">About</h4>
            <ul className="space-y-2.5 text-[#E9DFD2]/80">
              <li><Link to="/pages/about">Our story</Link></li>
              <li><Link to="/pages/weavers">Our weavers</Link></li>
              <li><Link to="/pages/store-locator">Visit the store</Link></li>
              <li><Link to="/journal">Journal</Link></li>
              <li><Link to="/pages/contact">Contact</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="page-x flex flex-col gap-3 border-t border-[#E9DFD2]/15 pt-6 text-[13px] text-[#E9DFD2]/60 md:flex-row md:items-center md:justify-between">
        <p>© {year} {s?.storeName ?? 'Tarun Silks'}. Prices include GST. Secure payments by Razorpay — UPI, cards, netbanking.</p>
        <p className="flex gap-4">
          <Link to="/pages/privacy">Privacy</Link>
          <Link to="/pages/terms">Terms</Link>
          <a href="https://instagram.com/kittus.dev" target="_blank" rel="noreferrer" className="hover:text-[#FBF7F0]">
            Developed by @kittus.dev
          </a>
        </p>
      </div>
    </footer>
  );
}
