import { CAR_NUMBER_SPECS, CAR_TEXT_SPECS, ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared';

/** Libellés des caractéristiques, partagés par les feuilles qui les montrent. */
export const CAR_SPEC_LABELS = {
  scale: 'Échelle',
  chassis: 'Châssis',
  motor: 'Moteur',
  gearRatio: 'Rapport',
  tyresFront: 'Pneus avant',
  tyresRear: 'Pneus arrière',
  guide: 'Guide',
  braids: 'Tresses',
  magnet: 'Aimant',
  notes: 'Notes',
  weightGrams: 'Poids (g)',
  lengthMm: 'Longueur (mm)',
  widthMm: 'Largeur (mm)',
  wheelbaseMm: 'Empattement (mm)',
  frontTrackMm: 'Voie avant (mm)',
  rearTrackMm: 'Voie arrière (mm)',
  groundClearanceMm: 'Garde au sol (mm)',
};

export const CAR_SPECS = [...CAR_TEXT_SPECS, ...CAR_NUMBER_SPECS];

/** Colonnes des caractéristiques réellement renseignées sur au moins une voiture. */
export function carSpecColumns(cars) {
  return CAR_SPECS.filter((field) => field !== 'notes')
    .filter((field) => cars.some((car) => car?.[field] != null && car[field] !== ''))
    .map((field) => ({
      header: CAR_SPEC_LABELS[field] ?? field,
      value: (car) => car[field] ?? null,
      width: 14,
    }));
}

export const carLabel = (car) => (car ? `${car.brand} ${car.model}` : null);

export const SESSION_TYPE_LABELS = {
  [SessionType.PRACTICE]: 'Essais libres',
  [SessionType.QUALIF]: 'Qualifications',
  [SessionType.RACE]: 'Course',
  [SessionType.BALANCING]: 'Équilibrage',
};

export const SESSION_STATUS_LABELS = {
  [SessionStatus.DRAFT]: 'brouillon',
  [SessionStatus.READY]: 'prête',
  [SessionStatus.ACTIVE]: 'en cours',
  [SessionStatus.PAUSED]: 'en pause',
  [SessionStatus.FINISHING]: 'dernier tour',
  [SessionStatus.FINISHED]: 'terminée',
};

export const CHAMPIONSHIP_STATUS_LABELS = {
  [ChampionshipStatus.PLANNED]: 'planifié',
  [ChampionshipStatus.ACTIVE]: 'en cours',
  [ChampionshipStatus.FINISHED]: 'terminé',
};

/** Onglets teintés par nature, pour se repérer dans un championnat de vingt courses. */
export const TAB_COLORS = {
  championship: 'FF1B2A41',
  reference: 'FF6B7280',
  [SessionType.PRACTICE]: 'FF9CA3AF',
  [SessionType.QUALIF]: 'FF3B82F6',
  [SessionType.RACE]: 'FF16A34A',
  [SessionType.BALANCING]: 'FFA855F7',
  default: 'FF9CA3AF',
};
