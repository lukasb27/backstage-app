import { createFrontendPlugin, PageBlueprint, ApiBlueprint, discoveryApiRef, fetchApiRef } from '@backstage/frontend-plugin-api';
import { RiPuzzleLine } from '@remixicon/react';
import { rootRouteRef } from './routes';
import { exampleApiRef, DefaultExampleApi } from './api';

const examplePage = PageBlueprint.make({
    params: {
        routeRef: rootRouteRef,
        path: '/example',
        title: 'Example',
        icon: <RiPuzzleLine />,
        loader: () => 
            import('./components/ExamplePage').then(m => <m.ExamplePage />)
    },
});

const exampleApi = ApiBlueprint.make({
    name: 'example',
    params: defineParams => 
        defineParams({
            api: exampleApiRef,
            deps: {
                discoveryApi: discoveryApiRef,
                fetchApi: fetchApiRef,
            },
            factory: ({ discoveryApi, fetchApi }) => 
                new DefaultExampleApi(discoveryApi, fetchApi),
        }),
});

export const examplePlugin = createFrontendPlugin({
    pluginId: 'lukas-test-plugin',
    extensions: [exampleApi, examplePage],
    routes: {
        root: rootRouteRef,
    },
});