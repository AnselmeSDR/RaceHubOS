import { createRequire } from 'module';
import path from 'path';

/**
 * The Prisma CLI, as a plain JavaScript file run by node.
 *
 * Calling it through npx breaks on Windows twice over: npx is a .cmd, an
 * extension execFileSync does not resolve (ENOENT), and since the BatBadBut
 * fixes node refuses to spawn a .cmd without a shell at all (EINVAL). A shell
 * would then bring its own quoting problems on paths containing spaces.
 *
 * Resolving the CLI's entry point sidesteps all of it: same node, no shell, no
 * quoting. Neither failure shows on macOS or Linux — both surfaced on the race
 * PC, mid-migration.
 */
export function prismaCli() {
  const require = createRequire(import.meta.url);
  return path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
}
