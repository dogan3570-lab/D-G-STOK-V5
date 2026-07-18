export type PilotLevel = 'pilot' | 'test' | 'kontrollu' | 'onayli' | 'tam';

const LIMITS: Record<PilotLevel, number> = {
  pilot: 5,
  test: 10,
  kontrollu: 100,
  onayli: 1000,
  tam: Infinity,
};

export class PilotEngine {
  private currentLevel: PilotLevel = 'pilot';
  private sentCount = 0;

  setLevel(level: PilotLevel, isSuperAdmin: boolean): boolean {
    if (level === 'tam' && !isSuperAdmin) return false;
    this.currentLevel = level;
    return true;
  }

  getLimit(): number {
    return LIMITS[this.currentLevel];
  }

  canSend(count: number): { allowed: boolean; remaining: number; message: string } {
    const limit = this.getLimit();
    const remaining = limit - this.sentCount;

    if (remaining <= 0) {
      return { allowed: false, remaining: 0, message: `Limit doldu: ${limit}/${limit}` };
    }
    if (count > remaining) {
      return { allowed: false, remaining, message: `Limit asimi: ${count} > ${remaining}` };
    }
    return { allowed: true, remaining, message: `${remaining} gonderim hakki kaldi` };
  }

  recordSent(count: number): void {
    this.sentCount += count;
  }

  getStats(): { level: PilotLevel; sent: number; limit: number; remaining: number } {
    return {
      level: this.currentLevel,
      sent: this.sentCount,
      limit: this.getLimit(),
      remaining: this.getLimit() - this.sentCount,
    };
  }

  reset(): void {
    this.sentCount = 0;
  }
}
