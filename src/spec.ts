import { z } from 'zod';

// Schema für die Modellausgabe: bewusst ohne Längen-Constraints, die werden in sanitizeSpec erzwungen.
export const ModelSpecSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  tagline: z.string(),
  about: z.string(),
  features: z.array(z.object({ title: z.string(), text: z.string() })),
  mode: z.enum(['light', 'dark']),
  accent: z.string(),
});

export interface SiteSpec {
  name: string;
  symbol: string;
  tagline: string;
  about: string;
  features: { title: string; text: string }[];
  mode: 'light' | 'dark';
  accent: string;
}

const clamp = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

export function sanitizeSpec(raw: z.infer<typeof ModelSpecSchema>): SiteSpec {
  const symbol = raw.symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  return {
    name: clamp(raw.name, 32) || 'Unbenannt',
    symbol: symbol.length >= 2 ? symbol : 'MEME',
    tagline: clamp(raw.tagline, 90),
    about: clamp(raw.about, 500),
    features: raw.features.slice(0, 3).map((f) => ({ title: clamp(f.title, 40), text: clamp(f.text, 160) })),
    mode: raw.mode,
    accent: /^#[0-9a-fA-F]{6}$/.test(raw.accent) ? raw.accent : '#f59f00',
  };
}
