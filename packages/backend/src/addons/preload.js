import path from 'path';
import { registerAddonHooks } from './hooks.js';

// Loaded with `node --import` by the dev and start scripts: an override only applies
// if the hooks are in place before the server imports the file it replaces.
registerAddonHooks(path.resolve(import.meta.dirname, '../../../..'));
