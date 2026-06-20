import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';
import packageJson from '../../package.json';
import { UpdateCheckerService } from './update-checker.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  private readonly updateChecker = inject(UpdateCheckerService);

  protected readonly title = signal('Update Banner');
  protected readonly version = signal(packageJson.version);
  protected readonly currentYear = signal(new Date().getFullYear());
  protected readonly updateAvailable = this.updateChecker.updateAvailable;
  protected readonly latestVersion = this.updateChecker.latestVersion;
  protected readonly chips = [
    'Instant release notes',
    'Clean deployment flow',
    'Banner-ready updates',
    'Angular 21 + signals',
    'Live update pulse enabled'
  ];

  ngOnInit(): void {
    this.updateChecker.startChecking({
      currentVersion: this.version(),
      manifestUrl: './version.json',
      intervalMs: 60000
    });
  }

  ngOnDestroy(): void {
    this.updateChecker.stopChecking();
  }

  protected reloadForUpdate(): void {
    this.updateChecker.reloadForUpdate();
  }
}
