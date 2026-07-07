import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface JobInfo {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface JobQueue {
  name: string;
  counts: Record<string, number>;
  recentJobs: JobInfo[];
}

export interface JobListResult {
  queues: JobQueue[];
}

export interface JobDetails {
  id: string;
  name: string;
  queue: string;
  status: string;
  data: Record<string, unknown>;
  progress: number | object | string | boolean;
  attemptsMade: number;
  failedReason?: string;
  createdAt?: string;
  processedAt?: string;
  finishedAt?: string;
}

export interface RetryJobResult {
  success: boolean;
  message: string;
}

export interface DatabaseBackupResult {
  key: string;
  sizeBytes: number;
  deletedOldBackups: number;
}

export interface ReindexResult {
  instancesProcessed: number;
  layersIndexed: number;
  layersFailed: number;
}

export interface ImportOsmResult {
  success: boolean;
  message: string;
}

/** Lot A6 admin - jobs/files BullMQ + déclenchement manuel des tâches longues. */
@Injectable({ providedIn: 'root' })
export class AdminJobService {
  private readonly api = inject(ApiService);

  list(): Observable<JobListResult> {
    return this.api.get<JobListResult>('/admin/jobs');
  }

  getDetails(jobId: string): Observable<JobDetails> {
    return this.api.get<JobDetails>(`/admin/jobs/${jobId}`);
  }

  retry(jobId: string): Observable<RetryJobResult> {
    return this.api.post<RetryJobResult>(`/admin/jobs/${jobId}/retry`, {});
  }

  triggerBackup(): Observable<DatabaseBackupResult> {
    return this.api.post<DatabaseBackupResult>('/admin/backup', {});
  }

  triggerReindex(): Observable<ReindexResult> {
    return this.api.post<ReindexResult>('/admin/search/reindex-layers', {});
  }

  triggerOsmImport(pbfPath: string): Observable<ImportOsmResult> {
    return this.api.post<ImportOsmResult>('/admin/osm/import', { pbfPath });
  }
}
