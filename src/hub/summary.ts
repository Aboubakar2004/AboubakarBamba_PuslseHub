import type { DecodeErrorReason } from '../protocol/types.js';
import type { DeviceView, FleetSnapshot } from './fleetState.js';
import type { ReceptionSnapshot } from './receptionStats.js';
import type { SequenceCounters } from './sequencer.js';

export interface ReceptionHealth {
  received: number;
  accepted: number;
  invalid: number;
  invalidByReason: Partial<Record<DecodeErrorReason, number>>;
  duplicates: number;
  late: number;
  lost: number;
  /** Part des trames attendues qui n'ont jamais été exploitables : lost / (accepted + lost). */
  lossRatePercent: number;
  /** Datagrammes reçus par seconde (dernière seconde). */
  framesPerSecond: number;
}

export interface DeviceSummary extends DeviceView {
  /** Trames perdues pour cet appareil : repère un équipement mal placé sur le réseau. */
  lost: number;
}

/** Synthèse complète publiée par le hub : c'est le seul objet que la visualisation consomme. */
export interface HubSummary {
  generatedAt: number;
  hubUptimeMs: number;
  reception: ReceptionHealth;
  fleet: Omit<FleetSnapshot, 'devices'> & { deviceCount: number; devices: DeviceSummary[] };
}

export interface SummaryInputs {
  nowMs: number;
  startedAtMs: number;
  reception: ReceptionSnapshot;
  sequence: SequenceCounters;
  framesPerSecond: number;
  fleet: FleetSnapshot;
  lostOf: (deviceId: number) => number;
}

export function lossRatePercent(accepted: number, lost: number): number {
  const expected = accepted + lost;
  return expected === 0 ? 0 : Math.round((lost / expected) * 10_000) / 100; // 2 décimales
}

/** Assemble les états des différentes étapes en une synthèse unique (fonction pure). */
export function buildSummary(inputs: SummaryInputs): HubSummary {
  const { reception, sequence, fleet } = inputs;
  return {
    generatedAt: inputs.nowMs,
    hubUptimeMs: inputs.nowMs - inputs.startedAtMs,
    reception: {
      received: reception.received,
      accepted: sequence.accepted,
      invalid: reception.invalid,
      invalidByReason: reception.invalidByReason,
      duplicates: sequence.duplicates,
      late: sequence.late,
      lost: sequence.lost,
      lossRatePercent: lossRatePercent(sequence.accepted, sequence.lost),
      framesPerSecond: inputs.framesPerSecond,
    },
    fleet: {
      deviceCount: fleet.devices.length,
      countByStatus: fleet.countByStatus,
      outOfRangeCount: fleet.outOfRangeCount,
      devices: fleet.devices.map((device) => ({ ...device, lost: inputs.lostOf(device.deviceId) })),
    },
  };
}
