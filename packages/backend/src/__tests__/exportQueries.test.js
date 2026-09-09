import { idsFromQuery } from '../lib/exportQueries.js';

describe('sélection transmise par l\'URL', () => {
  it('lit une liste séparée par des virgules', () => {
    expect(idsFromQuery('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('ignore les espaces et les entrées vides', () => {
    expect(idsFromQuery(' a , , b ')).toEqual(['a', 'b']);
  });

  it('ne garde qu\'une fois un identifiant répété', () => {
    expect(idsFromQuery('a,b,a')).toEqual(['a', 'b']);
  });

  it('rend une liste vide quand rien n\'est sélectionné', () => {
    expect(idsFromQuery('')).toEqual([]);
    expect(idsFromQuery(undefined)).toEqual([]);
  });
});
