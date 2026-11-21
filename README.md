# Tarun Silks — premium handloom saree store

A full e-commerce site for Tarun Silks: an immersive storefront ("woven in light" — a live WebGL silk hero, scroll-told brand story, look-book edits), a complete shop (filters, wishlist, bag, checkout with Razorpay + COD, order tracking, accounts) and a private admin panel.

| Part | Tech |
| --- | --- |
| Storefront + admin | React 18, TypeScript, Vite, Tailwind, React Router, Zustand, installable PWA |
| Motion & 3D | Three.js + React Three Fiber (custom GLSL), GSAP ScrollTrigger, Lenis, Framer Motion |
| API | Node 18+, Express, TypeScript, zod, Prisma 7 (no native engine) + MySQL/MariaDB |
| Auth | Firebase (Google, email/password, phone OTP) + guest checkout |
| Payments | Razorpay (UPI, cards, netbanking, wallets) + Cash on Delivery |
| Deploy | One repo → `npm run build` → `dist/server.js` serves API **and** site |

```
tarun-silks/
├─ client/                 React app (storefront + /admin)
│  ├─ src/pages/           Home, Shop, Product, Checkout, Orders, Account, Content
│  ├─ src/admin/           Admin panel (dashboard, products + photo Adjust, orders…)
│  ├─ src/three/           SilkHero (hero shader) and DrapeViewer (product drape view)
│  ├─ src/components/      Layout, ProductCard, overlays, ornaments (SVG motifs), intro
│  └─ public/              sw.js, manifest, icons, hero poster
├─ server/
│  ├─ prisma/schema.prisma Database model        prisma/init.sql  same thing as SQL
│  ├─ prisma/seed.ts       12 sample sarees, collections, pages, homepage
│  └─ src/                 index.ts, routes/, lib/ (pricing, orders, storage, auth…)
├─ scripts/build.mjs       Production bundle      scripts/make-assets.mjs  icons/poster
└─ .env.example            Every setting, with notes
```

---

## 1. Run it on your computer

