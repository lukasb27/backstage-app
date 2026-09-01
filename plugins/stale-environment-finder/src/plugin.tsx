import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';

import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha'
import { DefaultStaleEnvironmentFinderApi, staleEnvironmentFinderApiRef } from './api';

const environmentsContent = EntityContentBlueprint.make({
  params: {
    path: '/environments',
    title: 'Environments',
    filter: { kind: 'component' },
    loader: () =>
      import('./components/EnvironmentContents').then(m => <m.EnvironmentContents />),
  },
});

const staleEnvironmentFinderApi = ApiBlueprint.make({
  name: 'stale-environment-finder',
  params: defineParams =>
    defineParams({
      api: staleEnvironmentFinderApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new DefaultStaleEnvironmentFinderApi(discoveryApi, fetchApi),
    }),
});

export const staleEnvironmentFinderPlugin = createFrontendPlugin({
  pluginId: 'stale-environment-finder',
  extensions: [environmentsContent, staleEnvironmentFinderApi],
});

