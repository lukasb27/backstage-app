import { screen, waitFor } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { Entity } from '@backstage/catalog-model';

import { EnvironmentContents } from './EnvironmentContents';
import { staleEnvironmentFinderApiRef, StaleEnvironmentFinderApi } from '../api';

describe('EnvironmentContents', () => {
  it('does not call the API when the entity has no github.com/project-slug annotation', async () => {
    const getEnvironments = jest.fn().mockResolvedValue([]);
    const mockApi: StaleEnvironmentFinderApi = { getEnvironments };

    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'unannotated-component', namespace: 'default' },
      spec: { type: 'service', owner: 'me' },
    };

    await renderInTestApp(
      <EntityProvider entity={entity}>
        <EnvironmentContents />
      </EntityProvider>,
      { apis: [[staleEnvironmentFinderApiRef, mockApi]] },
    );

    await waitFor(() => {
      expect(screen.getByText('github.com/project-slug')).toBeInTheDocument();
    });

    expect(getEnvironments).not.toHaveBeenCalled();
  });
});
