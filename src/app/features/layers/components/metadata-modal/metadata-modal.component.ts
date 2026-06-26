import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface MetadataModalData {
  layerName: string;
  metadata: Record<string, any>;
}

@Component({
  selector: 'app-metadata-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './metadata-modal.component.html',
  styleUrl: './metadata-modal.component.scss',
})
export class MetadataModalComponent {
  private readonly dialogRef = inject(MatDialogRef<MetadataModalComponent>);
  readonly data: MetadataModalData = inject(MAT_DIALOG_DATA);

  get entries(): { key: string; value: any }[] {
    return Object.entries(this.data.metadata || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([key, value]) => ({ key, value }));
  }

  close(): void {
    this.dialogRef.close();
  }
}
