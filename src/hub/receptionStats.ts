import type { DecodeErrorReason, DecodeResult } from '../protocol/types.js';

export interface ReceptionSnapshot {
  /** Datagrammes reçus sur la socket, valides ou non. */
  received: number;
  valid: number;
  invalid: number;
  /** Détail des trames invalides par raison de rejet. */
  invalidByReason: Partial<Record<DecodeErrorReason, number>>;
}

/**
 * Compteurs de santé de la réception.
 * Ne connaît pas le réseau : on lui passe le résultat du décodeur, ce qui la rend testable sans socket.
 */
export class ReceptionStats {
  private received = 0;
  private valid = 0;
  private readonly invalidByReason: Partial<Record<DecodeErrorReason, number>> = {};

  record(result: DecodeResult): void {
    this.received++;
    if (result.ok) {
      this.valid++;
    } else {
      this.invalidByReason[result.reason] = (this.invalidByReason[result.reason] ?? 0) + 1;
    }
  }

  snapshot(): ReceptionSnapshot {
    return {
      received: this.received,
      valid: this.valid,
      invalid: this.received - this.valid,
      invalidByReason: { ...this.invalidByReason },
    };
  }
}
