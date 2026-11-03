import config from './playwright.config.js'

export default { ...config, projects: [{ name: 'firefox', use: { browserName: 'firefox' } }] }
