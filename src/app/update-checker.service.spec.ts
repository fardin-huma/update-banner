import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UpdateCheckerService } from './update-checker.service';

describe('UpdateCheckerService', () => {
  const manifestUrl = './version.json';
  const releaseMessageUrl = './release-message/general.json';
  const intervalMs = 1000;

  let service: UpdateCheckerService;
  let httpMock: HttpTestingController;

  const start = (options?: Partial<Parameters<UpdateCheckerService['startChecking']>[0]>): void => {
    service.startChecking({
      currentVersion: '1.0.0',
      manifestUrl,
      releaseMessageUrl,
      intervalMs,
      ...options
    });
  };

  const expectManifestRequest = () =>
    httpMock.expectOne((req) => req.url.startsWith(manifestUrl));

  const expectReleaseMessageRequest = () =>
    httpMock.expectOne((req) => req.url.startsWith(releaseMessageUrl));

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(UpdateCheckerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopChecking();
    httpMock.verify();
    vi.useRealTimers();
  });

  it('marks patch update as non-blocking', async () => {
    start();

    await vi.advanceTimersByTimeAsync(0);
    expectManifestRequest().flush({ version: '1.0.1', release: 'abc-1' });

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(false);
    expect(service.updateLevel()).toBe('patch');
  });

  it('marks minor update as blocking and reads release message', async () => {
    start();

    await vi.advanceTimersByTimeAsync(0);
    expectManifestRequest().flush({ version: '1.1.0', release: 'abc-2' });
    expectReleaseMessageRequest().flush({
      title: 'Mandatory update',
      message: 'Please refresh now.'
    });

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(true);
    expect(service.updateLevel()).toBe('minor');
    expect(service.releaseMessage()?.title).toBe('Mandatory update');
  });

  it('treats prerelease update as non-blocking patch', async () => {
    start();

    await vi.advanceTimersByTimeAsync(0);
    expectManifestRequest().flush({ version: '1.0.1-rc.0', release: 'abc-3' });

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(false);
    expect(service.updateLevel()).toBe('patch');
  });

  it('does not trigger same-version update on first baseline read', async () => {
    start({ notifyOnDeploymentWithSameVersion: true });

    await vi.advanceTimersByTimeAsync(0);
    expectManifestRequest().flush({ version: '1.0.0', release: 'abc-10' });

    expect(service.updateAvailable()).toBe(false);
    expect(service.updateLevel()).toBe('none');
  });

  it('triggers same-version update when release changes after baseline', async () => {
    start({ notifyOnDeploymentWithSameVersion: true });

    await vi.advanceTimersByTimeAsync(0);
    expectManifestRequest().flush({ version: '1.0.0', release: 'abc-10' });

    await vi.advanceTimersByTimeAsync(intervalMs);
    expectManifestRequest().flush({ version: '1.0.0', release: 'abc-11' });

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(false);
    expect(service.updateLevel()).toBe('patch');
  });

  it('continues polling after manifest request failure', async () => {
    start();

    await vi.advanceTimersByTimeAsync(0);
    expectManifestRequest().flush('server error', {
      status: 500,
      statusText: 'Server Error'
    });

    await vi.advanceTimersByTimeAsync(intervalMs);
    expectManifestRequest().flush({ version: '1.0.1', release: 'abc-12' });

    expect(service.updateAvailable()).toBe(true);
    expect(service.updateLevel()).toBe('patch');
  });
});
