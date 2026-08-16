import { ConfigReader } from '@backstage/config';
import { InputError } from '@backstage/errors';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import type { ActionContext } from '@backstage/plugin-scaffolder-node';
import { Octokit } from 'octokit';
import { createRestrictPrCreationAction } from '../goldenPathActions';

jest.mock('octokit');

const MockedOctokit = Octokit as jest.MockedClass<typeof Octokit>;

function buildIntegrations(
  hosts: Array<{ host: string; apiBaseUrl?: string }> = [
    { host: 'github.com' },
  ],
) {
  return ScmIntegrations.fromConfig(
    new ConfigReader({
      integrations: {
        github: hosts.map(({ host, apiBaseUrl }) => ({
          host,
          token: 'integration-config-token',
          ...(apiBaseUrl ? { apiBaseUrl } : {}),
        })),
      },
    }),
  );
}

function buildContext(
  input: Record<string, unknown>,
): ActionContext<any, any, 'v2'> {
  return {
    input,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(),
    } as any,
    checkpoint: (async ({ fn }: { fn: () => unknown }) => fn()) as any,
    workspacePath: '/tmp/does-not-matter',
    output: jest.fn(),
    createTemporaryDirectory: jest.fn(),
    getInitiatorCredentials: jest.fn(),
    task: { id: 'task-1' },
  } as unknown as ActionContext<any, any, 'v2'>;
}

describe('goldenPath:restrictPrCreation', () => {
  let requestMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    requestMock = jest.fn().mockResolvedValue({ status: 200 });
    MockedOctokit.mockImplementation(
      () => ({ request: requestMock }) as unknown as Octokit,
    );
  });

  it('PATCHes pull_request_creation_policy=collaborators_only for the parsed owner/repo, using the integration credential', async () => {
    const integrations = buildIntegrations([
      { host: 'github.com', apiBaseUrl: 'https://api.github.com' },
    ]);
    const getCredentials = jest
      .spyOn(DefaultGithubCredentialsProvider.prototype, 'getCredentials')
      .mockResolvedValue({ token: 'scaffolder-token', type: 'token' } as any);

    const action = createRestrictPrCreationAction(integrations);
    const ctx = buildContext({
      repoUrl: 'github.com?owner=lukasb27&repo=lukas-test-e2e-verify',
    });

    await action.handler(ctx);

    expect(getCredentials).toHaveBeenCalledWith({
      url: 'https://github.com/lukasb27/lukas-test-e2e-verify',
    });
    expect(MockedOctokit).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: 'scaffolder-token',
        baseUrl: 'https://api.github.com',
      }),
    );
    expect(requestMock).toHaveBeenCalledWith('PATCH /repos/{owner}/{repo}', {
      owner: 'lukasb27',
      repo: 'lukas-test-e2e-verify',
      pull_request_creation_policy: 'collaborators_only',
    });
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('lukasb27/lukas-test-e2e-verify'),
    );
  });

  it('throws InputError and never calls GitHub when repoUrl has no owner', async () => {
    const integrations = buildIntegrations();
    const action = createRestrictPrCreationAction(integrations);
    const ctx = buildContext({
      repoUrl: 'github.com?repo=lukas-test-e2e-verify',
    });

    await expect(action.handler(ctx)).rejects.toThrow(InputError);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('throws InputError when the host has no configured GitHub integration', async () => {
    const integrations = buildIntegrations([{ host: 'github.com' }]);
    const action = createRestrictPrCreationAction(integrations);
    const ctx = buildContext({
      repoUrl: 'ghe.example.net?owner=lukasb27&repo=lukas-test-e2e-verify',
    });

    await expect(action.handler(ctx)).rejects.toThrow(InputError);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('throws InputError when the credentials provider returns no token', async () => {
    const integrations = buildIntegrations();
    jest
      .spyOn(DefaultGithubCredentialsProvider.prototype, 'getCredentials')
      .mockResolvedValue({ token: undefined, type: 'token' } as any);

    const action = createRestrictPrCreationAction(integrations);
    const ctx = buildContext({
      repoUrl: 'github.com?owner=lukasb27&repo=lukas-test-e2e-verify',
    });

    await expect(action.handler(ctx)).rejects.toThrow(InputError);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('propagates a GitHub API failure (e.g. insufficient scope) instead of swallowing it', async () => {
    const integrations = buildIntegrations();
    jest
      .spyOn(DefaultGithubCredentialsProvider.prototype, 'getCredentials')
      .mockResolvedValue({ token: 'scaffolder-token', type: 'token' } as any);
    requestMock.mockRejectedValue(new Error('Resource not accessible'));

    const action = createRestrictPrCreationAction(integrations);
    const ctx = buildContext({
      repoUrl: 'github.com?owner=lukasb27&repo=lukas-test-e2e-verify',
    });

    await expect(action.handler(ctx)).rejects.toThrow(
      'Resource not accessible',
    );
  });
});
