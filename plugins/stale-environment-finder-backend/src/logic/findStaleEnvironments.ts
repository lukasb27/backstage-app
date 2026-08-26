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
    
        environments.push({prNumber: prNumber, stale: pr?.prState !== 'open', reason: `PR is in ${pr?.prState} state`, applicationName: application.metadata.name!})
        
    }

    return environments
}