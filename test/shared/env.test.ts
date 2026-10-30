import { describe, expect, it } from 'vitest';
import { readInt, readString } from '../../src/shared/env.js';

describe('readInt', () => {
  it('retourne la valeur par défaut si la variable est absente', () => {
    expect(readInt({}, 'PORT', 9000)).toBe(9000);
  });

  it('lit un entier valide', () => {
    expect(readInt({ PORT: '9100' }, 'PORT', 9000)).toBe(9100);
  });

  it('rejette une valeur non entière ou hors bornes', () => {
    expect(() => readInt({ PORT: 'abc' }, 'PORT', 9000)).toThrow(/PORT/);
    expect(() => readInt({ PORT: '70000' }, 'PORT', 9000, 1, 65535)).toThrow(/PORT/);
  });
});

describe('readString', () => {
  it('retourne la valeur par défaut si la variable est vide', () => {
    expect(readString({ HOST: '  ' }, 'HOST', '127.0.0.1')).toBe('127.0.0.1');
  });
});
