export interface LadderConfig {
  stopLoss: number;
  trailing?: number;
  takeProfits: readonly { at: number; sell: number }[];
  breakevenAfterFirst?: boolean;
}

export interface ExitAction {
  reason: 'take-profit' | 'stop-loss' | 'trailing-stop';
  fraction: number;
}

export class ExitLadder {
  private remaining = 1;
  private high: number;
  private stop: number;
  private next = 0;

  constructor(
    readonly entry: number,
    readonly cfg: LadderConfig,
  ) {
    this.high = entry;
    this.stop = entry * (1 - cfg.stopLoss);
    if (cfg.trailing != null) this.stop = Math.max(this.stop, entry * (1 - cfg.trailing));
  }

  get open(): number {
    return this.remaining;
  }

  update(price: number): ExitAction[] {
    if (this.remaining <= 0) return [];
    const out: ExitAction[] = [];
    if (price <= this.stop) {
      const moved = this.stop > this.entry * (1 - this.cfg.stopLoss);
      out.push({ reason: moved ? 'trailing-stop' : 'stop-loss', fraction: this.remaining });
      this.remaining = 0;
      return out;
    }
    if (price > this.high) {
      this.high = price;
      if (this.cfg.trailing != null) this.stop = Math.max(this.stop, price * (1 - this.cfg.trailing));
    }
    const gain = price / this.entry - 1;
    while (this.next < this.cfg.takeProfits.length && gain >= this.cfg.takeProfits[this.next]!.at) {
      const fraction = this.remaining * this.cfg.takeProfits[this.next]!.sell;
      this.remaining -= fraction;
      out.push({ reason: 'take-profit', fraction });
      if (this.next === 0 && this.cfg.breakevenAfterFirst) this.stop = Math.max(this.stop, this.entry);
      this.next++;
    }
    if (this.remaining < 1e-12) this.remaining = 0;
    return out;
  }
}
