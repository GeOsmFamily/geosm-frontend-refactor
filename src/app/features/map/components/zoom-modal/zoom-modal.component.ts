import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-zoom-modal',
  standalone: true,
  imports: [TranslateModule, CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './zoom-modal.component.html',
  styleUrl: './zoom-modal.component.scss',
})
export class ZoomModalComponent {
  longitude: number | null = null;
  latitude: number | null = null;

  constructor(private dialogRef: MatDialogRef<ZoomModalComponent>) {}

  isValid(): boolean {
    return this.longitude !== null && this.latitude !== null &&
      this.longitude >= -180 && this.longitude <= 180 &&
      this.latitude >= -90 && this.latitude <= 90;
  }

  submit(): void {
    if (this.isValid()) {
      this.dialogRef.close({ longitude: this.longitude, latitude: this.latitude });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
