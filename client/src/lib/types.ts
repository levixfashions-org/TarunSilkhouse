export type Img = { url: string; alt: string; tag: string; colourId: string | null };
export type Colour = { id: string; name: string; hex: string; inStock: boolean; stock?: number | null; priceDelta?: number };

export type Card = {
  id: string;
  slug: string;
  name: string;
  fabric: string;
  work: string | null;
  price: number;
  mrp: number;
  handloomMark: boolean;
  isNew: boolean;
  soldOut: boolean;
  lowStock: number | null;
  images: Img[];
  colours: Colour[];
};

export type Product = Card & {
  description: string;
  weave: string | null;
  border: string | null;
  pallu: string | null;
  origin: string | null;
  care: string | null;
  occasions: string[];
  lengthInfo: string;
  blouseIncluded: boolean;
  falloPicoPrice: number;
  stitchingPrice: number;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { name: string; slug: string } | null;
};

export type Review = { id: string; rating: number; title: string | null; body: string; photos: string[]; name: string; createdAt: string };

export type Stitching = {
  bust: number;
  waist: number;
  shoulder: number;
  sleeveLength: number;
  blouseLength: number;
  neckFront?: number;
  neckBack?: number;
  notes?: string;
};
export type LineOptions = { fallPico?: boolean; stitching?: Stitching };

export type QuoteLine = {
  productId: string;
  colourId: string;
  slug: string;
  name: string;
  colourName: string;
  image: string | null;
  unitPrice: number;
  mrp: number;
  qty: number;
  servicesFee: number;
  lineTotal: number;
  stock: number;
  options?: LineOptions;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  total: number;
  coupon: { code: string; message: string } | null;
  couponError: string | null;
  cod: { available: boolean; reason?: string };
  delivery: { days: number; zone: string } | null;
  freeShippingAbove: number;
  problems: { productId: string; colourId: string; message: string }[];
};

export type HomeSection = { id: string; type: string; title: string | null; data: Record<string, unknown> };

export type Boot = {
  store: {
    storeName: string;
    tagline: string;
    email: string;
    whatsapp: string;
    phone: string;
    instagram: string;
    facebook: string;
    youtube: string;
    address: string;
    mapUrl: string;
    logoUrl: string;
    announcement: string;
    announcementVisible: boolean;
    gaId: string;
    metaPixelId: string;
  };
  shipping: { freeShippingAbove: number; giftWrapPrice: number };
  cod: { enabled: boolean; fee: number };
  collections: { handle: string; title: string; image: string | null; accent: string | null; isEditorial: boolean }[];
  categories: { slug: string; name: string; kind: string; image: string | null }[];
  home: HomeSection[];
  firebase: { apiKey: string; authDomain?: string; projectId?: string; appId?: string } | null;
  razorpayKeyId: string | null;
  devAuth: boolean;
};

export type PublicOrder = {
  number: string;
  status: string;
  paymentMethod: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  createdAt: string;
  shipName: string;
  shipCity: string;
  shipPincode: string;
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
  items: { productId: string | null; name: string; colourName: string; qty: number; unitPrice: number; servicesFee: number; image: string | null }[];
  events: { status: string; note: string | null; at: string }[];
  whatsappText: string;
};

export type Address = {
  id?: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
};
