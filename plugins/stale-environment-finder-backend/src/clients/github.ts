import { LoggerService } from "@backstage/backend-plugin-api";
import { DefaultGithubCredentialsProvider, ScmIntegrations } from '@backstage/integration';
import { Octokit } from 'octokit';

export interface PrState {
    repo: string;
    prNumber: number;
    prState: 'open' | 'closed' | 'merged';
}

export async function listPullRequests(
    integrations: ScmIntegrations,
    logger: LoggerService,
    host: string,
    owner: string,
    repo: string
): Promise<PrState[]>{
    const githubCredentialsProvider = DefaultGithubCredentialsProvider.fromIntegrations(integrations);
    const { token } = await githubCredentialsProvider.getCredentials({url:`https://${host}/${owner}/${repo}`});
    const integrationConfig = integrations.github.byHost(host)?.config

    const client = new Octokit({ auth: token, baseUrl: integrationConfig?.apiBaseUrl, log: logger})

    const prs = await client.paginate(client.rest.pulls.list, { owner, repo, state: 'all', per_page: 100})

    return prs.map(pr => ({
        repo,
        prNumber: pr.number,
        prState: (pr.merged_at ? 'merged' : pr.state) as PrState['prState']
    }));
}