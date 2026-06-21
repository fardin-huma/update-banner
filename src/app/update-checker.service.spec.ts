import { TestBed } from '@angular/core/testing';
import { UpdateCheckerService } from './update-checker.service';

describe('UpdateCheckerService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  const runCheck = async (service: UpdateCheckerService): Promise<void> => {
    await (service as unknown as { checkForUpdates: () => Promise<void> }).checkForUpdates();
  };

  it('marks patch update as non-blocking', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ version: '1.0.1', release: 'abc-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const service = TestBed.inject(UpdateCheckerService);
    service.startChecking({
      currentVersion: '1.0.0',
      intervalMs: 60000
    });

    await runCheck(service);

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(false);
    expect(service.updateLevel()).toBe('patch');

    service.stopChecking();
  });

  it('marks minor update as blocking and reads release message', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();
      if (url.includes('release-message')) {
        return new Response(
          JSON.stringify({
            title: 'Mandatory update',
            message: 'Please refresh now.'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(JSON.stringify({ version: '1.1.0', release: 'abc-2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const service = TestBed.inject(UpdateCheckerService);
    service.startChecking({
      currentVersion: '1.0.0',
      intervalMs: 60000
    });

    await runCheck(service);

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(true);
    expect(service.updateLevel()).toBe('minor');
    expect(service.releaseMessage()?.title).toBe('Mandatory update');

    service.stopChecking();
  });

  it('treats prerelease update as non-blocking patch', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ version: '1.0.1-rc.0', release: 'abc-3' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const service = TestBed.inject(UpdateCheckerService);
    service.startChecking({
      currentVersion: '1.0.0',
      intervalMs: 60000
    });

    await runCheck(service);

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(false);
    expect(service.updateLevel()).toBe('patch');

    service.stopChecking();
  });

  it('does not trigger same-version update on first baseline read', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '1.0.0', release: 'abc-10' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const service = TestBed.inject(UpdateCheckerService);
    service.startChecking({
      currentVersion: '1.0.0',
      notifyOnReleaseChangeWithSameVersion: true,
      intervalMs: 60000
    });

    await flush();

    expect(service.updateAvailable()).toBe(false);
    expect(service.updateLevel()).toBe('none');

    service.stopChecking();
  });

  it('triggers same-version update when release tag changes after baseline', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '1.0.0', release: 'abc-10' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '1.0.0', release: 'abc-11' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const service = TestBed.inject(UpdateCheckerService);
    service.startChecking({
      currentVersion: '1.0.0',
      notifyOnReleaseChangeWithSameVersion: true,
      intervalMs: 60000
    });

    await flush();

    // invoke private method for deterministic second poll assertion
    await (service as unknown as { checkForUpdates: () => Promise<void> }).checkForUpdates();

    expect(service.updateAvailable()).toBe(true);
    expect(service.forceUpdateRequired()).toBe(false);
    expect(service.updateLevel()).toBe('patch');

    service.stopChecking();
  });

  it('triggers same-version update when release string changes', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '1.0.0', release: 'abc1234-42' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '1.0.0', release: 'abc1234-43' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const service = TestBed.inject(UpdateCheckerService);
    service.startChecking({
      currentVersion: '1.0.0',
      notifyOnReleaseChangeWithSameVersion: true,
      intervalMs: 60000
    });

    await flush();
    await (service as unknown as { checkForUpdates: () => Promise<void> }).checkForUpdates();

    expect(service.updateAvailable()).toBe(true);
    expect(service.updateLevel()).toBe('patch');

    service.stopChecking();
  });
});
