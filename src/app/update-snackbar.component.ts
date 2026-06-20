import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';

interface UpdateSnackbarData {
  text: string;
  onRefresh: () => void;
}

@Component({
  selector: 'app-update-snackbar',
  standalone: true,
  imports: [MatButtonModule],
  template: `
    <div class="snack-content">
      <span>{{ data.text }}</span>
      <div class="snack-actions">
        <button mat-button (click)="refresh()">Refresh</button>
        <button mat-button (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [
    `
      .snack-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .snack-actions {
        display: inline-flex;
        gap: 6px;
      }

      .snack-actions button {
        min-width: 0;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateSnackbarComponent {
  protected readonly data = inject<UpdateSnackbarData>(MAT_SNACK_BAR_DATA);
  private readonly snackBarRef = inject(MatSnackBarRef<UpdateSnackbarComponent>);

  protected refresh(): void {
    this.data.onRefresh();
    this.snackBarRef.dismiss();
  }

  protected close(): void {
    this.snackBarRef.dismiss();
  }
}
