import { PrState } from "../clients/github";
import { IApplication } from "@kubernetes-models/argo-cd/argoproj.io/v1alpha1/Application";

interface Environments {
    prNumber: string
    stale: boolean
    reason: string
    applicationName: string
}
export function getStaleEnvironments (repoPrs: Map<string, PrState>, argoApps: IApplication[]){
    const environments: Environments[] = []

    for (const application of argoApps) {
        const prNumber = application.spec.source?.kustomize?.commonAnnotations?.prNumber
        
        if (!prNumber) continue;
        const pr = repoPrs.get(prNumber)

        let stale: boolean;
        let reason: string;
        
        if (!pr) {
            stale = false;
            reason = 'no matching PR found';
        } else if (pr.prState === 'open') {
            stale = false;
            reason = 'PR is open'
        } else {
            stale = true;
            reason = `PR is ${pr.prState}`;
        }

        environments.push({prNumber: prNumber, stale: stale, reason: reason, applicationName: application.metadata.name!})
        
    }

    return environments
}