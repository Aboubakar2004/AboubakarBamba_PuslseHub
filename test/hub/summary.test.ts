import { describe, expect, it } from 'vitest';
import { RateMeter } from '../../src/hub/rateMeter.js';
import { buildSummary, lossRatePercent } from '../../src/hub/summary.js';

describe('lossRatePercent', () => {
  it('vaut 0 quand rien n’est encore arrivé', () => {
    expect(lossRatePercent(0, 0)).toBe(0);
  });

  it('rapporte les pertes aux trames attendues, arrondi à 2 décimales', () => {
    expect(lossRatePercent(98, 2)).toBe(2);
    expect(lossRatePercent(2, 1)).toBe(33.33);
  });
});

describe('buildSummary', () => {
  it('assemble réception et flotte, avec les pertes par appareil', () => {
    const summary = buildSummary({
      nowMs: 10_000,
      startedAtMs: 4_000,
      reception: { received: 105, valid: 100, invalid: 5, invalidByReason: { BAD_CHECKSUM: 5 } },
      sequence: { accepted: 95, duplicates: 3, late: 2, lost: 5 },
      framesPerSecond: 1000,
      fleet: {
        devices: [
          {
            deviceId: 7,
            status: 'OK',
            silentForMs: 0,
            uptimeMs: 1,
            temperatureC: 35,
            voltageV: 24,
            currentA: 2,
            outOfRangeCount: 0,
            issues: [],
          },
        ],
        countByStatus: { OK: 1, WARNING: 0, CRITICAL: 0, SILENT: 0 },
        outOfRangeCount: 0,
      },
      lostOf: (deviceId) => (deviceId === 7 ? 5 : 0),
    });

    expect(summary.hubUptimeMs).toBe(6_000);
    expect(summary.reception).toMatchObject({ received: 105, accepted: 95, invalid: 5, lost: 5, lossRatePercent: 5 });
    expect(summary.fleet.deviceCount).toBe(1);
    expect(summary.fleet.devices[0]!.lost).toBe(5);
  });
});

describe('RateMeter', () => {
  it('mesure le débit de la dernière seconde complète', () => {
    const meter = new RateMeter();
    for (let t = 0; t < 1000; t += 10) meter.record(t); // 100 événements en 1 s
    expect(meter.rate(1000)).toBe(100);
  });

  it('retombe à 0 quand plus rien n’arrive', () => {
    const meter = new RateMeter();
    for (let t = 0; t < 1000; t += 10) meter.record(t);
    expect(meter.rate(5000)).toBe(0);
  });
});
