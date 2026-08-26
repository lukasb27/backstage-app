import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import {
  ScmIntegrations,
} from '@backstage/integration';
/**
 * staleEnvironmentFinderPlugin backend plugin
 *
 * @public
 */
export const staleEnvironmentFinderPlugin = createBackendPlugin({
  pluginId: 'stale-environment-finder',
  register(env) {
    env.registerInit({
      deps: {
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        permissions: coreServices.permissions,
        logger: coreServices.logger,
        rootConfig: coreServices.rootConfig
      },
      async init({ httpAuth, httpRouter, permissions, logger, rootConfig }) {
        const integrations = ScmIntegrations.fromConfig(rootConfig);
        const argoToken = rootConfig.getString('argo.token')
        const argoBaseUrl = rootConfig.getString('argo.baseUrl')

        httpRouter.use(
          await createRouter({
            httpAuth,
            permissions,
            logger,
            integrations,
            argoToken,
            argoBaseUrl
          }),
        );
      },
    });
  },
});
