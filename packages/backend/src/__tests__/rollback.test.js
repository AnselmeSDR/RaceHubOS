import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { rollback } from '../routes/update.js';

/**
 * Integration test on a real git repository: a failed update must put the
 * working tree back on the previous commit, dependencies and build included.
 */
describe('rollback', () => {
  let repo;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-rollback-'));
    const git = (cmd) => execSync(`git ${cmd}`, { cwd: repo, stdio: 'pipe' });

    git('init -q');
    git('config user.email test@racehubos.local');
    git('config user.name Test');
    git('config commit.gpgsign false');

    // v1: the version we must be able to come back to
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
      name: 'rollback-fixture', version: '1.0.0', private: true,
      scripts: { build: 'node -e "require(\'fs\').writeFileSync(\'dist.txt\', require(\'./package.json\').version)"' },
    }, null, 2));
    fs.writeFileSync(path.join(repo, 'marker.txt'), 'v1');
    git('add -A');
    git('commit -q -m v1');
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('restores the previous commit, its files and its build', async () => {
    const previousCommit = execSync('git rev-parse HEAD', { cwd: repo }).toString().trim();

    // v2: the broken update
    fs.writeFileSync(path.join(repo, 'marker.txt'), 'v2-broken');
    execSync('git add -A && git commit -q -m v2', { cwd: repo, stdio: 'pipe' });
    expect(fs.readFileSync(path.join(repo, 'marker.txt'), 'utf-8')).toBe('v2-broken');

    await rollback(previousCommit, 'build failed', { cwd: repo });

    expect(execSync('git rev-parse HEAD', { cwd: repo }).toString().trim()).toBe(previousCommit);
    expect(fs.readFileSync(path.join(repo, 'marker.txt'), 'utf-8')).toBe('v1');
    // the build was re-run against the restored sources
    expect(fs.readFileSync(path.join(repo, 'dist.txt'), 'utf-8')).toBe('1.0.0');
  }, 120000);

  it('surfaces the failure instead of swallowing it when restoration is impossible', async () => {
    await expect(rollback('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'build failed', { cwd: repo }))
      .rejects.toThrow();
  }, 60000);
});
