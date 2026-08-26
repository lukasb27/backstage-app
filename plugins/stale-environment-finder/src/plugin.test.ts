import { staleEnvironmentFinderPlugin } from './plugin';

describe('stale-environment-finder', () => {
  it('should export plugin', () => {
    expect(staleEnvironmentFinderPlugin).toBeDefined();
  });
});
