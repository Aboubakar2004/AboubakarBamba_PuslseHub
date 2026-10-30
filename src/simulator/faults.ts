import type { Random } from './device.js';

/**
 * Défaut réseau appliqué à un paquet déjà encodé.
 * Renvoie 0, 1 ou plusieurs paquets : supprimer, altérer, dupliquer ou retenir.
 * Ajouter un défaut = ajouter une classe, sans modifier les autres (principe ouvert/fermé).
 */
export interface PacketFault {
  readonly name: string;
  injected: number;
  apply(packet: Buffer): Buffer[];
}

/** Inverse les bits du checksum : la trame sera rejetée par le hub (BAD_CHECKSUM). */
export class CorruptChecksumFault implements PacketFault {
  readonly name = 'checksum faux';
  injected = 0;

  constructor(private readonly rate: number, private readonly random: Random) {}

  apply(packet: Buffer): Buffer[] {
    if (this.random() >= this.rate) return [packet];
    const corrupted = Buffer.from(packet); // copie : on ne modifie pas le paquet d'origine
    const last = corrupted.length - 1;
    corrupted.writeUInt8(corrupted.readUInt8(last) ^ 0xff, last);
    this.injected++;
    return [corrupted];
  }
}

/** Envoie le même paquet deux fois : le hub doit écarter le second (seq déjà vue). */
export class DuplicateFault implements PacketFault {
  readonly name = 'doublons';
  injected = 0;

  constructor(private readonly rate: number, private readonly random: Random) {}

  apply(packet: Buffer): Buffer[] {
    if (this.random() >= this.rate) return [packet];
    this.injected++;
    return [packet, packet];
  }
}

/**
 * Retient un paquet et le libère juste après le paquet suivant du même appareil :
 * le hub reçoit seq N+1 puis N (trame en retard).
 */
export class ReorderFault implements PacketFault {
  readonly name = 'désordre';
  injected = 0;
  private readonly held = new Map<number, Buffer>();

  constructor(private readonly rate: number, private readonly random: Random) {}

  apply(packet: Buffer): Buffer[] {
    const deviceId = packet.readUInt16BE(4);
    const previous = this.held.get(deviceId);
    if (previous) {
      this.held.delete(deviceId);
      return [packet, previous];
    }
    if (this.random() < this.rate) {
      this.held.set(deviceId, packet);
      this.injected++;
      return [];
    }
    return [packet];
  }
}

/** Fait passer un paquet dans la chaîne de défauts, dans l'ordre. */
export function applyFaults(faults: readonly PacketFault[], packet: Buffer): Buffer[] {
  return faults.reduce<Buffer[]>((packets, fault) => packets.flatMap((p) => fault.apply(p)), [packet]);
}
