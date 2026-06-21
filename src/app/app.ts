import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';
import packageJson from '../../package.json';
import { environment } from '../environments/environment';
import { UpdateBannerComponent } from './update-banner.component';
import { UpdateCheckerService } from './update-checker.service';

@Component({
  selector: 'app-root',
  imports: [UpdateBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  private readonly updateChecker = inject(UpdateCheckerService);

  protected readonly title = signal(environment.name);
  protected readonly version = signal(packageJson.version);
  protected readonly currentYear = signal(new Date().getFullYear());

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
      manifestUrl: environment.manifestUrl,
      releaseMessageUrl: environment.releaseMessageUrl,
      notifyOnDeploymentWithSameVersion:
        environment.notifyOnDeploymentWithSameVersion,
      intervalMs: environment.intervalMs
    });
  }

  ngOnDestroy(): void {
    this.updateChecker.stopChecking();
  }
}
