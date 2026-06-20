import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

interface UpdateRequiredDialogData {
  title: string;
  message: string;
  actionLabel: string;
  onUpdate: () => void;
}

@Component({
  selector: 'app-update-required-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="updateNow()">{{ data.actionLabel }}</button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateRequiredDialogComponent {
  protected readonly data = inject<UpdateRequiredDialogData>(MAT_DIALOG_DATA);

  protected updateNow(): void {
    this.data.onUpdate();
  }
}
