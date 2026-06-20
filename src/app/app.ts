import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import packageJson from '../../package.json';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly title = signal('Update Banner');
  protected readonly version = signal(packageJson.version);
  protected readonly chips = [
    'Instant release notes',
    'Clean deployment flow',
    'Banner-ready updates',
    'Angular 21 + signals'
  ];
}
