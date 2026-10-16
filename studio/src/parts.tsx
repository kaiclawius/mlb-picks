import React from "react";
import { Brand } from "./types";

/** "*word*" -> word in the accent colour. */
export function Rich({ text, accent }: { text: string; accent: string }) {
  return <>{text.split(/(\*[^*]+\*)/g).map((p, i) => p.startsWith("*") && p.endsWith("*")
    ? <span key={i} style={{ color: accent }}>{p.slice(1, -1)}</span>
    : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
}

export function Wordmark({ brand, size }: { brand: Brand; size: number }) {
  const [a, b] = brand.wordmark;
  return (
    <span style={{ fontFamily: brand.fonts.display, ...brand.displayStyle, fontSize: size, lineHeight: 1, color: brand.colors.ink, whiteSpace: "nowrap" }}>
      {a}{b ? <span style={{ color: brand.colors.accent }}>{b}</span> : null}
    </span>
  );
}

export function Kicker({ brand, u, children, style }: { brand: Brand; u: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: brand.fonts.mono, fontSize: 22 * u, letterSpacing: "0.16em", textTransform: "uppercase", color: brand.colors.muted, ...style }}>
      {children}
    </div>
  );
}

export const display = (brand: Brand, size: number): React.CSSProperties => ({
  fontFamily: brand.fonts.display, fontWeight: 800, ...brand.displayStyle, fontSize: size, lineHeight: 1.02,
  letterSpacing: "-0.015em", color: brand.colors.ink, textWrap: "balance" as React.CSSProperties["textWrap"], margin: 0,
});
