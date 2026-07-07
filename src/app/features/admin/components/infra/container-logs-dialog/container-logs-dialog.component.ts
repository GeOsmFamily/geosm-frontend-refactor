import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { AdminDockerService } from '../../../../../core/services/admin-docker.service';

export interface ContainerLogsDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-container-logs-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatProgressSpinnerModule, MatButtonModule, TranslateModule],
  templateUrl: './container-logs-dialog.component.html',
  styleUrl: './container-logs-dialog.component.scss',
})
export class ContainerLogsDialogComponent implements OnInit {
  private readonly dockerService = inject(AdminDockerService);
  readonly data = inject<ContainerLogsDialogData>(MAT_DIALOG_DATA);

  readonly logs = signal('');
  readonly loading = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    this.dockerService.getLogs(this.data.id, 300).subscribe({
      next: (res) => {
        this.logs.set(res.logs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
