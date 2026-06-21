import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'Prod',
  manifestUrl: './version.json',
  releaseMessageUrl: './release-message/general.json',
  notifyOnDeploymentWithSameVersion: false,
  intervalMs: 60000
};
