import { Injectable, signal } from '@angular/core';

export interface UpdateCheckOptions {
  currentVersion: string;
  manifestUrl?: string;
  releaseMessageUrl?: string;
  notifyOnReleaseChangeWithSameVersion?: boolean;
  intervalMs?: number;
}

interface ReleaseMessage {
  title?: string;
  message?: string;
}

interface VersionManifest {
  version?: string;
  release?: string;
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
  readonly latestReleaseTag = signal<string | null>(null);
  // Fetched from public/release-message/general.json and consumed by the blocking
  // update dialog (minor/major). Soft updates intentionally ignore this message.
  private readonly mutableReleaseMessage = signal<ReleaseMessage | null>(null);
  readonly releaseMessage = this.mutableReleaseMessage.asReadonly();

  private currentVersion = '0.0.0';
  private manifestUrl = './version.json';
  private releaseMessageUrl = './release-message/general.json';
  private notifyOnReleaseChangeWithSameVersion = false;
  private lastSeenReleaseTag: string | null = null;
  private activeSameVersionReleaseTag: string | null = null;
  private intervalMs = 60000;
  private checkTimer?: ReturnType<typeof setInterval>;

  startChecking(options: UpdateCheckOptions): void {
    this.currentVersion = options.currentVersion;
    this.manifestUrl = options.manifestUrl ?? './version.json';
    this.releaseMessageUrl = options.releaseMessageUrl ?? './release-message/general.json';
    this.notifyOnReleaseChangeWithSameVersion =
      options.notifyOnReleaseChangeWithSameVersion ?? false;
    this.intervalMs = options.intervalMs ?? 60000;
    this.updateAvailable.set(false);
    this.forceUpdateRequired.set(false);
    this.updateLevel.set('none');
    this.latestVersion.set(this.currentVersion);
    this.latestReleaseTag.set(null);
    this.mutableReleaseMessage.set(null);
    this.lastSeenReleaseTag = null;
    this.activeSameVersionReleaseTag = null;

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

      const remoteReleaseTag = this.normalizeReleaseTag(payload.release);

      this.latestVersion.set(remoteVersion);
      this.latestReleaseTag.set(remoteReleaseTag);
      const versionComparison = this.compareVersions(remoteVersion, this.currentVersion);

      const sameVersionReleaseChanged =
        this.notifyOnReleaseChangeWithSameVersion &&
        versionComparison === 0 &&
        this.lastSeenReleaseTag !== remoteReleaseTag;

      if (versionComparison <= 0 && !sameVersionReleaseChanged) {
        const keepSameVersionSoftUpdate =
          this.notifyOnReleaseChangeWithSameVersion &&
          versionComparison === 0 &&
          this.activeSameVersionReleaseTag !== null &&
          remoteReleaseTag === this.activeSameVersionReleaseTag;

        if (keepSameVersionSoftUpdate) {
          this.updateAvailable.set(true);
          this.forceUpdateRequired.set(false);
          this.updateLevel.set('patch');
          this.mutableReleaseMessage.set(null);
          this.lastSeenReleaseTag = remoteReleaseTag;
          return;
        }

        this.activeSameVersionReleaseTag = null;
        this.updateAvailable.set(false);
        this.forceUpdateRequired.set(false);
        this.updateLevel.set('none');
        this.mutableReleaseMessage.set(null);
        this.lastSeenReleaseTag = remoteReleaseTag;
        return;
      }

      const level =
        versionComparison > 0
          ? this.detectUpdateLevel(this.currentVersion, remoteVersion)
          : 'patch';

      this.activeSameVersionReleaseTag =
        versionComparison === 0 && this.notifyOnReleaseChangeWithSameVersion
          ? remoteReleaseTag
          : null;

      this.updateLevel.set(level);
      this.updateAvailable.set(true);
      this.forceUpdateRequired.set(level === 'minor' || level === 'major');
      this.mutableReleaseMessage.set(
        level === 'minor' || level === 'major' ? await this.fetchReleaseMessage() : null
      );
      this.lastSeenReleaseTag = remoteReleaseTag;
    } catch {
      this.activeSameVersionReleaseTag = null;
      this.updateAvailable.set(false);
      this.forceUpdateRequired.set(false);
      this.updateLevel.set('none');
      this.latestReleaseTag.set(null);
      this.mutableReleaseMessage.set(null);
    }
  }

  private async fetchReleaseMessage(): Promise<ReleaseMessage | null> {
    try {
      const response = await fetch(`${this.releaseMessageUrl}?t=${Date.now()}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as ReleaseMessage;
      return this.sanitizeReleaseMessage(payload);
    } catch {
      return null;
    }
  }

  private sanitizeReleaseMessage(value: ReleaseMessage | undefined): ReleaseMessage | null {
    if (!value) {
      return null;
    }

    const safeTitle =
      typeof value.title === 'string' ? value.title.trim().slice(0, 140) : '';
    const safeMessage =
      typeof value.message === 'string' ? value.message.trim().slice(0, 500) : '';

    if (!safeTitle && !safeMessage) {
      return null;
    }

    return {
      ...(safeTitle ? { title: safeTitle } : {}),
      ...(safeMessage ? { message: safeMessage } : {})
    };
  }

  private normalizeReleaseTag(value: string | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.slice(0, 100);
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
