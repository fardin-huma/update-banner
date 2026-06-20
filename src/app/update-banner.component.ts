import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { UpdateCheckerService } from './update-checker.service';

@Component({
  selector: 'app-update-banner',
  imports: [],
  templateUrl: './update-banner.component.html',
  styleUrl: './update-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateBannerComponent {
  private readonly updateChecker = inject(UpdateCheckerService);

  readonly currentVersion = input.required<string>();
  readonly refreshClicked = output<void>();

  protected readonly updateAvailable = this.updateChecker.updateAvailable;
  protected readonly forceUpdateRequired = this.updateChecker.forceUpdateRequired;
  protected readonly latestVersion = this.updateChecker.latestVersion;
  protected readonly releaseMessage = this.updateChecker.releaseMessage;

  protected onRefresh(): void {
    this.refreshClicked.emit();
    this.updateChecker.reloadForUpdate();
  }
}
