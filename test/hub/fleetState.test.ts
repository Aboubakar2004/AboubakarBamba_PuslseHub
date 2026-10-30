import { describe, expect, it } from 'vitest';
import type { Thresholds } from '../../src/hub/deviceStatus.js';
import { FleetState } from '../../src/hub/fleetState.js';
import { type Frame, FrameType, MetricId } from '../../src/protocol/types.js';

const thresholds: Thresholds = {
  temperatureWarningC: 60,
  temperatureCriticalC: 75,
  voltageMinV: 22,
  voltageMaxV: 26,
  currentMaxA: 10,
  silentAfterMs: 3000,
};

const telemetry = (deviceId: number, temperatureCenti: number): Frame => ({
  type: FrameType.Telemetry,
  deviceId,
  seq: 1,
  uptimeMs: 5000,
  measurements: [
    { metricId: MetricId.Temperature, value: temperatureCenti },
    { metricId: MetricId.Voltage, value: 24000 },
    { metricId: MetricId.Current, value: 2000 },
  ],
});
const heartbeat = (deviceId: number): Frame => ({
  type: FrameType.Heartbeat,
  deviceId,
  seq: 2,
  uptimeMs: 6000,
  measurements: [],
});

describe('FleetState', () => {
  it('est vide au démarrage (test d’acceptation : tout à zéro)', () => {
    expect(new FleetState(thresholds).snapshot(0)).toEqual({
      devices: [],
      countByStatus: { OK: 0, WARNING: 0, CRITICAL: 0, SILENT: 0 },
      outOfRangeCount: 0,
    });
  });

  it('convertit les unités du protocole en unités physiques', () => {
    const fleet = new FleetState(thresholds);
    fleet.update(telemetry(7, 4250), 1000);
    expect(fleet.snapshot(1000).devices[0]).toMatchObject({
      deviceId: 7,
      temperatureC: 42.5,
      voltageV: 24,
      currentA: 2,
      status: 'OK',
    });
  });

  it('compte les appareils par statut', () => {
    const fleet = new FleetState(thresholds);
    fleet.update(telemetry(1, 3500), 0);
    fleet.update(telemetry(2, 6500), 0);
    fleet.update(telemetry(3, 8000), 0);
    expect(fleet.snapshot(0).countByStatus).toEqual({ OK: 1, WARNING: 1, CRITICAL: 1, SILENT: 0 });
  });

  it('passe un appareil en SILENT quand il ne donne plus de nouvelles', () => {
    const fleet = new FleetState(thresholds);
    fleet.update(telemetry(1, 3500), 0);
    expect(fleet.snapshot(3000).devices[0]!.status).toBe('OK');
    expect(fleet.snapshot(3001).devices[0]!.status).toBe('SILENT');
  });

  it('un HEARTBEAT garde l’appareil vivant sans effacer ses valeurs', () => {
    const fleet = new FleetState(thresholds);
    fleet.update(telemetry(1, 3500), 0);
    fleet.update(heartbeat(1), 2500);
    const [device] = fleet.snapshot(5000).devices;
    expect(device).toMatchObject({ status: 'OK', temperatureC: 35, silentForMs: 2500, uptimeMs: 6000 });
  });

  it('compte les télémétries hors limites, par appareil et au total', () => {
    const fleet = new FleetState(thresholds);
    fleet.update(telemetry(1, 12000), 0);
    fleet.update(telemetry(1, 3500), 50);
    fleet.update(telemetry(2, 9000), 0);
    const snapshot = fleet.snapshot(100);
    expect(snapshot.devices.map((d) => d.outOfRangeCount)).toEqual([1, 1]);
    expect(snapshot.outOfRangeCount).toBe(2);
    expect(snapshot.devices[0]!.status).toBe('OK'); // le pic est passé
  });

  it('trie les appareils par identifiant', () => {
    const fleet = new FleetState(thresholds);
    [30, 4, 12].forEach((id) => fleet.update(telemetry(id, 3500), 0));
    expect(fleet.snapshot(0).devices.map((d) => d.deviceId)).toEqual([4, 12, 30]);
  });
});
