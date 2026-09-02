import { useApi } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { InfoCard, MissingAnnotationEmptyState, Progress, ResponseErrorPanel, Table, TableColumn } from '@backstage/core-components';
import useAsync from 'react-use/lib/useAsync';
import { staleEnvironmentFinderApiRef, Environment } from '../api';

const GITHUB_PROJECT_SLUG_ANNOTATION = 'github.com/project-slug';

const columns: TableColumn<Environment>[] = [
  { title: 'PR', field: 'prNumber' },
  { title: 'Application', field: 'applicationName' },
  {
    title: 'Status',
    field: 'stale',
    render: row => (row.stale ? 'Stale' : 'Active'),
  },
  { title: 'Reason', field: 'reason' },
];

export function EnvironmentContents() {
  const { entity } = useEntity();
  const api = useApi(staleEnvironmentFinderApiRef);

  const projectSlug = entity.metadata.annotations?.[GITHUB_PROJECT_SLUG_ANNOTATION];
  const [owner, repo] = projectSlug?.split('/') ?? [];

  const { value, loading, error } = useAsync(async () => {
    if (!owner || !repo) {
      return [];
    }
    return api.getEnvironments(owner, repo);
  }, [api, owner, repo]);

  if (!projectSlug) {
    return <MissingAnnotationEmptyState annotation={GITHUB_PROJECT_SLUG_ANNOTATION} />;
  }

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <InfoCard title="Environments">
      <Table
        options={{ search: false, paging: false }}
        columns={columns}
        data={value ?? []}
      />
    </InfoCard>
  );
}
