import { Injectable, signal } from '@angular/core';

export interface UpdateCheckOptions {
  currentVersion: string;
  manifestUrl?: string;
  intervalMs?: number;
}

interface VersionManifest {
  version?: string;
}

@Injectable({ providedIn: 'root' })
export class UpdateCheckerService {
  readonly updateAvailable = signal(false);
  readonly latestVersion = signal('0.0.0');

  private currentVersion = '0.0.0';
  private manifestUrl = './version.json';
  private intervalMs = 60000;
  private checkTimer?: ReturnType<typeof setInterval>;

  startChecking(options: UpdateCheckOptions): void {
    this.currentVersion = options.currentVersion;
    this.manifestUrl = options.manifestUrl ?? './version.json';
    this.intervalMs = options.intervalMs ?? 60000;
    this.latestVersion.set(this.currentVersion);

    this.stopChecking();
    void this.checkForUpdates();
    this.checkTimer = setInterval(() => {
      void this.checkForUpdates();
    }, this.intervalMs);
  }

  stopChecking(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  reloadForUpdate(): void {
    window.location.reload();
  }

  private async checkForUpdates(): Promise<void> {
    try {
      const response = await fetch(`${this.manifestUrl}?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as VersionManifest;
      const remoteVersion = payload.version;
      if (!remoteVersion) {
        return;
      }

      this.latestVersion.set(remoteVersion);
      this.updateAvailable.set(
        this.compareVersions(remoteVersion, this.currentVersion) > 0
      );
    } catch {
      this.updateAvailable.set(false);
    }
  }

  private compareVersions(a: string, b: string): number {
    const normalize = (value: string): number[] =>
      value
        .split('.')
        .map((part) => Number.parseInt(part, 10))
        .map((part) => (Number.isNaN(part) ? 0 : part));

    const left = normalize(a);
    const right = normalize(b);
    const max = Math.max(left.length, right.length);

    for (let index = 0; index < max; index += 1) {
      const leftValue = left[index] ?? 0;
      const rightValue = right[index] ?? 0;
      if (leftValue > rightValue) {
        return 1;
      }
      if (leftValue < rightValue) {
        return -1;
      }
    }

    return 0;
  }
}
