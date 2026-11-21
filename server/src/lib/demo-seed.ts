/**
 * Seeds 12 realistic sarees, collections, categories, homepage blocks, pages and a test coupon.
 * Placeholder images are drawn as SVG "fabric" artwork and stored through the normal image pipeline,
 * so they behave exactly like real uploads — replace them from Admin → Products → Photos.
 *
 * Used by `npm run seed` and automatically on the first start of an empty database.
 */
import sharp from 'sharp';
import { prisma } from '../db.ts';
import { storeImage } from './storage.ts';

type Pattern = 'zari-checks' | 'buttis' | 'paisley' | 'stripes' | 'jaal' | 'plain';

function sareeSvg(base: string, accent: string, pattern: Pattern, view: 'drape' | 'detail' | 'pallu') {
  const W = 800;
  const H = 1000;
  const gold = '#C9A24B';
  const motif = {
    'zari-checks': `<pattern id="m" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M0 30H60M30 0V60" stroke="${gold}" stroke-width="2" opacity=".55"/><circle cx="30" cy="30" r="4" fill="${gold}"/></pattern>`,
    buttis: `<pattern id="m" width="70" height="80" patternUnits="userSpaceOnUse"><path d="M35 20c8 8 8 20 0 26c-8-6-8-18 0-26z" fill="${gold}" opacity=".85"/><circle cx="0" cy="60" r="3" fill="${gold}"/><circle cx="70" cy="60" r="3" fill="${gold}"/></pattern>`,
    paisley: `<pattern id="m" width="90" height="110" patternUnits="userSpaceOnUse"><path d="M45 20c22 0 30 30 12 48c-10 10-30 12-34-4c-3-14 14-16 18-6" fill="none" stroke="${gold}" stroke-width="3" opacity=".8"/></pattern>`,
    stripes: `<pattern id="m" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="6" height="40" fill="${accent}" opacity=".45"/><rect x="10" width="2" height="40" fill="${gold}" opacity=".7"/></pattern>`,
    jaal: `<pattern id="m" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M40 0L80 40L40 80L0 40Z" fill="none" stroke="${gold}" stroke-width="2" opacity=".6"/><circle cx="40" cy="40" r="6" fill="${accent}" opacity=".8"/></pattern>`,
    plain: `<pattern id="m" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="none"/><path d="M0 4H8" stroke="#fff" opacity=".05"/></pattern>`,
  }[pattern];

  const temple = (y: number, flip = false) =>
    `<g transform="translate(0 ${y}) ${flip ? 'scale(1 -1)' : ''}">${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 40} 0 l20 -26 l20 26z" fill="${gold}"/>`).join('')}</g>`;

  const folds = Array.from({ length: 9 }, (_, i) => {
    const x = 60 + i * 85;
    return `<path d="M${x} 0 C ${x + 30} 300, ${x - 30} 650, ${x + 10} ${H}" stroke="#000" stroke-opacity=".10" stroke-width="22" fill="none"/>
            <path d="M${x + 14} 0 C ${x + 44} 300, ${x - 16} 650, ${x + 24} ${H}" stroke="#fff" stroke-opacity=".10" stroke-width="6" fill="none"/>`;
  }).join('');

  const body =
    view === 'pallu'
      ? `<rect width="${W}" height="${H}" fill="${accent}"/>
         <rect y="120" width="${W}" height="760" fill="url(#m)"/>
         ${[200, 360, 520, 680].map((y) => `<rect y="${y}" width="${W}" height="14" fill="${gold}" opacity=".9"/>`).join('')}
         ${temple(120)}${temple(880, true)}`
      : view === 'detail'
        ? `<rect width="${W}" height="${H}" fill="${base}"/>
           <g transform="scale(2.4)"><rect width="${W}" height="${H}" fill="url(#m)"/></g>
           <rect y="720" width="${W}" height="280" fill="${accent}"/>
           <rect y="740" width="${W}" height="10" fill="${gold}"/>${temple(800)}
           <rect y="960" width="${W}" height="10" fill="${gold}"/>`
        : `<rect width="${W}" height="${H}" fill="${base}"/>
           <rect width="${W}" height="${H}" fill="url(#m)"/>
           <rect y="${H - 190}" width="${W}" height="190" fill="${accent}"/>
           <rect y="${H - 200}" width="${W}" height="12" fill="${gold}"/>
           ${temple(H - 140)}
           <rect y="${H - 70}" width="${W}" height="6" fill="${gold}"/>
           ${folds}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${motif}
      <radialGradient id="sheen" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
    </defs>
    ${body}
    <rect width="${W}" height="${H}" fill="url(#sheen)"/>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
  </svg>`;
}

async function art(base: string, accent: string, pattern: Pattern, view: 'drape' | 'detail' | 'pallu') {
  const png = await sharp(Buffer.from(sareeSvg(base, accent, pattern, view))).jpeg({ quality: 90 }).toBuffer();
  const s = await storeImage(png);
  return s.main;
}

const P = (rupees: number) => rupees * 100;

const SAREES: {
  name: string;
  fabric: string;
  weave: string;
  work: string;
  border: string;
  pallu: string;
  origin: string;
  occasions: string[];
  price: number;
  mrp: number;
  pattern: Pattern;
  handloom: boolean;
  description: string;
  colours: { name: string; hex: string; accent: string; family: string; stock: number }[];
}[] = [
  {
    name: 'Rani Kalka Kanjivaram',
    fabric: 'Kanjivaram',
    weave: 'Korvai',
    work: 'zari',
    border: 'Contrast temple border in pure zari',
    pallu: 'Rich pallu with kalka (mango) motifs',
    origin: 'Kanchipuram, Tamil Nadu',
    occasions: ['wedding', 'festive'],
    price: 24999,
    mrp: 29999,
    pattern: 'paisley',
    handloom: true,
    description:
      'Woven over 18 days on a three-shuttle loom, the **Rani Kalka** pairs a jewel-toned body with a contrast korvai border.\n- Pure mulberry silk, 3-ply\n- Tested zari with silver core\n- Silk Mark certified',
    colours: [
      { name: 'Sindoor Red', hex: '#B3282D', accent: '#5B1220', family: 'red', stock: 3 },
      { name: 'Peacock Teal', hex: '#0F6B6B', accent: '#5B1220', family: 'green', stock: 2 },
      { name: 'Turmeric', hex: '#D9A21B', accent: '#6B1F2A', family: 'gold', stock: 1 },
      { name: 'Jamun', hex: '#5A2160', accent: '#B8893B', family: 'purple', stock: 4 },
    ],
  },
  {
    name: 'Meenakari Banarasi Katan',
    fabric: 'Banarasi',
    weave: 'Kadhua',
    work: 'zari',
    border: 'Floral bel border',
    pallu: 'Meenakari pallu with jangla jaal',
    origin: 'Varanasi, Uttar Pradesh',
    occasions: ['wedding', 'festive', 'party'],
    price: 18999,
    mrp: 22999,
    pattern: 'jaal',
    handloom: true,
    description: 'A pure katan silk Banarasi with **meenakari** colour work hand-picked into every motif. Light enough to drape all evening.',
    colours: [
      { name: 'Rani Pink', hex: '#C2185B', accent: '#4A0E2A', family: 'pink', stock: 4 },
      { name: 'Royal Blue', hex: '#283593', accent: '#B8893B', family: 'blue', stock: 2 },
    ],
  },
  {
    name: 'Peshwai Paithani',
    fabric: 'Paithani',
    weave: 'Tapestry',
    work: 'zari',
    border: 'Asavali border',
    pallu: 'Muniya (parrot) and lotus pallu',
    origin: 'Yeola, Maharashtra',
    occasions: ['wedding', 'festive'],
    price: 29999,
    mrp: 34999,
    pattern: 'buttis',
    handloom: true,
    description: 'True tapestry weave — the **pallu looks identical on both sides**. Parrots and lotuses bloom across a kaleidoscopic shot-silk body.',
    colours: [
      { name: 'Kaleidoscope Green', hex: '#2E7D32', accent: '#880E4F', family: 'green', stock: 2 },
      { name: 'Mor Pankhi', hex: '#1565C0', accent: '#AD1457', family: 'blue', stock: 1 },
    ],
  },
  {
    name: 'Chandrika Chanderi',
    fabric: 'Chanderi',
    weave: 'Silk-cotton',
    work: 'zari',
    border: 'Narrow zari border',
    pallu: 'Coin-butta pallu',
    origin: 'Chanderi, Madhya Pradesh',
    occasions: ['office', 'festive', 'gifting'],
    price: 5499,
    mrp: 6499,
    pattern: 'buttis',
    handloom: true,
    description: 'Sheer, featherlight silk-cotton with tiny gold coin buttas. The saree you will reach for every week.',
    colours: [
      { name: 'Ivory Gold', hex: '#EFE3C8', accent: '#B8893B', family: 'white', stock: 6 },
      { name: 'Mint', hex: '#A8D5BA', accent: '#B8893B', family: 'green', stock: 5 },
      { name: 'Blush', hex: '#F2C4C4', accent: '#B8893B', family: 'pink', stock: 4 },
    ],
  },
  {
    name: 'Monsoon Linen',
    fabric: 'Linen',
    weave: 'Plain',
    work: 'plain',
    border: 'Silver zari selvedge',
    pallu: 'Tassel finish',
    origin: 'Bhagalpur, Bihar',
    occasions: ['office', 'everyday'],
    price: 3299,
    mrp: 3999,
    pattern: 'stripes',
    handloom: false,
    description: 'Breathable pure linen with a soft silver selvedge — crisp in the morning, relaxed by evening.',
    colours: [
      { name: 'Sage', hex: '#8A9A7B', accent: '#5E6B52', family: 'green', stock: 8 },
      { name: 'Sky', hex: '#8CB4D8', accent: '#46698C', family: 'blue', stock: 7 },
      { name: 'Charcoal', hex: '#3B3B3B', accent: '#1E1E1E', family: 'black', stock: 0 },
    ],
  },
  {
    name: 'Gadwal Kuttu Silk',
    fabric: 'Gadwal',
    weave: 'Kuttu (interlocked)',
    work: 'zari',
    border: 'Silk border, cotton body',
    pallu: 'Rich zari pallu',
    origin: 'Gadwal, Telangana',
    occasions: ['festive', 'wedding'],
    price: 12499,
    mrp: 14999,
    pattern: 'zari-checks',
    handloom: true,
    description: 'The Telangana classic: cotton body interlocked with a **pure silk border** — so light it folds into a matchbox.',
    colours: [
      { name: 'Mango Yellow', hex: '#E5B228', accent: '#7A1F2B', family: 'gold', stock: 3 },
      { name: 'Parrot Green', hex: '#4CAF50', accent: '#7A1F2B', family: 'green', stock: 2 },
    ],
  },
  {
    name: 'Ikat Pochampally',
    fabric: 'Pochampally',
    weave: 'Double ikat',
    work: 'printed',
    border: 'Ikat border',
    pallu: 'Geometric ikat pallu',
    origin: 'Pochampally, Telangana',
    occasions: ['office', 'party', 'gifting'],
    price: 7999,
    mrp: 9499,
    pattern: 'jaal',
    handloom: true,
    description: 'Each thread is tie-dyed **before** weaving so the pattern emerges on the loom — a GI-tagged Telangana craft.',
    colours: [
      { name: 'Indigo', hex: '#283E77', accent: '#B3282D', family: 'blue', stock: 5 },
      { name: 'Maroon', hex: '#6B1F2A', accent: '#1B1612', family: 'red', stock: 3 },
    ],
  },
  {
    name: 'Bengal Tant Cotton',
    fabric: 'Cotton',
    weave: 'Tant',
    work: 'plain',
    border: 'Woven thread border',
    pallu: 'Striped pallu',
    origin: 'Shantipur, West Bengal',
    occasions: ['everyday', 'office'],
    price: 1499,
    mrp: 1999,
    pattern: 'stripes',
    handloom: true,
    description: 'Crisp, airy tant cotton for Indian summers. Starch lightly for the classic structured drape.',
    colours: [
      { name: 'White Red', hex: '#F6F1E7', accent: '#B3282D', family: 'white', stock: 12 },
      { name: 'Lemon', hex: '#F3E27A', accent: '#2E7D32', family: 'gold', stock: 9 },
    ],
  },
  {
    name: 'Soft Silk Mayil',
    fabric: 'Soft Silk',
    weave: 'Jacquard',
    work: 'zari',
    border: 'Peacock (mayil) zari border',
    pallu: 'Peacock pallu',
    origin: 'Arani, Tamil Nadu',
    occasions: ['festive', 'party', 'gifting'],
    price: 4499,
    mrp: 5999,
    pattern: 'paisley',
    handloom: false,
    description: 'Lightweight soft silk with a peacock border — the gift that always lands.',
    colours: [
      { name: 'Coral', hex: '#E5674F', accent: '#2C3E8C', family: 'orange', stock: 6 },
      { name: 'Lavender', hex: '#9D8AC7', accent: '#5A2160', family: 'purple', stock: 4 },
    ],
  },
  {
    name: 'Tussar Ghicha Kantha',
    fabric: 'Tussar',
    weave: 'Ghicha',
    work: 'embroidery',
    border: 'Hand kantha border',
    pallu: 'Kantha-stitched pallu',
    origin: 'Bhagalpur, Bihar',
    occasions: ['office', 'festive'],
    price: 9999,
    mrp: 11999,
    pattern: 'buttis',
    handloom: true,
    description: 'Raw-textured ghicha tussar, hand-embroidered in **running kantha stitch** by women artisans in Bengal.',
    colours: [{ name: 'Natural Beige', hex: '#C9B28A', accent: '#6B1F2A', family: 'white', stock: 3 }],
  },
  {
    name: 'Bridal Vasundhara Kanjivaram',
    fabric: 'Kanjivaram',
    weave: 'Korvai',
    work: 'zari',
    border: 'Double-side rettai pettu border',
    pallu: 'Brocade pallu with yali and annam',
    origin: 'Kanchipuram, Tamil Nadu',
    occasions: ['wedding'],
    price: 28999,
    mrp: 33999,
    pattern: 'zari-checks',
    handloom: true,
    description: 'Our bridal flagship. Heavy brocade body with **muthu kattam** checks and a pallu of mythical yali and annam birds.',
    colours: [
      { name: 'Arakku Red', hex: '#8E1B22', accent: '#1F5C3A', family: 'red', stock: 2 },
      { name: 'Bottle Green', hex: '#1F5C3A', accent: '#8E1B22', family: 'green', stock: 1 },
    ],
  },
  {
    name: 'Organza Gulnaar',
    fabric: 'Organza',
    weave: 'Plain',
    work: 'embroidery',
    border: 'Scalloped embroidered edge',
    pallu: 'Floral embroidered pallu',
    origin: 'Surat, Gujarat',
    occasions: ['party', 'festive'],
    price: 6999,
    mrp: 8499,
    pattern: 'buttis',
    handloom: false,
    description: 'Sheer silk organza scattered with hand-embroidered gulnaar (pomegranate) blossoms.',
    colours: [
      { name: 'Powder Pink', hex: '#F4B6C2', accent: '#B8893B', family: 'pink', stock: 5 },
      { name: 'Champagne', hex: '#E8D5B0', accent: '#B8893B', family: 'gold', stock: 0 },
    ],
  },
];

const CATEGORIES = ['Kanjivaram', 'Banarasi', 'Paithani', 'Chanderi', 'Linen', 'Cotton', 'Gadwal', 'Pochampally', 'Soft Silk', 'Tussar', 'Organza'];

/** Loads the starter store. Skips if products exist (unless force). Returns true if it seeded. */
export async function seedDemo(force = !!process.env.SEED_FORCE, resume = false): Promise<boolean> {
  // resume = first-start setup that was interrupted: finish it, replacing any half-made starter sarees.
  const existing = await prisma.product.count();
  if (existing && !force && !resume) {
    console.log(`Database already has ${existing} products — skipping (set SEED_FORCE=1 to wipe and reseed).`);
    return false;
  }
  if (existing) {
    console.log('SEED_FORCE: clearing catalog…');
    await prisma.$transaction([
      prisma.orderItem.deleteMany(),
      prisma.orderStatusEvent.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.order.deleteMany(),
      prisma.cartItem.deleteMany(),
      prisma.cart.deleteMany(),
      prisma.collectionProduct.deleteMany(),
      prisma.productImage.deleteMany(),
      prisma.productColour.deleteMany(),
      prisma.product.deleteMany(),
      prisma.collection.deleteMany(),
      prisma.category.deleteMany(),
      prisma.homeSection.deleteMany(),
    ]);
  }

  const cats = new Map<string, string>();
  for (const [i, name] of CATEGORIES.entries()) {
    const c = await prisma.category.upsert({
      where: { slug: name.toLowerCase().replace(/\s+/g, '-') },
      create: { name, slug: name.toLowerCase().replace(/\s+/g, '-'), kind: 'fabric', sortOrder: i },
      update: {},
    });
    cats.set(name, c.id);
  }

  const productIds: Record<string, string> = {};
  const covers: Record<string, string> = {};
  for (const [i, s] of SAREES.entries()) {
    process.stdout.write(`  · ${s.name}…`);
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
    const old = await prisma.product.findUnique({ where: { slug }, include: { _count: { select: { images: true, colours: true } } } });
    if (old) {
      const complete = old._count.colours === s.colours.length && old._count.images >= s.colours.length * 2;
      if (complete) {
        productIds[slug] = old.id;
        const cover = await prisma.productImage.findFirst({ where: { productId: old.id }, orderBy: { sortOrder: 'asc' } });
        if (cover) covers[slug] = cover.url.split('#')[0];
        console.log(' already there');
        continue;
      }
      await prisma.product.delete({ where: { id: old.id } }); // half-made → rebuild
    }
    const p = await prisma.product.create({
      data: {
        name: s.name,
        slug,
        description: s.description
          .split('\n')
          .map((l) => (l.startsWith('- ') ? `<li>${l.slice(2)}</li>` : `<p>${l}</p>`))
          .join('')
          .replace(/(<li>.*<\/li>)/, '<ul>$1</ul>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
        fabric: s.fabric,
        weave: s.weave,
        work: s.work,
        border: s.border,
        pallu: s.pallu,
        origin: s.origin,
        care: '<ul><li>Dry clean only for the first wash</li><li>Store folded in a muslin cloth; refold every 3 months</li><li>Keep zari away from perfume and direct sunlight</li></ul>',
        occasions: s.occasions,
        blouseIncluded: true,
        handloomMark: s.handloom,
        price: P(s.price),
        mrp: P(s.mrp),
        falloPicoPrice: P(199),
        stitchingPrice: s.price > 4000 ? P(1499) : 0,
        sortOrder: i,
        isPinned: i < 2,
        popularity: 100 - i * 5,
        categoryId: cats.get(s.fabric) ?? null,
        createdAt: new Date(Date.now() - i * 4 * 86400_000),
      },
    });
    productIds[slug] = p.id;
    let sort = 0;
    for (const [ci, c] of s.colours.entries()) {
      const col = await prisma.productColour.create({
        data: { productId: p.id, colourName: c.name, hex: c.hex, family: c.family, stock: c.stock, sortOrder: ci },
      });
      const views: ['drape' | 'detail' | 'pallu', 'MODEL' | 'DETAIL' | 'FLATLAY'][] =
        ci === 0
          ? [
              ['drape', 'MODEL'],
              ['pallu', 'FLATLAY'],
              ['detail', 'DETAIL'],
            ]
          : [
              ['drape', 'MODEL'],
              ['pallu', 'FLATLAY'],
            ];
      for (const [view, tag] of views) {
        const url = await art(c.hex, c.accent, s.pattern, view);
        if (sort === 0) covers[slug] = url;
        await prisma.productImage.create({
          data: { productId: p.id, colourId: col.id, url: `${url}#lx=50,50,1`, alt: `${s.name} in ${c.name} — ${view}`, tag, sortOrder: sort++ },
        });
      }
    }
    console.log(' done');
  }

  const coverOf = (slug: string) => covers[slug] ?? null;
  const collections = [
    { title: 'Kanjivaram', handle: 'kanjivaram', rules: { fabric: ['Kanjivaram'] }, accent: '#6B1F2A', image: coverOf('rani-kalka-kanjivaram') },
    { title: 'Banarasi', handle: 'banarasi', rules: { fabric: ['Banarasi'] }, accent: '#8E1B4F', image: coverOf('meenakari-banarasi-katan') },
    { title: 'Paithani', handle: 'paithani', rules: { fabric: ['Paithani'] }, accent: '#2E7D32', image: coverOf('peshwai-paithani') },
    { title: 'Chanderi', handle: 'chanderi', rules: { fabric: ['Chanderi'] }, accent: '#B8893B', image: coverOf('chandrika-chanderi') },
    { title: 'Linen', handle: 'linen', rules: { fabric: ['Linen'] }, accent: '#8A9A7B', image: coverOf('monsoon-linen') },
    { title: 'Cotton', handle: 'cotton', rules: { fabric: ['Cotton', 'Pochampally'] }, accent: '#46698C', image: coverOf('bengal-tant-cotton') },
    { title: 'The Wedding Edit', handle: 'wedding-edit', rules: { occasion: ['wedding'] }, accent: '#6B1F2A', image: coverOf('bridal-vasundhara-kanjivaram'), isEditorial: true, description: '<p>Heirloom silks for the days you will remember forever — woven to be passed down.</p>' },
    { title: 'The Festive Edit', handle: 'festive-edit', rules: { occasion: ['festive'] }, accent: '#C46A1A', image: coverOf('gadwal-kuttu-silk'), isEditorial: true, description: '<p>Diwali, Sankranti, Onam, Durga Puja — colour and zari for every celebration.</p>' },
    { title: 'Everyday Silk', handle: 'everyday-silk', rules: { occasion: ['office', 'everyday'] }, accent: '#5E6B52', image: coverOf('chandrika-chanderi'), isEditorial: true, description: '<p>Light weaves that move from the office to dinner without a second thought.</p>' },
    { title: 'Under ₹5,000', handle: 'under-5000', rules: { maxPrice: P(5000) }, accent: '#B8893B', image: coverOf('soft-silk-mayil') },
  ];
  for (const [i, c] of collections.entries()) {
    if (await prisma.collection.findUnique({ where: { handle: c.handle } })) continue;
    await prisma.collection.create({
      data: {
        title: c.title,
        handle: c.handle,
        description: c.description ?? null,
        image: c.image ? `${c.image}#lx=50,40,1` : null,
        accent: c.accent,
        isRuleBased: true,
        rules: c.rules,
        isEditorial: !!c.isEditorial,
        showInNav: true,
        sortOrder: i,
      },
    });
  }

  const pages: [string, string, string][] = [
    ['about', 'Our story', '<p>Tarun Silks began in 1987 as a single counter of Kanjivaram silks. Today we work directly with more than forty weaver families across India.</p><p>Every saree we sell is chosen by hand, checked thread by thread, and shipped with its certification.</p>'],
    ['weavers', 'Our weavers', '<p>Meet the families behind the looms — from Kanchipuram to Varanasi.</p><ul><li><strong>Kanchipuram</strong> — korvai Kanjivaram silks</li><li><strong>Varanasi</strong> — kadhua Banarasi brocades</li><li><strong>Yeola</strong> — tapestry Paithani</li><li><strong>Gadwal</strong> — kuttu silk-cotton</li></ul>'],
    ['contact', 'Contact us', '<p>WhatsApp us any time — we usually reply within the hour (10am–8pm IST).</p>'],
    ['store-locator', 'Visit our store', '<p>Add your store address and timings in Admin → Pages.</p>'],
    ['care-guide', 'Saree care guide', '<ul><li>Dry clean silk sarees for the first wash</li><li>Fold in muslin, never plastic</li><li>Refold along different lines every three months to protect zari</li><li>Air sarees in shade, not direct sun</li></ul>'],
    ['shipping', 'Shipping', '<p>Free shipping on orders above ₹2,999. Most orders ship within 24 hours and arrive in 2–7 days depending on your pincode.</p>'],
    ['returns', 'Returns & exchange', '<p>Easy 7-day returns on unused sarees with tags intact. Sarees with fall & pico or stitched blouses cannot be returned.</p>'],
    ['privacy', 'Privacy policy', '<p>We only collect what we need to deliver your order. Replace this with your full policy text in Admin → Pages.</p>'],
    ['terms', 'Terms of service', '<p>Replace with your terms in Admin → Pages.</p>'],
    ['faq', 'FAQ', '<h3>Is the blouse piece included?</h3><p>Yes — every saree comes with an unstitched 0.8 m blouse piece unless stated otherwise.</p><h3>Do you offer cash on delivery?</h3><p>Yes, across most of India, for orders up to ₹15,000.</p><h3>Can you stitch my blouse?</h3><p>Choose “Add stitched blouse” on the product page and share your measurements.</p>'],
  ];
  for (const [slug, title, body] of pages) {
    await prisma.page.upsert({ where: { slug }, create: { slug, title, body }, update: {} });
  }

  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    create: { code: 'WELCOME10', type: 'PERCENT', value: 10, minCart: P(2000), maxDiscount: P(1500), perUser: 1 },
    update: {},
  });
  await prisma.coupon.upsert({ where: { code: 'FREESHIP' }, create: { code: 'FREESHIP', type: 'FREE_SHIPPING', value: 0 }, update: {} });


  // Homepage last: its presence marks the starter store as fully set up.
  const home = [
    { type: 'hero', data: { eyebrow: 'Handwoven in India since 1987', line1: 'Six yards', line2: 'of poetry.', cta: 'Explore the collection', ctaLink: '/shop', secondary: 'The Wedding Edit', secondaryLink: '/collections/wedding-edit', video: '', poster: '' } },
    { type: 'marquee', data: { items: ['Kanjivaram', 'Banarasi', 'Paithani', 'Chanderi', 'Gadwal', 'Pochampally', 'Tussar', 'Linen'] } },
    { type: 'story', title: 'From loom to drape', data: { steps: [
      { title: 'The loom', body: 'A pit loom in Kanchipuram, 600 years of craft in its rhythm.' },
      { title: 'The weaver', body: 'Up to 20 days of hands and patience for one saree.' },
      { title: 'The drape', body: 'Six yards that hold a family’s celebrations for generations.' },
    ] } },
    { type: 'collections', title: 'Eight looms. One obsession.', data: { handles: ['kanjivaram', 'banarasi', 'paithani', 'chanderi', 'linen', 'cotton'] } },
    { type: 'new', title: 'New on the loom', data: {} },
    { type: 'pallu', title: 'All the drama lives in the pallu.', data: { body: 'The pallu is where a weaver signs their name in silk — peacocks, temple spires, mango vines. Hover to see the weave up close.', slug: 'rani-kalka-kanjivaram', cta: 'See the weave' } },
    { type: 'colours', title: 'Choose a mood.', data: { swatches: [
      { name: 'Sindoor', family: 'red', hex: '#B3282D' },
      { name: 'Mor', family: 'green', hex: '#0F6B6B' },
      { name: 'Kesar', family: 'gold', hex: '#D9A21B' },
      { name: 'Jamun', family: 'purple', hex: '#5A2160' },
      { name: 'Gulab', family: 'pink', hex: '#C2185B' },
      { name: 'Neel', family: 'blue', hex: '#283593' },
    ] } },
    { type: 'edits', title: 'Edits', data: { handles: ['wedding-edit', 'festive-edit', 'everyday-silk'] } },
    { type: 'bestsellers', title: 'Most loved', data: {} },
    { type: 'craft', title: 'Every saree, verifiably handwoven.', data: { points: [
      { title: 'Silk Mark & Handloom Mark', body: 'Certified pure silk and genuine handloom — the tag comes with your saree.' },
      { title: 'Direct from 40+ weaver families', body: 'Fair, upfront prices paid to weavers in Kanchipuram, Varanasi, Yeola and Gadwal.' },
      { title: 'Zari tested', body: 'Every pure-zari saree is tested for silver content before it leaves us.' },
    ] } },
    { type: 'testimonials', title: 'Worn and loved', data: { items: [
      { name: 'Lakshmi R.', city: 'Hyderabad', quote: 'My mother cried when she saw the Kanjivaram. It feels like the ones from her own wedding.' },
      { name: 'Ananya S.', city: 'Bengaluru', quote: 'The Chanderi is my office uniform now. Light, elegant, and so many compliments.' },
      { name: 'Priya M.', city: 'Pune', quote: 'The Paithani pallu is unreal in person. Packaging was beautiful too.' },
    ] } },
    { type: 'instagram', title: '@tarunsilks', data: {} },
    { type: 'newsletter', title: 'Letters from the loom', data: { body: 'New weaves, weaver stories and early access to festive drops. No spam, ever.' } },
  ];
  for (const [i, h] of home.entries()) {
    await prisma.homeSection.create({ data: { type: h.type, title: h.title ?? null, data: h.data, sortOrder: i } });
  }

  console.log(`Seeded ${SAREES.length} sarees, ${collections.length} collections, ${home.length} homepage sections, ${pages.length} pages.`);
  return true;
}
