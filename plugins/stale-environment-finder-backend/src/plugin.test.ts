import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import request from 'supertest';

import { staleEnvironmentFinderPlugin } from './plugin';

describe('plugin', () => {
  it('boots with argo config and mounts the /environments route', async () => {
    const { server } = await startTestBackend({
      features: [
        staleEnvironmentFinderPlugin,
        mockServices.rootConfig.factory({
          data: {
            argo: {
              token: 'test-token',
              baseUrl: 'https://argocd.example.com',
            },
          },
        }),
      ],
    });

    const response = await request(server).get(
      '/api/stale-environment-finder/environments',
    );

    expect(response.status).toBe(400);
  });
});
