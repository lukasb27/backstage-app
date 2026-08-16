import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import {
  createTemplateAction,
  parseRepoUrl,
  scaffolderActionsExtensionPoint,
} from '@backstage/plugin-scaffolder-node';
import { Octokit } from 'octokit';

// GITHUB_TOKEN in a scaffolded repo's own workflow can't do this: "administration"
// is not a valid key in a workflow's `permissions:` block (confirmed against
// GitHub's workflow-syntax docs — the full valid list is actions,
// artifact-metadata, attestations, checks, code-quality, contents, deployments,
// discussions, id-token, issues, packages, pages, pull-requests, security-events,
// statuses, vulnerability-alerts). A self-triggered in-repo workflow can never do
// this, no matter how it's written. Doing it here instead, at scaffold time, reuses
// the same GitHub integration credentials (backstage-scaffolder-github-token) that
// already set branch protection a few steps earlier in the same template.
export function createRestrictPrCreationAction(integrations: ScmIntegrations) {
  const githubCredentialsProvider =
    DefaultGithubCredentialsProvider.fromIntegrations(integrations);

  return createTemplateAction({
    id: 'goldenPath:restrictPrCreation',
    description:
      "Sets a GitHub repository's pull_request_creation_policy to collaborators_only, using Backstage's own GitHub integration credentials.",
    schema: {
      input: {
        repoUrl: (z: any) =>
          z.string({
            description:
              'Accepts the format `github.com?repo=reponame&owner=owner`',
          }),
      },
    },
    async handler(ctx) {
      const { repoUrl } = ctx.input as { repoUrl: string };
      const { host, owner, repo } = parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new InputError(`No owner provided for repo ${repoUrl}`);
      }

      const integrationConfig = integrations.github.byHost(host)?.config;
      if (!integrationConfig) {
        throw new InputError(`No GitHub integration found for host ${host}`);
      }

      const { token } = await githubCredentialsProvider.getCredentials({
        url: `https://${host}/${encodeURIComponent(owner)}/${encodeURIComponent(
          repo,
        )}`,
      });
      if (!token) {
        throw new InputError(
          `No token available for host: ${host}, owner ${owner}, repo ${repo}`,
        );
      }

      const client = new Octokit({
        auth: token,
        baseUrl: integrationConfig.apiBaseUrl,
        log: ctx.logger,
      });

      await ctx.checkpoint({
        key: `restrict.pr.creation.${owner}.${repo}`,
        fn: async () => {
          // Untyped route: pull_request_creation_policy is a newer field
          // (github/roadmap#1232) not yet in Octokit's REST route types.
          const request: (route: string, params: unknown) => Promise<unknown> =
            client.request;
          await request('PATCH /repos/{owner}/{repo}', {
            owner,
            repo,
            pull_request_creation_policy: 'collaborators_only',
          });
        },
      });

      ctx.logger.info(
        `Set pull_request_creation_policy=collaborators_only on ${owner}/${repo}`,
      );
    },
  });
}

const goldenPathActionsModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'golden-path-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder, config }) {
        const integrations = ScmIntegrations.fromConfig(config);
        scaffolder.addActions(createRestrictPrCreationAction(integrations));
      },
    });
  },
});

export default goldenPathActionsModule;
