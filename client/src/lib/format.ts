/** Paise → "₹24,999" (Indian grouping). */
export const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
export const pctOff = (price: number, mrp: number) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export const dateIN = (d: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('en-IN', opts);

export const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Order placed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export const occasionLabel: Record<string, string> = {
  wedding: 'Wedding',
  festive: 'Festive',
  office: 'Office wear',
  party: 'Party',
  everyday: 'Everyday',
  gifting: 'Gifting',
};

export const workLabel: Record<string, string> = { zari: 'Zari', embroidery: 'Embroidery', printed: 'Printed / ikat', plain: 'Plain' };

export const colourFamilies: { value: string; label: string; hex: string }[] = [
  { value: 'red', label: 'Reds', hex: '#B3282D' },
  { value: 'pink', label: 'Pinks', hex: '#C2185B' },
  { value: 'orange', label: 'Corals', hex: '#E5674F' },
  { value: 'gold', label: 'Yellows & gold', hex: '#D9A21B' },
  { value: 'green', label: 'Greens', hex: '#2E7D32' },
  { value: 'blue', label: 'Blues', hex: '#283593' },
  { value: 'purple', label: 'Purples', hex: '#5A2160' },
  { value: 'white', label: 'Ivory & pastels', hex: '#EFE3C8' },
  { value: 'black', label: 'Black & grey', hex: '#3B3B3B' },
];

export const waLink = (number: string, text: string) => `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
