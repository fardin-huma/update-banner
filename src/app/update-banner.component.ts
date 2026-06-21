import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  untracked
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { UpdateCheckerService } from './update-checker.service';
import { UpdateRequiredDialogComponent } from './update-required-dialog.component';
import { UpdateSnackbarComponent } from './update-snackbar.component';

@Component({
  selector: 'app-update-banner',
  imports: [],
  templateUrl: './update-banner.component.html',
  styleUrl: './update-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateBannerComponent {
  private readonly updateChecker = inject(UpdateCheckerService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  private softShownForKey: string | null = null;
  private forceShownForVersion: string | null = null;

  readonly currentVersion = input.required<string>();
  readonly refreshClicked = output<void>();

  protected readonly updateAvailable = this.updateChecker.updateAvailable;
  protected readonly forceUpdateRequired = this.updateChecker.forceUpdateRequired;
  protected readonly latestVersion = this.updateChecker.latestVersion;
  protected readonly latestReleaseTag = this.updateChecker.latestReleaseTag;
  protected readonly releaseMessage = this.updateChecker.releaseMessage;

  constructor() {
    effect(() => {
      const updateAvailable = this.updateAvailable();
      const forceUpdate = this.forceUpdateRequired();
      const latest = this.latestVersion();
      const latestReleaseTag = this.latestReleaseTag();
      const message = this.releaseMessage();

      if (!updateAvailable) {
        this.softShownForKey = null;
        this.forceShownForVersion = null;
        this.snackBar.dismiss();
        this.dialog.closeAll();
        return;
      }

      if (forceUpdate) {
        this.showForceDialog(latest, message);
      } else {
        this.showSoftToast(latest, latestReleaseTag);
      }
    });
  }

  protected onRefresh(): void {
    this.refreshClicked.emit();
    this.updateChecker.reloadForUpdate();
  }

  private showSoftToast(latestVersion: string, latestReleaseTag: string | null): void {
    const softKey = `${latestVersion}|${latestReleaseTag ?? 'none'}`;
    if (this.softShownForKey === softKey) {
      return;
    }

    this.softShownForKey = softKey;
    const text = `A new version (${latestVersion}) is available. Refresh to update.`;
    this.snackBar.openFromComponent(UpdateSnackbarComponent, {
      horizontalPosition: 'right',
      verticalPosition: 'top',
      data: {
        text,
        onRefresh: () => {
          untracked(() => this.onRefresh());
        }
      }
    });
  }

  private showForceDialog(
    latestVersion: string,
    message: { title?: string; message?: string } | null
  ): void {
    if (this.forceShownForVersion === latestVersion) {
      return;
    }

    this.forceShownForVersion = latestVersion;
    this.snackBar.dismiss();
    this.dialog.closeAll();

    this.dialog.open(UpdateRequiredDialogComponent, {
      disableClose: true,
      closeOnNavigation: false,
      hasBackdrop: true,
      data: {
        title: message?.title || 'Update required',
        message:
          message?.message ||
          `A new version (${latestVersion}) requires a mandatory refresh before you can continue.`,
        actionLabel: 'Update now',
        onUpdate: () => {
          untracked(() => this.onRefresh());
        }
      }
    });
  }
}
