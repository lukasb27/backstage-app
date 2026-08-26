import {
    createBackendPlugin,
    coreServices,
} from '@backstage/backend-plugin-api';
import { createExampleRouter } from './router';

export const examplePlugin = createBackendPlugin({
    pluginId: 'lukas-test-plugin',
    register(env) {
        env.registerInit({
            deps: {
                logger: coreServices.logger,
                httpRouter: coreServices.httpRouter,
            },
            async init({
                logger,
                httpRouter,
            }) {
                const example = createExampleRouter(logger);
                logger.info('Hello from lukas-test-plugin');
                httpRouter.use(example);
            },
        });
    },
});

export {examplePlugin as default } from './plugin';