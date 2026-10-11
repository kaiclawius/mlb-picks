/** Einfaches Fenster-Limit im Speicher. Bei mehreren Server-Instanzen müsste das in die Datenbank oder Redis. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private max: number, private windowMs: number) {}

  /** true = erlaubt (und gezählt), false = Limit erreicht */
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
  }
}
