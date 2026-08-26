import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef } from './routes';

export const page = PageBlueprint.make({
  params: {
    path: '/stale-environment-finder',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/TodoPage').then(m => (
        <m.TodoPage />
      )),
  },
});

export const staleEnvironmentFinderPlugin = createFrontendPlugin({
  pluginId: 'stale-environment-finder',
  extensions: [page],
  routes: {
    root: rootRouteRef,
  }
});
