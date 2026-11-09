/** Pages using each component shown on the Displays page (empty: unused). */
export const COMPONENT_USAGE = {
  // Driver displays
  DriverListItem: ['Drivers.jsx'],
  DriverBadge: [],
  DriverGridPosition: [],
  DriverProfileHeader: ['DriverProfile.jsx'],
  DriverStanding: [],
  DriverSelectCard: [],

  // Race components
  Leaderboard: ['RaceControl.jsx', 'RacePage.jsx', 'ChampionshipDetail.jsx'],
  LapTime: [
    'RaceControl.jsx',
    'FreePractice.jsx',
    'ChampionshipDetail.jsx',
    'StandingsTabs.jsx',
    'TrackRecordsPanel.jsx',
    'FreePracticeEntry.jsx',
  ],
  StateChip: ['RaceControl.jsx', 'FreePractice.jsx', 'FreePracticeHeader.jsx'],
  GapDisplay: ['Leaderboard.jsx'],
  FreePracticeLeaderboard: ['RacePage.jsx', 'ChampionshipDetail.jsx'],
  FreePracticeEntry: ['FreePracticeLeaderboard.jsx'],
  ControllerConfigSection: ['RacePage.jsx', 'ChampionshipDetail.jsx'],
  TrackRecordsPanel: ['RacePage.jsx'],

  // CRUD components
  PageHeader: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  ViewToggleButtons: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  EmptyState: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  EntityCard: [],
  StatBadge: [],
  PhotoUploadField: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx'],
  ColorPickerField: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx'],
  FormModal: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  RangeField: ['Cars.jsx'],

  // Config components
  ConfigPanel: ['FreePractice.jsx'],
  ConfigStatus: ['FreePractice.jsx', 'ControllerConfigSection.jsx'],

  // UI components
  Modal: ['FormModal.jsx', 'SessionModal.jsx'],
  ErrorMessage: [
    'Tracks.jsx',
    'Drivers.jsx',
    'Teams.jsx',
    'SessionDetail.jsx',
    'SessionsList.jsx',
    'Sessions.jsx',
    'Cars.jsx',
    'Stats.jsx',
  ],
}
