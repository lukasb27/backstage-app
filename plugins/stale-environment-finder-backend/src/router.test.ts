import { mockServices, mockErrorHandler } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { ScmIntegrations } from '@backstage/integration';
import { ServiceUnavailableError } from '@backstage/errors';
import { IApplication } from '@kubernetes-models/argo-cd/argoproj.io/v1alpha1/Application';

import { createRouter } from './router';
import { listApplications } from './clients/argo';
import { listPullRequests, PrState } from './clients/github';

jest.mock('./clients/argo');
jest.mock('./clients/github');

const mockListApplications = listApplications as jest.MockedFunction<
  typeof listApplications
>;
const mockListPullRequests = listPullRequests as jest.MockedFunction<
  typeof listPullRequests
>;

function buildApplication(options: {
  name: string;
  prNumber?: string;
  repoSlug?: string;
}): IApplication {
  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: { name: options.name },
    spec: {
      project: 'default',
      destination: {},
      source: {
        repoURL: 'https://github.com/example/example.git',
        kustomize: {
          commonAnnotations: {
            ...(options.prNumber ? { prNumber: options.prNumber } : {}),
            ...(options.repoSlug ? { repoSlug: options.repoSlug } : {}),
          },
        },
      },
    },
  };
}

function buildPr(overrides: Partial<PrState>): PrState {
  return {
    repo: 'service-a',
    prNumber: 1,
    prState: 'open',
    ...overrides,
  };
}

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    jest.resetAllMocks();

    const router = await createRouter({
      logger: mockServices.logger.mock(),
      integrations: {} as unknown as ScmIntegrations,
      argoBaseUrl: 'https://argocd.example.com',
      argoToken: 'test-token',
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('returns environments for the requested repo, correctly marking open and closed PRs', async () => {
    mockListApplications.mockResolvedValue([
      buildApplication({
        name: 'service-a-pr-5',
        prNumber: '5',
        repoSlug: 'acme/service-a',
      }),
      buildApplication({
        name: 'service-a-pr-6',
        prNumber: '6',
        repoSlug: 'acme/service-a',
      }),
    ]);
    mockListPullRequests.mockResolvedValue([
      buildPr({ prNumber: 5, prState: 'open' }),
      buildPr({ prNumber: 6, prState: 'closed' }),
    ]);

    const response = await request(app)
      .get('/environments')
      .query({ owner: 'acme', repo: 'service-a' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        prNumber: '5',
        stale: false,
        reason: 'PR is open',
        applicationName: 'service-a-pr-5',
      },
      {
        prNumber: '6',
        stale: true,
        reason: 'PR is closed',
        applicationName: 'service-a-pr-6',
      },
    ]);
    expect(mockListPullRequests).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'github.com',
      'acme',
      'service-a',
      ['5', '6'],
    );
  });

  it('returns 400 and never calls Argo or GitHub when owner/repo are missing', async () => {
    const response = await request(app).get('/environments');

    expect(response.status).toBe(400);
    expect(mockListApplications).not.toHaveBeenCalled();
    expect(mockListPullRequests).not.toHaveBeenCalled();
  });

  it('returns 503 when Argo is unavailable, instead of a false-all-clear empty list', async () => {
    mockListApplications.mockRejectedValue(
      new ServiceUnavailableError('502: Bad Gateway'),
    );

    const response = await request(app)
      .get('/environments')
      .query({ owner: 'acme', repo: 'service-a' });

    expect(response.status).toBe(503);
    expect(mockListPullRequests).not.toHaveBeenCalled();
  });

  it('excludes Argo applications belonging to a different repo, even with a colliding PR number', async () => {
    mockListApplications.mockResolvedValue([
      buildApplication({
        name: 'service-a-pr-7',
        prNumber: '7',
        repoSlug: 'acme/service-a',
      }),
      buildApplication({
        name: 'other-repo-pr-7',
        prNumber: '7',
        repoSlug: 'other-org/other-repo',
      }),
    ]);
    mockListPullRequests.mockResolvedValue([
      buildPr({ prNumber: 7, prState: 'open' }),
    ]);

    const response = await request(app)
      .get('/environments')
      .query({ owner: 'acme', repo: 'service-a' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        prNumber: '7',
        stale: false,
        reason: 'PR is open',
        applicationName: 'service-a-pr-7',
      },
    ]);
  });

  it('marks an environment with no matching PR as not stale, with a distinct reason', async () => {
    mockListApplications.mockResolvedValue([
      buildApplication({
        name: 'service-a-pr-99',
        prNumber: '99',
        repoSlug: 'acme/service-a',
      }),
    ]);
    mockListPullRequests.mockResolvedValue([]);

    const response = await request(app)
      .get('/environments')
      .query({ owner: 'acme', repo: 'service-a' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        prNumber: '99',
        stale: false,
        reason: 'no matching PR found',
        applicationName: 'service-a-pr-99',
      },
    ]);
  });
});
