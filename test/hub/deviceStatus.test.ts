import { describe, expect, it } from 'vitest';
import { type DeviceReadings, type Thresholds, evaluateStatus } from '../../src/hub/deviceStatus.js';

const thresholds: Thresholds = {
  temperatureWarningC: 60,
  temperatureCriticalC: 75,
  voltageMinV: 22,
  voltageMaxV: 26,
  currentMaxA: 10,
  silentAfterMs: 3000,
};
const normal: DeviceReadings = { temperatureC: 35, voltageV: 24, currentA: 2 };

describe('evaluateStatus', () => {
  it('OK quand toutes les valeurs sont normales', () => {
    expect(evaluateStatus(normal, 0, thresholds)).toBe('OK');
  });

  it('WARNING au-dessus du seuil de température d’alerte', () => {
    expect(evaluateStatus({ ...normal, temperatureC: 65 }, 0, thresholds)).toBe('WARNING');
  });

  it('CRITICAL au-dessus du seuil de température critique', () => {
    expect(evaluateStatus({ ...normal, temperatureC: 80 }, 0, thresholds)).toBe('CRITICAL');
  });

  it('CRITICAL si la tension sort de la plage ou si le courant est trop fort', () => {
    expect(evaluateStatus({ ...normal, voltageV: 21 }, 0, thresholds)).toBe('CRITICAL');
    expect(evaluateStatus({ ...normal, voltageV: 30 }, 0, thresholds)).toBe('CRITICAL');
    expect(evaluateStatus({ ...normal, currentA: 12 }, 0, thresholds)).toBe('CRITICAL');
  });

  it('les seuils sont stricts : une valeur égale au seuil ne déclenche pas', () => {
    expect(evaluateStatus({ ...normal, temperatureC: 60 }, 0, thresholds)).toBe('OK');
    expect(evaluateStatus(normal, 3000, thresholds)).toBe('OK');
  });

  it('SILENT prime sur tout le reste', () => {
    expect(evaluateStatus({ ...normal, temperatureC: 80 }, 3001, thresholds)).toBe('SILENT');
  });

  it('OK pour un appareil vivant sans télémétrie (heartbeats seuls)', () => {
    expect(evaluateStatus({ temperatureC: null, voltageV: null, currentA: null }, 0, thresholds)).toBe('OK');
  });
});
