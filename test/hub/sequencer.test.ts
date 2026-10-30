import { describe, expect, it } from 'vitest';
import { Sequencer } from '../../src/hub/sequencer.js';

const feed = (sequencer: Sequencer, deviceId: number, seqs: number[]) => seqs.map((s) => sequencer.process(deviceId, s));

describe('Sequencer', () => {
  it('accepte une suite continue sans perte', () => {
    const sequencer = new Sequencer(64);
    expect(feed(sequencer, 1, [1, 2, 3])).toEqual(['accepted', 'accepted', 'accepted']);
    expect(sequencer.countersOf(1)).toEqual({ accepted: 3, duplicates: 0, late: 0, lost: 0 });
  });

  it('accepte la première trame quel que soit son seq', () => {
    const sequencer = new Sequencer(64);
    expect(sequencer.process(1, 5000)).toBe('accepted');
    expect(sequencer.countersOf(1).lost).toBe(0);
  });

  it('compte les trous de séquence comme pertes', () => {
    const sequencer = new Sequencer(64);
    feed(sequencer, 1, [10, 11, 14]);
    expect(sequencer.countersOf(1)).toEqual({ accepted: 3, duplicates: 0, late: 0, lost: 2 });
  });

  it('écarte un doublon immédiat', () => {
    const sequencer = new Sequencer(64);
    expect(feed(sequencer, 1, [10, 10])).toEqual(['accepted', 'duplicate']);
  });

  it('écarte un doublon plus ancien déjà reçu', () => {
    const sequencer = new Sequencer(64);
    expect(feed(sequencer, 1, [10, 11, 12, 10])).toEqual(['accepted', 'accepted', 'accepted', 'duplicate']);
  });

  it('écarte une trame en retard et annule la perte correspondante', () => {
    const sequencer = new Sequencer(64);
    expect(feed(sequencer, 1, [10, 12, 11])).toEqual(['accepted', 'accepted', 'late']);
    expect(sequencer.countersOf(1)).toEqual({ accepted: 2, duplicates: 0, late: 1, lost: 0 });
  });

  it('une trame en retard reçue deux fois : retard puis doublon', () => {
    const sequencer = new Sequencer(64);
    expect(feed(sequencer, 1, [10, 12, 11, 11])).toEqual(['accepted', 'accepted', 'late', 'duplicate']);
  });

  it('classe en retard une trame plus vieille que la fenêtre', () => {
    const sequencer = new Sequencer(4);
    feed(sequencer, 1, [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sequencer.process(1, 2)).toBe('late');
  });

  it('ne mémorise que la fenêtre lors d’un très grand trou', () => {
    const sequencer = new Sequencer(64);
    feed(sequencer, 1, [1, 1_000_001]);
    expect(sequencer.countersOf(1).lost).toBe(999_999);
    expect(sequencer.process(1, 1_000_000)).toBe('late'); // dans la fenêtre : perte annulée
    expect(sequencer.countersOf(1).lost).toBe(999_998);
  });

  it('suit chaque appareil indépendamment et totalise', () => {
    const sequencer = new Sequencer(64);
    feed(sequencer, 1, [1, 2, 2]);
    feed(sequencer, 2, [1, 3]);
    expect(sequencer.countersOf(1).duplicates).toBe(1);
    expect(sequencer.countersOf(2).lost).toBe(1);
    expect(sequencer.totals()).toEqual({ accepted: 4, duplicates: 1, late: 0, lost: 1 });
  });

  it('renvoie des compteurs à zéro pour un appareil inconnu', () => {
    expect(new Sequencer(64).countersOf(42)).toEqual({ accepted: 0, duplicates: 0, late: 0, lost: 0 });
  });
});
