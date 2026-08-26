import { compareVersions, isNewerVersion } from '../lib/version.js';

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.13.0', '1.12.1')).toBe(1);
    expect(compareVersions('1.12.1', '1.13.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.12.2', '1.12.10')).toBe(-1);
    expect(compareVersions('1.13.0', '1.13.0')).toBe(0);
  });

  it('tolerates a v prefix and missing parts', () => {
    expect(compareVersions('v1.13.0', '1.13.0')).toBe(0);
    expect(compareVersions('1.13', '1.13.0')).toBe(0);
  });

  it('ranks a pre-release below its release', () => {
    expect(compareVersions('1.13.0-beta.1', '1.13.0')).toBe(-1);
    expect(compareVersions('1.13.0', '1.13.0-beta.1')).toBe(1);
  });
});

describe('isNewerVersion', () => {
  it('only flags strictly newer remote versions', () => {
    expect(isNewerVersion('1.13.1', '1.13.0')).toBe(true);
    expect(isNewerVersion('1.13.0', '1.13.0')).toBe(false);
    // the bug this replaces: an older remote used to look like an update
    expect(isNewerVersion('1.12.1', '1.13.0')).toBe(false);
  });

  it('never flags an update on missing data', () => {
    expect(isNewerVersion(null, '1.13.0')).toBe(false);
    expect(isNewerVersion('1.14.0', null)).toBe(false);
  });
});
