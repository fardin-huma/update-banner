import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { catchError, filter, map, Observable, of, Subscription, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface UpdateCheckOptions {
  currentVersion: string;
  manifestUrl: string;
  releaseMessageUrl: string;
  notifyOnDeploymentWithSameVersion?: boolean;
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

type UpdateLevel = 'none' | 'patch' | 'prerelease' | 'minor' | 'major';

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string|null;
}

@Injectable({ providedIn: 'root' })
export class UpdateCheckerService {
  private readonly _http = inject(HttpClient);
  private readonly _destroyRef = inject(DestroyRef);

  // Public reactive state consumed by UI components.
  readonly updateAvailable = signal(false);
  readonly forceUpdateRequired = signal(false);
  readonly updateLevel = signal<UpdateLevel>('none');
  readonly latestVersion = signal('0.0.0');
  readonly latestReleaseInfo = signal<string | null>(null);

  // Fetched from public/release-message/general.json and consumed by the blocking
  // update dialog (minor/major). Soft updates intentionally ignore this message.
  private readonly mutableReleaseMessage = signal<ReleaseMessage | null>(null);
  readonly releaseMessage = this.mutableReleaseMessage.asReadonly();

  // Runtime configuration and internal polling state.
  private currentVersion = '0.0.0';
  private currentReleaseInfo: string | null = null;
  
  private _manifestUrl = '';
  private _releaseMessageUrl = '';
  private _notifyOnDeploymentWithSameVersion = false;
  private _pollSubscription?: Subscription;


  /**
   * Starts periodic update checks.
   *
   * Required URLs are provided by the app environment so the service stays
   * deployment-agnostic and does not rely on hardcoded endpoints.
   */
  startChecking(options: UpdateCheckOptions): void {
    this.currentVersion = options.currentVersion;
      this.updateAvailable.set(false);
      this.forceUpdateRequired.set(false);
      this.updateLevel.set('none');
      this.latestVersion.set(this.currentVersion);
      this.latestReleaseInfo.set(null);
      this.mutableReleaseMessage.set(null);
      this.currentReleaseInfo = null;
      
      const intervalMs = options.intervalMs ?? 60000;
      this._manifestUrl = options.manifestUrl;
      this._releaseMessageUrl = options.releaseMessageUrl;
      this._notifyOnDeploymentWithSameVersion = options.notifyOnDeploymentWithSameVersion ?? false;

    // Immediately check for updates and then start polling.
    this._pollSubscription = timer(0, intervalMs)
      .pipe(
        switchMap(() => this._checkForUpdates()),
        filter((manifest): manifest is VersionManifest => manifest !== null),
        map((manifest) => ({
          level: this._detectUpdateLevel(manifest.version ?? '', this.currentVersion),
          manifest
        })),
        switchMap(({ level, manifest }) => {
          if (level === 'minor' || level === 'major') {
            return this._getReleaseMessage().pipe(
              map((releaseMessage) => ({ level, manifest, releaseMessage }))
            );
          }
          return of({ level, manifest, releaseMessage: null });
        }),
        takeUntilDestroyed(this._destroyRef))
      .subscribe((data) => {
        const { level, manifest, releaseMessage } = data;
        const latestVersion = manifest.version?.trim() ?? 'unknown';
        const releaseInfo = manifest.release?.trim() ?? null;

        this.latestVersion.set(latestVersion);
        this.latestReleaseInfo.set(releaseInfo);
        this.mutableReleaseMessage.set(releaseMessage);
        

        if (level === 'none') {
          if (this._notifyOnDeploymentWithSameVersion && releaseInfo) {
            if (this.currentReleaseInfo === null) {
              this.updateAvailable.set(false);
              this.forceUpdateRequired.set(false);
              this.updateLevel.set('none');
            } else if (releaseInfo !== this.currentReleaseInfo) {
              this.updateAvailable.set(true);
              this.forceUpdateRequired.set(false);
              this.updateLevel.set('patch');
            } else {
              this.updateAvailable.set(false);
              this.forceUpdateRequired.set(false);
              this.updateLevel.set('none');
            }
          } else {
            this.updateAvailable.set(false);
            this.forceUpdateRequired.set(false);
            this.updateLevel.set('none');
          }
        } else {
          this.updateAvailable.set(true);
          this.forceUpdateRequired.set(level === 'minor' || level === 'major');
          this.updateLevel.set(level);
        }

        this.currentReleaseInfo = releaseInfo;
        
      });
  }

  /** Stops polling and invalidates in-flight async completion writes. */
  stopChecking(): void {
    this._pollSubscription?.unsubscribe();
    this._pollSubscription = undefined;
  }



  reloadForUpdate(): void {
    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set('_cb', Date.now().toString());
    window.location.replace(targetUrl.toString());
  }


  private _checkForUpdates() : Observable<VersionManifest | null> {    
    return this._http.get<VersionManifest>(this._manifestUrl, { headers: { 'Cache-Control': 'no-store' } }).pipe(
        map((manifest) => {
            return {
        version: typeof manifest.version === 'string' ? manifest.version.trim() : undefined,
        release: typeof manifest.release === 'string' ? manifest.release.trim() : undefined,
      };
        }),
        catchError(() => of(null))
    );
  }

  private _getReleaseMessage(): Observable<ReleaseMessage | null> {
    return this._http.get(this._releaseMessageUrl, { headers: { 'Cache-Control': 'no-store' } }).pipe(
      map((response) => {
        if (typeof response !== 'object' || response === null) return null;
        return this._sanitizeReleaseMessage(response);
      }),
      catchError(() => of(null))
    );
  }

  private _sanitizeReleaseMessage(value?: ReleaseMessage ): ReleaseMessage | null {
    if (!value) return null;

    const safeTitle =
      typeof value.title === 'string' ? value.title.trim().slice(0, 500) : '';
    const safeMessage =
      typeof value.message === 'string' ? value.message.trim().slice(0, 1000) : '';

    if (!safeTitle && !safeMessage) return null;

    return {
      ...(safeTitle ? { title: safeTitle } : {}),
      ...(safeMessage ? { message: safeMessage } : {})
    };
  }

  private _detectUpdateLevel(currentVersion: string, remoteVersion: string): UpdateLevel {
    const current = this._parseVersion(currentVersion);
    const remote = this._parseVersion(remoteVersion);


    if (remote.major !== current.major) return 'major';
    if (remote.minor !== current.minor) return 'minor';
    if (remote.patch !== current.patch) return 'patch';
    if (remote.prerelease !== current.prerelease) return 'prerelease';
    
    return 'none';
  }

  private _parseVersion(value: string): ParsedVersion {
    const [corePart, prereleasePart] = value.split('-', 2);
    const normalized = corePart
      .split('.', 3)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isNaN(part) ? 0 : part));

    const prerelease = prereleasePart ? String(prereleasePart.split('.').slice(1)) : null;

    return {
      major: normalized[0],
      minor: normalized[1],
      patch: normalized[2],
      prerelease,
    };
  }

}
