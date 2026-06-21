import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  name: 'Update Banner',
  manifestUrl: './version.json',
  releaseMessageUrl: './release-message/general.json',
  notifyOnDeploymentWithSameVersion: true,
  intervalMs: 60000
};
