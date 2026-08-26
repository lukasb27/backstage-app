import { HttpAuthService, LoggerService, PermissionsService, RootConfigService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { z } from 'zod/v3';
import express from 'express';
import Router from 'express-promise-router';
import { ScmIntegration, ScmIntegrations } from '@backstage/integration';
import { _readonly } from 'zod/v4/core';
import { listApplications } from './clients/argo';
import { listPullRequests } from './clients/github';

export async function createRouter({
  httpAuth,
  permissions,
  logger,
  integrations,
  argoBaseUrl,
  argoToken
}: {
  httpAuth: HttpAuthService;
  permissions: PermissionsService,
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
  const todoSchema = z.object({
    title: z.string(),
    entityRef: z.string().optional(),
  });

  const environmentsSchema = z.object({
    owner: z.string(),
    repo: z.string()
  })

  // router.post('/todos', async (req, res) => {
  //   const parsed = todoSchema.safeParse(req.body);
  //   if (!parsed.success) {
  //     throw new InputError(parsed.error.toString());
  //   }

    // const result = await todoList.createTodo(parsed.data, {
    //   credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    // });

    // res.status(201).json(result);
  // });
  router.get('/environments', async (req, res) => {
      const argoApplications = listApplications(argoToken, argoBaseUrl)
      const query = environmentsSchema.safeParse(req.query);
      if (!query.success) {
        throw new InputError(query.error.toString());
      }
      const { owner, repo } = query.data;
      const prs = await listPullRequests(integrations, logger, 'github.com', owner, repo)
      const prMap = {}
      for (const pr of prs) {
        prMap[pr.prNumber as string] = pr
      }
  })
  // router.get('/todos', async (_req, res) => {
  //   res.json(await todoList.listTodos());
  // });

  // router.get('/todos/:id', async (req, res) => {
  //   res.json(await todoList.getTodo({ id: req.params.id }));
  // });

  return router;
}
