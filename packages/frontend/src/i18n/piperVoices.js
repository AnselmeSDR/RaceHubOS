import i18n from './index'
const messages = {
  de: {
    unavailable: 'Keine passende Sprachausgabe verfügbar.',
    selection: 'Sprachausgabe',
    auto: 'Piper · automatisch nach Sprache',
    available:
      'Installierte Piper-Stimmen verfügbar. Fehlende oder nicht passende Stimmen verwenden die Browser-Sprachausgabe.',
    missing:
      'Keine lokale Piper-Stimme erkannt. Browserstimmen bleiben nutzbar. Sprachpakete separat installieren und die Seite neu laden.',
    fallback: 'Lokale Stimme nicht verfügbar; Browser-Sprachausgabe wird verwendet.',
    engine: 'Über die optionale Piper-Sprachausgabe',
  },
  en: {
    unavailable: 'No speech output is available.',
    selection: 'Speech output',
    auto: 'Piper · follow interface language',
    available: 'Installed Piper voices available. Missing or mismatched voices use browser speech.',
    missing:
      'No local Piper voice detected. Browser voices remain available. Install voice packs separately, then reload this page.',
    fallback: 'Local voice unavailable; using browser speech.',
    engine: 'About optional Piper speech',
  },
  fr: {
    unavailable: 'Aucune sortie vocale disponible.',
    selection: 'Sortie vocale',
    auto: 'Piper · suivre la langue de l’interface',
    available: 'Voix Piper installées disponibles. Une voix absente ou incompatible utilise la synthèse du navigateur.',
    missing:
      'Aucune voix Piper locale détectée. Les voix du navigateur restent disponibles. Installez les voix séparément, puis rechargez la page.',
    fallback: 'Voix locale indisponible ; synthèse du navigateur utilisée.',
    engine: 'À propos de la synthèse Piper facultative',
  },
}
for (const [language, values] of Object.entries(messages))
  i18n.addResourceBundle(language, 'piperVoices', values, true, false)
