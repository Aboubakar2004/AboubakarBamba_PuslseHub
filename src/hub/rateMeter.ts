/**
 * Débit en événements par seconde, mesuré sur des fenêtres d'une seconde.
 * Renvoie le débit de la dernière fenêtre complète, et 0 si plus rien n'arrive.
 */
export class RateMeter {
  private windowStartMs: number | null = null;
  private countInWindow = 0;
  private lastRate = 0;

  constructor(private readonly windowMs = 1000) {}

  record(nowMs: number): void {
    this.roll(nowMs);
    this.countInWindow++;
  }

  rate(nowMs: number): number {
    this.roll(nowMs);
    return this.lastRate;
  }

  private roll(nowMs: number): void {
    if (this.windowStartMs === null) {
      this.windowStartMs = nowMs;
      return;
    }
    const elapsed = nowMs - this.windowStartMs;
    if (elapsed < this.windowMs) return;
    // Si plus d'une fenêtre s'est écoulée sans événement, le débit est retombé à 0.
    this.lastRate = elapsed < 2 * this.windowMs ? Math.round((this.countInWindow * 1000) / elapsed) : 0;
    this.windowStartMs = nowMs;
    this.countInWindow = 0;
  }
}
