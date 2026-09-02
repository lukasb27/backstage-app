import { ServiceUnavailableError } from "@backstage/errors";
import { IApplication } from "@kubernetes-models/argo-cd/argoproj.io/v1alpha1/Application";

export async function listApplications (token: string, argoBaseUrl: string ) {
    const response = await fetch(`${argoBaseUrl}/api/v1/applications`, { headers: {Authorization: `Bearer ${token}` }});
    if (response.ok) {
        const body = await response.json();
        return ((body?.items ?? []) as IApplication[]).filter((application) => application.spec.source?.kustomize?.commonAnnotations?.prNumber);
    }  
    throw new ServiceUnavailableError(`${response.status}: ${response.statusText}`);
}