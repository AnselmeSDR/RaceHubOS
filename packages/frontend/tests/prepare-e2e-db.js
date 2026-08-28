/**
 * Creates the throwaway end-to-end database before the backend boots.
 *
 * Playwright runs globalSetup in parallel with its webServers, so the server
 * could otherwise query tables that do not exist yet.
 */
import globalSetup from './globalSetup.js'

globalSetup()
