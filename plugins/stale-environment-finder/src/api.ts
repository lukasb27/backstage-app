import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/frontend-plugin-api';

export interface Environment {
  prNumber: string;
  stale: boolean;
  reason: string;
  applicationName: string;
}

export interface StaleEnvironmentFinderApi {
  getEnvironments(owner: string, repo: string): Promise<Environment[]>;
}

export const staleEnvironmentFinderApiRef = createApiRef<StaleEnvironmentFinderApi>().with({
  id: 'plugin.stale-environment-finder.api',
  pluginId: 'stale-environment-finder',
});

export class DefaultStaleEnvironmentFinderApi implements StaleEnvironmentFinderApi {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  async getEnvironments(owner: string, repo: string): Promise<Environment[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('stale-environment-finder');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/environments?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch environments: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}
