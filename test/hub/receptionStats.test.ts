import { describe, expect, it } from 'vitest';
import { ReceptionStats } from '../../src/hub/receptionStats.js';
import { FrameType } from '../../src/protocol/types.js';

const validResult = {
  ok: true as const,
  frame: { type: FrameType.Heartbeat, deviceId: 1, seq: 1, uptimeMs: 0, measurements: [] },
};

describe('ReceptionStats', () => {
  it('démarre avec tous les compteurs à zéro', () => {
    expect(new ReceptionStats().snapshot()).toEqual({ received: 0, valid: 0, invalid: 0, invalidByReason: {} });
  });

  it('compte les trames valides et invalides par raison', () => {
    const stats = new ReceptionStats();
    stats.record(validResult);
    stats.record(validResult);
    stats.record({ ok: false, reason: 'BAD_CHECKSUM' });
    stats.record({ ok: false, reason: 'BAD_CHECKSUM' });
    stats.record({ ok: false, reason: 'BAD_MAGIC' });

    expect(stats.snapshot()).toEqual({
      received: 5,
      valid: 2,
      invalid: 3,
      invalidByReason: { BAD_CHECKSUM: 2, BAD_MAGIC: 1 },
    });
  });

  it("renvoie une copie : modifier l'instantané ne touche pas les compteurs", () => {
    const stats = new ReceptionStats();
    stats.record({ ok: false, reason: 'TOO_SHORT' });
    stats.snapshot().invalidByReason.TOO_SHORT = 99;
    expect(stats.snapshot().invalidByReason.TOO_SHORT).toBe(1);
  });
});
