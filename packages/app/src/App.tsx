import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import githubActionsPlugin from '@backstage-community/plugin-github-actions/alpha';
import techDocsPlugin from '@backstage/plugin-techdocs/alpha';
import { techDocsMermaidAddonModule } from 'backstage-plugin-techdocs-addon-mermaid';
import { examplePlugin } from './plugin';
import staleEnvironmentFinderPlugin from '@internal/backstage-plugin-stale-environment-finder';

export default createApp({
  features: [
    catalogPlugin,
    githubActionsPlugin,
    navModule,
    examplePlugin,
    techDocsPlugin,
    techDocsMermaidAddonModule,
    staleEnvironmentFinderPlugin
  ],
});
