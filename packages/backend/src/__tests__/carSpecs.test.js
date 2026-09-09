import { CAR_NUMBER_SPECS, CAR_SPECS, CAR_TEXT_SPECS, carSpecsFrom } from '@racehubos/shared';

/**
 * L'équipement réel d'une voiture : ce qui est monté dessus, et ses mesures.
 * Tout est facultatif — une voiture non documentée reste utilisable.
 */
describe('caractéristiques d\'une voiture', () => {
  it('couvre l\'équipement et les mesures', () => {
    expect(CAR_SPECS).toEqual([...CAR_TEXT_SPECS, ...CAR_NUMBER_SPECS]);
    expect(CAR_TEXT_SPECS).toContain('motor');
    expect(CAR_TEXT_SPECS).toContain('tyresRear');
    expect(CAR_NUMBER_SPECS).toContain('weightGrams');
    expect(CAR_NUMBER_SPECS).toContain('wheelbaseMm');
  });

  it('nettoie les espaces autour du texte', () => {
    expect(carSpecsFrom({ motor: '  Mabuchi S-Can  ' }).motor).toBe('Mabuchi S-Can');
  });

  /** Une chaîne vide veut dire « pas renseigné », pas « vide ». */
  it('enregistre un champ vide comme absent', () => {
    expect(carSpecsFrom({ motor: '', guide: '   ' })).toMatchObject({ motor: null, guide: null });
  });

  it('lit le poids en entier et les longueurs en décimal', () => {
    const specs = carSpecsFrom({ weightGrams: '82', wheelbaseMm: '81.5' });

    expect(specs.weightGrams).toBe(82);
    expect(specs.wheelbaseMm).toBe(81.5);
  });

  it('ignore une mesure qui n\'est pas un nombre', () => {
    expect(carSpecsFrom({ weightGrams: 'lourd' }).weightGrams).toBeNull();
  });

  it('remplit tous les champs à la création, même absents du formulaire', () => {
    const specs = carSpecsFrom({});

    for (const field of CAR_SPECS) expect(specs[field]).toBeNull();
  });

  /** En modification, un champ non envoyé ne doit pas être effacé. */
  it('ne touche qu\'aux champs envoyés lors d\'une modification', () => {
    const specs = carSpecsFrom({ motor: 'Slot.it' }, { partial: true });

    expect(specs).toEqual({ motor: 'Slot.it' });
    expect('guide' in specs).toBe(false);
  });

  it('permet d\'effacer un champ en envoyant une valeur vide', () => {
    expect(carSpecsFrom({ motor: '' }, { partial: true })).toEqual({ motor: null });
  });
});
