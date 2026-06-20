import { Injectable, signal } from '@angular/core';

export interface UpdateCheckOptions {
  currentVersion: string;
  manifestUrl?: string;
  intervalMs?: number;
}

interface VersionManifest {
  version?: string;
}

type UpdateLevel = 'none' | 'patch' | 'minor' | 'major';

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

@Injectable({ providedIn: 'root' })
export class UpdateCheckerService {
  readonly updateAvailable = signal(false);
  readonly forceUpdateRequired = signal(false);
  readonly updateLevel = signal<UpdateLevel>('none');
  readonly latestVersion = signal('0.0.0');

  private currentVersion = '0.0.0';
  private manifestUrl = './version.json';
  private intervalMs = 60000;
  private checkTimer?: ReturnType<typeof setInterval>;

  startChecking(options: UpdateCheckOptions): void {
    this.currentVersion = options.currentVersion;
    this.manifestUrl = options.manifestUrl ?? './version.json';
    this.intervalMs = options.intervalMs ?? 60000;
    this.updateAvailable.set(false);
    this.forceUpdateRequired.set(false);
    this.updateLevel.set('none');
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
    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set('_cb', Date.now().toString());
    window.location.replace(targetUrl.toString());
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
      const versionComparison = this.compareVersions(remoteVersion, this.currentVersion);
      if (versionComparison <= 0) {
        this.updateAvailable.set(false);
        this.forceUpdateRequired.set(false);
        this.updateLevel.set('none');
        return;
      }

      const level = this.detectUpdateLevel(this.currentVersion, remoteVersion);
      this.updateLevel.set(level);
      this.updateAvailable.set(true);
      this.forceUpdateRequired.set(level === 'minor' || level === 'major');
    } catch {
      this.updateAvailable.set(false);
      this.forceUpdateRequired.set(false);
      this.updateLevel.set('none');
    }
  }

  private detectUpdateLevel(currentVersion: string, remoteVersion: string): UpdateLevel {
    const current = this.parseVersion(currentVersion);
    const remote = this.parseVersion(remoteVersion);

    // Prerelease updates are intentionally treated as patch-level (non-blocking).
    if (
      remote.prerelease.length > 0 ||
      (current.prerelease.length > 0 &&
        current.major === remote.major &&
        current.minor === remote.minor &&
        current.patch === remote.patch)
    ) {
      return 'patch';
    }

    if (remote.major > current.major) {
      return 'major';
    }

    if (remote.major === current.major && remote.minor > current.minor) {
      return 'minor';
    }

    if (
      remote.major === current.major &&
      remote.minor === current.minor &&
      remote.patch > current.patch
    ) {
      return 'patch';
    }

    return 'none';
  }

  private parseVersion(value: string): ParsedVersion {
    const [corePart, prereleasePart] = value.split('-', 2);
    const normalized = corePart
      .split('.')
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isNaN(part) ? 0 : part));

    return {
      major: normalized[0] ?? 0,
      minor: normalized[1] ?? 0,
      patch: normalized[2] ?? 0,
      prerelease: prereleasePart ? prereleasePart.split('.') : []
    };
  }

  private compareVersions(a: string, b: string): number {
    const left = this.parseVersion(a);
    const right = this.parseVersion(b);

    if (left.major !== right.major) {
      return left.major > right.major ? 1 : -1;
    }

    if (left.minor !== right.minor) {
      return left.minor > right.minor ? 1 : -1;
    }

    if (left.patch !== right.patch) {
      return left.patch > right.patch ? 1 : -1;
    }

    if (left.prerelease.length === 0 && right.prerelease.length > 0) {
      return 1;
    }

    if (left.prerelease.length > 0 && right.prerelease.length === 0) {
      return -1;
    }

    return this.comparePrerelease(left.prerelease, right.prerelease);
  }

  private comparePrerelease(left: string[], right: string[]): number {
    const max = Math.max(left.length, right.length);

    for (let index = 0; index < max; index += 1) {
      const leftValue = left[index];
      const rightValue = right[index];

      if (leftValue === undefined) {
        return -1;
      }

      if (rightValue === undefined) {
        return 1;
      }

      const leftNumber = Number.parseInt(leftValue, 10);
      const rightNumber = Number.parseInt(rightValue, 10);
      const leftIsNumeric = !Number.isNaN(leftNumber) && `${leftNumber}` === leftValue;
      const rightIsNumeric = !Number.isNaN(rightNumber) && `${rightNumber}` === rightValue;

      if (leftIsNumeric && rightIsNumeric) {
        if (leftNumber > rightNumber) {
          return 1;
        }
        if (leftNumber < rightNumber) {
          return -1;
        }
        continue;
      }

      if (leftIsNumeric && !rightIsNumeric) {
        return -1;
      }

      if (!leftIsNumeric && rightIsNumeric) {
        return 1;
      }

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