Needs Node 18.18+ and a MySQL 8 or MariaDB 10.6+ database (XAMPP's MariaDB works).

```bash
npm install                    # installs root, client and server
cp .env.example .env           # then edit: DATABASE_URL, set NODE_ENV=development, DEV_AUTH_BYPASS=true
cp .env server/.env            # the dev server reads server/.env
```

Create the tables — either:

- **phpMyAdmin / MySQL Workbench:** import `server/prisma/init.sql`, or
- **command line:** `cd server && npx prisma db push`

Then:

```bash
npm run seed                   # 12 sample sarees with generated placeholder photos
npm run dev                    # API on :3000, site on http://localhost:5173
```

With `DEV_AUTH_BYPASS=true` the sign-in page shows a "local testing" box: type the email that is in `ADMIN_EMAILS` and you are an admin at `/admin`. This bypass is ignored whenever `NODE_ENV=production`.

## 2. Configure the services

### Firebase (sign-in)
1. console.firebase.google.com → **Add project**.
2. **Build → Authentication → Sign-in method:** enable **Google**, **Email/Password**, **Phone**.
3. **Authentication → Settings → Authorized domains:** add your domain (e.g. `tarunsilks.in`, `www.tarunsilks.in`).
4. **Project settings → General → Your apps → Web (`</>`):** copy `apiKey`, `authDomain`, `appId` into `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_APP_ID`.
5. **Project settings → Service accounts → Generate new private key:** from the JSON copy `project_id`, `client_email`, `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (keep the `\n`s, wrap in double quotes).
6. Put the owner's email in `ADMIN_EMAILS`.

iPhone note: Google sign-in in the installed app uses a redirect instead of a popup; phone OTP and email are always offered as alternatives.

### Razorpay (online payment)
1. dashboard.razorpay.com → **Account & Settings → API keys** → generate **test** keys first (`rzp_test_…`) → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. **Webhooks → Add:** URL `https://YOUR-DOMAIN/api/webhooks/razorpay`, events `payment.captured`, `order.paid`, `payment.failed`, set a secret → `RAZORPAY_WEBHOOK_SECRET`.
3. Test card: `4111 1111 1111 1111`, any future expiry, any CVV; test UPI: `success@razorpay`.
4. After KYC, swap to live keys. Without keys the site still works with COD only.

### Email
Create `orders@your-domain` in Hostinger → Emails, then fill `SMTP_*`. Without SMTP, emails are skipped (logged) and nothing breaks.

### Location autofill (optional)
"Use my current location" tries Ola Maps → Google → OpenStreetMap. OpenStreetMap needs no key; add `OLA_MAPS_API_KEY` for better Indian addresses.

## 3. Deploy on Hostinger (Node.js Web App + MySQL)

**Database**
1. hPanel → **Databases → MySQL Databases** → create database + user (note the name, user, password).
2. **phpMyAdmin** → select the database → **Import** → choose `server/prisma/init.sql` → Go.

**App**
1. Push this folder to a GitHub repository (the `.gitignore` keeps `.env`, `node_modules`, `dist` and uploads out).
2. hPanel → **Websites → Add website → Node.js Apps → Import Git repository** → pick the repo.
3. Build settings:
   - Node version: **20** (18.18+ works)
   - Install: `npm install`
   - Build command: `npm run build`
   - Start / entry file: `dist/server.js` (start command `npm start`)
4. **Environment variables:** paste everything from `.env.example` with real values, `NODE_ENV=production`, `PUBLIC_URL=https://your-domain`, `DATABASE_URL=mysql://user:pass@localhost:3306/dbname`, and `UPLOAD_DIR` pointing to a folder outside the app folder (e.g. `/home/u123456789/tarun-uploads`) so photos survive redeploys.
5. Deploy. Check `https://your-domain/api/health` → `{"ok":true,"db":"up"}`.
6. Seed the sample catalogue once (optional): hPanel → **Advanced → SSH**, `cd` into the app folder, `npm run seed`. Or start empty and add sarees in the admin.
7. Connect the domain and enable SSL in hPanel.

Every `git push` redeploys the whole site (API + storefront) in one go.

**Hostinger Business/shared hosting without Node.js apps:** this project needs a Node.js app plan (Business Web Hosting with Node.js, Cloud, or VPS).

## 4. Backups

- **Database (daily):** hPanel → **Files → Backups** keeps automatic daily backups on Business/Cloud plans; download one weekly. For your own copy, add a cron job (hPanel → **Advanced → Cron Jobs**, daily at 03:00):
  ```
  mysqldump -u DB_USER -p'DB_PASSWORD' DB_NAME | gzip > $HOME/backups/tarun-$(date +\%F).sql.gz && find $HOME/backups -name 'tarun-*.sql.gz' -mtime +30 -delete
  ```
- **Photos:** back up the `UPLOAD_DIR` folder the same way (`tar czf`), or move images to Cloudflare R2/S3 later — only `server/src/lib/storage.ts` changes (`ImageStorage` interface).
- **Restore:** phpMyAdmin → Import the `.sql`.

## 5. Admin guide (for the shop team)

Open `https://your-domain/admin` and sign in with an email listed in `ADMIN_EMAILS`.

- **Dashboard** — today's orders and revenue, orders to pack, low-stock colours, top sellers.
- **Products → Add saree**
  - Fill name, description (bold and bullet buttons; pasted `*bold*` and `- bullets` are converted automatically), fabric, weave, work, border, pallu, origin, occasions, care.
  - **Colours & stock:** one row per colour with its own stock. Sarees have no sizes. "Shop-by-colour group" decides which colour orb shows it on the home page.
  - **Photos:** Upload several at once (JPEG/PNG/WebP; HEIC must be exported as JPEG). Drag to reorder — first is the cover. Set each photo's type (model / fabric detail / flat lay) and which colour it belongs to. **Adjust** opens the exact 4:5 frame shoppers see: drag to position, slide to zoom, Save framing. The framing is used on every page.
  - **Pricing:** selling price and MRP (shows % off), fall & pico and blouse-stitching prices (0 hides the option).
  - **Visibility:** hide without deleting, pin to the top, Handloom Mark badge.
  - **Duplicate** copies a saree (hidden) — handy for a new colourway.
  - Changes are live within seconds.
- **Bulk edit price & stock** on the Products list for quick restocks.
- **Orders** — filter by status, search by order number/phone/name. Open an order to: move it Placed → Packed → Shipped → Delivered (or Cancel/Return — stock goes back automatically), add courier + AWB + tracking link (customer gets an email), print **Invoice** and **Packing slip** PDFs, see blouse measurements, open the exact delivery location in Google Maps, WhatsApp the customer, refund online payments (full or partial), keep internal notes.
- **Collections** — automatic (by fabric, occasion, price) or hand-picked. Turn on "Editorial look-book page" for Wedding/Festive style pages with their own accent colour. Cover images have the same Adjust tool.
- **Discounts** — percent, flat ₹ or free shipping; minimum bag value, total uses, uses per customer, expiry.
- **Reviews** — approve or reject. Only customers whose order was delivered can review.
- **Homepage** — reorder, hide or edit each block. The hero block has plain fields for the headline, buttons, fallback video and poster.
- **Announcement** — the strip at the very top of the site.
- **Pages** — About, Weavers, Store, Contact, Care guide, Shipping, Returns, Privacy, Terms, FAQ (and new pages).
- **Settings** — store details, WhatsApp number, logo, GSTIN, shipping zones by pincode prefix, free-shipping threshold, gift-wrap price, COD fee/limit/blocked pincodes, Google Analytics + Meta Pixel IDs, newsletter export.

## 6. How the important parts work

- **Prices are never trusted from the browser.** `server/src/lib/pricing.ts` recomputes every line, coupon, shipping, COD fee and total from the database.
- **No overselling.** `createOrder` reserves stock with `UPDATE … SET stock = stock - n WHERE stock >= n` inside a transaction; a second buyer racing for the last piece gets "just sold out". Unpaid online orders hold stock for 30 minutes, then release it.
- **Idempotent orders.** Each checkout attempt carries an idempotency key; retries/double taps return the same order and the same Razorpay order.
- **Payments verified twice.** Browser callback signature check plus the signed webhook; both paths are idempotent.
- **Security.** Helmet CSP, CORS allow-list, rate limits on checkout, coupons (via quote), geocoding, tracking, newsletter; zod on every input; rich text sanitised; uploads checked by file signature; admin routes re-check the allow-list on every request; no secrets in the frontend.
- **Performance.** Three.js loads only on the home hero and product drape view, after a GPU/battery/data-saver check (low-end devices get the poster or video). DPR capped at 2; rendering pauses off-screen; a frame-rate guard falls back automatically. Checkout, bag, account and admin never load WebGL. Images: 600/1600/2600 px WebP + JPEG with `srcset`.
- **PWA.** Service worker: network-first HTML, cache-first hashed assets, never touches video/audio/Range requests or `/api`; shows "A new version is ready — Refresh".
- **SEO.** The server injects title, description, canonical, Open Graph and JSON-LD (Organization, Product + Offer, BreadcrumbList) into every page; `sitemap.xml` and `robots.txt` come from the database.
- **Reduce Motion.** The hero and intro still play; only decorative loops (marquee, shimmer) calm down.

## 7. Feature checklist

| Area | Status |
| --- | --- |
| Living-silk WebGL hero (cursor/touch + scroll reactive, zari border, caustics), poster/video fallback, FPS guard | Done |
| Lenis + ScrollTrigger story (pinned loom → weaver → drape, unfurling saree, gold progress thread) | Done |
| Pinned horizontal fabric gallery with slow zoom + macro-weave hover | Done |
| SVG ornament library (temple border, kalga, kolam, jaali, lotus, peacock) with stroke draw-on; film grain | Done |
| Product drape view (WebGL, tilt + zoom), press-and-hold weave magnifier, pallu/border detail rail | Done |
| Custom cursor, magnetic buttons, 3D tilt cards, fly-to-bag, petal-bloom wishlist heart, view-transition card → product | Done |
| Branded intro (layered, iPhone-safe, skippable, first visit / installed app only) | Done |
| Shop by colour orbs with background flood + morphing results | Done |
| Editorial look-book pages per edit with own accent colour | Done |
| Optional ambient tanpura drone + UI plucks + vibration (off by default) | Done |
| Mega menu, mobile drawer, live search, bottom tab bar, dark mode (Light/Dark/Auto + header toggle) | Done |
| Listing filters (fabric, occasion, colour, work, price, blouse, in stock), sort, shareable URLs, load more | Done |
| Product page: colours with own photos/stock, fall & pico, stitched blouse form, pincode ETA + COD, tabs, WhatsApp, share, reviews, complete the look, related, recently viewed, notify-me | Done |
| Bag drawer, coupons, free-shipping bar, saved addresses, current-location autofill (lat/lng saved), pincode autofill, gift wrap + note | Done |
| Razorpay with server signature + webhook verification, COD with fee/limit/pincode rules, confirmation page, email, WhatsApp text | Done (needs your Razorpay keys) |
| Firebase Google / email / phone OTP, guest checkout, account orders timeline, addresses, track without login | Done (needs your Firebase project) |
| Admin: dashboard, products, colours/stock, photo manager + Adjust, bulk edit, collections, categories, orders + PDFs + refunds + maps link, customers, discounts, reviews, homepage blocks, announcement, pages, settings | Done |
| Abandoned-bag reminder, back-in-stock email, unpaid-order expiry jobs | Done (needs SMTP) |
| SEO meta + JSON-LD + sitemap + robots, GA4 + Meta Pixel (consent-aware) | Done (add your IDs in Settings) |
| One-file production bundle (`node dist/server.js`), `.env.example`, `init.sql`, seed | Done |
| Real logo | Needs your input — Settings → Logo URL, then `npm run assets` for icons |
| Real product photos, store address, policy text, WhatsApp number | Needs your input (admin) |
| Domain, SSL, SMTP mailbox | Needs your input (Hostinger) |

## 8. Acceptance tests run

| # | Test | Result |
| --- | --- | --- |
| 1 | 360px phone: find a saree → pick colour → bag → checkout → order visible in admin | Passed in 11 s (COD; online payment needs your Razorpay test keys to repeat with a test card) |
| 2 | COD order moved Placed → Packed → Shipped → Delivered in admin, invoice PDF generated | Passed |
| 3 | Five buyers at once for the last piece | Exactly one order succeeded, four got "just sold out", stock 0 |
| 4 | Change price + photo framing in admin → visible on site | Passed immediately |
| 5 | Dark mode on checkout and confirmation | Readable |
| 6 | Hero renders WebGL; `?nogl` / weak devices show the poster | Passed in Chrome; test on a real iPhone + Android after deploy |
| 7 | `npm run build` → `node dist/server.js` serves API + site | Passed |
| 8 | Mid-range Android 30+ fps or clean fallback | Built-in FPS guard falls back below 24 fps; verify on a real phone after deploy |
| 9 | Home / collection / product at 390 px and 1440 px | Checked with screenshots; no console errors |

Testing aids: add `?nogl` to any URL to force the fallback, `?forcegl` to force the WebGL scene.

---
Developed by [@kittus.dev](https://instagram.com/kittus.dev)
