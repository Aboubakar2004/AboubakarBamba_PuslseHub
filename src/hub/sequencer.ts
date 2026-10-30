export type SequenceVerdict = 'accepted' | 'duplicate' | 'late';

export interface SequenceCounters {
  accepted: number;
  duplicates: number;
  late: number;
  /** Trames jamais reçues (trous de séquence), corrigé si une trame en retard finit par arriver. */
  lost: number;
}

const emptyCounters = (): SequenceCounters => ({ accepted: 0, duplicates: 0, late: 0, lost: 0 });

/** État de séquence d'un appareil : dernier seq accepté et seq manquants récents. */
interface DeviceSequence {
  lastSeq: number;
  /** Seq sautés qui pourraient encore arriver en retard (limités à la fenêtre). */
  missing: Set<number>;
  counters: SequenceCounters;
}

/**
 * Séquenceur : pour chaque appareil, accepte une trame seulement si son seq est nouveau.
 * - seq > dernier : acceptée ; les seq sautés sont comptés comme perdus.
 * - seq manquant qui arrive enfin : en retard, écartée (valeur périmée), et la perte est annulée.
 * - seq déjà vu : doublon, écarté.
 * Les seq plus vieux que la fenêtre ne peuvent plus être distingués : ils sont classés en retard.
 */
export class Sequencer {
  private readonly devices = new Map<number, DeviceSequence>();

  /** @param window nombre de seq récents mémorisés par appareil pour reconnaître retards et doublons. */
  constructor(private readonly window: number) {}

  process(deviceId: number, seq: number): SequenceVerdict {
    const device = this.devices.get(deviceId);
    if (!device) {
      this.devices.set(deviceId, { lastSeq: seq, missing: new Set(), counters: { ...emptyCounters(), accepted: 1 } });
      return 'accepted';
    }
    return seq > device.lastSeq ? this.advance(device, seq) : this.classifyOld(device, seq);
  }

  private advance(device: DeviceSequence, seq: number): SequenceVerdict {
    device.counters.lost += seq - device.lastSeq - 1;
    // Seuls les seq sautés dans la fenêtre sont mémorisés : un énorme trou ne coûte pas de mémoire.
    for (let missing = Math.max(device.lastSeq + 1, seq - this.window); missing < seq; missing++) {
      device.missing.add(missing);
    }
    for (const old of device.missing) {
      if (old <= seq - this.window) device.missing.delete(old);
    }
    device.lastSeq = seq;
    device.counters.accepted++;
    return 'accepted';
  }

  private classifyOld(device: DeviceSequence, seq: number): SequenceVerdict {
    if (device.missing.delete(seq)) {
      device.counters.lost--; // elle n'était pas perdue, seulement en retard
      device.counters.late++;
      return 'late';
    }
    if (device.lastSeq - seq < this.window) {
      device.counters.duplicates++; // dans la fenêtre et pas manquant : déjà reçue
      return 'duplicate';
    }
    device.counters.late++;
    return 'late';
  }

  countersOf(deviceId: number): SequenceCounters {
    const device = this.devices.get(deviceId);
    return device ? { ...device.counters } : emptyCounters();
  }

  totals(): SequenceCounters {
    const totals = emptyCounters();
    for (const { counters } of this.devices.values()) {
      totals.accepted += counters.accepted;
      totals.duplicates += counters.duplicates;
      totals.late += counters.late;
      totals.lost += counters.lost;
    }
    return totals;
  }
}
