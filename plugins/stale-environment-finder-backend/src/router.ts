import { LoggerService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { z } from 'zod/v3';
import express from 'express';
import Router from 'express-promise-router';
import { ScmIntegrations } from '@backstage/integration';
import { listApplications } from './clients/argo';
import { listPullRequests, PrState } from './clients/github';
import { getStaleEnvironments } from './logic/findStaleEnvironments';

export async function createRouter({
  logger,
  integrations,
  argoBaseUrl,
  argoToken
}: {
  logger: LoggerService,
  integrations: ScmIntegrations,
  argoBaseUrl: string,
  argoToken: string
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // TEMPLATE NOTE:
  // Zod is a powerful library for data validation and recommended in particular
  // for user-defined schemas. In this case we use it for input validation too.
  //
  // If you want to define a schema for your API we recommend using Backstage's
  // OpenAPI tooling: https://backstage.io/docs/next/openapi/01-getting-started
  const environmentsSchema = z.object({
    owner: z.string(),
    repo: z.string()
  })

  router.get('/environments', async (req, res) => {
      const query = environmentsSchema.safeParse(req.query);
      if (!query.success) {
        throw new InputError(query.error.toString());
      }
      const { owner, repo } = query.data;

      // Argo doesnt have a call to get a specific application for a repo. So call all applications then filter it down per repo.
      const argoApplications = (await listApplications(argoToken, argoBaseUrl)).filter((application) => application.spec.source?.kustomize?.commonAnnotations?.repoSlug === `${owner}/${repo}`)
      
      // Build an array of pr numbers that are associated with argo/repo.
      const prsInArgo: string[] = [];
      for (const application of argoApplications){ 
        const prNumber = application.spec.source?.kustomize?.commonAnnotations?.prNumber
        if (!prNumber) continue;
        prsInArgo.push(prNumber);
      }


      const prs = await listPullRequests(integrations, logger, 'github.com', owner, repo, prsInArgo)
      const prMap = new Map<string, PrState>();
      for (const pr of prs) {
        prMap.set(pr.prNumber.toString(), pr)
      }
      const staleEnvironments = getStaleEnvironments(prMap, argoApplications)
      res.json(staleEnvironments)
  })

  return router;
}
