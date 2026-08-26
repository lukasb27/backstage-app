import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/frontend-plugin-api';

export interface ExampleApi {
    getExample(): Promise<{ title: string }>;
}

export const exampleApiRef = createApiRef<ExampleApi>().with({
    id: 'plugin.lukas-test-plugin.api',
    pluginId: 'lukas-test-plugin'
});

export class DefaultExampleApi implements ExampleApi {
    constructor(
        private readonly discoveryApi: DiscoveryApi,
        private readonly fetchApi: FetchApi,
    ) {}
    async getExample() { 
        const baseUrl = await this.discoveryApi.getBaseUrl('lukas-test-plugin');
        const response = await this.fetchApi.fetch(`${baseUrl}/header`);
        return response.json();
    }
}

