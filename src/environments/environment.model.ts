export interface AppEnvironment {
  production: boolean;
  name: string;
  manifestUrl: string;
  releaseMessageUrl: string;
  notifyOnDeploymentWithSameVersion: boolean;
  intervalMs: number;
}
