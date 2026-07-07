import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminDataTableComponent, AdminTableColumn } from '../../../shared/components/admin-data-table/admin-data-table.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DefaultThemeService } from '../../../../../core/services/default-theme.service';
import { DefaultTag, DefaultTheme } from '../../../../../core/models/index';
import { ThemeFormDialogComponent, ThemeFormDialogData } from './theme-form-dialog.component';

@Component({
  selector: 'app-default-themes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
    AdminDataTableComponent,
  ],
  templateUrl: './default-themes.component.html',
  styleUrl: './default-themes.component.scss',
})
export class DefaultThemesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly themeService = inject(DefaultThemeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly seeding = signal(false);
  readonly themes = signal<DefaultTheme[]>([]);

  readonly currentTheme = signal<DefaultTheme | null>(null);
  readonly tags = signal<DefaultTag[]>([]);
  readonly loadingTags = signal(false);

  readonly tagForm = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
  });

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'slug', label: 'Slug' },
    { key: 'order', label: '#' },
  ];

  readonly tagColumns: AdminTableColumn[] = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'slug', label: 'Slug' },
  ];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.themeService.list().subscribe({
      next: (list) => { this.themes.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(theme: DefaultTheme): void {
    this.openForm({ mode: 'edit', theme });
  }

  private openForm(data: ThemeFormDialogData): void {
    const ref = this.dialog.open(ThemeFormDialogComponent, { data, width: '480px', maxWidth: '95vw' });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      const request$ = data.mode === 'edit' && data.theme
        ? this.themeService.update(data.theme.id, result)
        : this.themeService.create(result);
      request$.subscribe({
        next: () => { this.load(); this.notify('admin.catalog.saved'); },
        error: (err) => this.notifyError(err),
      });
    });
  }

  confirmDelete(theme: DefaultTheme): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.catalog.deleteThemeTitle'),
        message: this.translate.instant('admin.catalog.deleteThemeMessage', { name: theme.name }),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.themeService.delete(theme.id).subscribe({
        next: () => { this.load(); this.notify('admin.catalog.deleted'); },
        error: (err) => this.notifyError(err),
      });
    });
  }

  confirmSeed(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.catalog.seedThemesTitle'),
        message: this.translate.instant('admin.catalog.seedThemesMessage'),
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.seeding.set(true);
      this.themeService.seed().subscribe({
        next: () => { this.seeding.set(false); this.load(); this.notify('admin.catalog.seedThemesDone'); },
        error: (err) => { this.seeding.set(false); this.notifyError(err); },
      });
    });
  }

  openTags(theme: DefaultTheme): void {
    this.currentTheme.set(theme);
    this.tagForm.reset();
    this.loadingTags.set(true);
    this.themeService.listTags(theme.id).subscribe({
      next: (tags) => { this.tags.set(tags); this.loadingTags.set(false); },
      error: () => this.loadingTags.set(false),
    });
  }

  backToThemes(): void {
    this.currentTheme.set(null);
    this.tags.set([]);
  }

  addTag(): void {
    const theme = this.currentTheme();
    if (!theme || this.tagForm.invalid) return;
    const value = this.tagForm.getRawValue();
    this.themeService.createTag(theme.id, { name: value.name!, slug: value.slug! }).subscribe({
      next: (tag) => {
        this.tags.set([...this.tags(), tag]);
        this.tagForm.reset();
        this.notify('admin.catalog.saved');
      },
      error: (err) => this.notifyError(err),
    });
  }

  private notify(key: string): void {
    this.snackBar.open(this.translate.instant(key), undefined, { duration: 3000 });
  }

  private notifyError(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.snackBar.open(message ?? this.translate.instant('common.error'), undefined, { duration: 4000 });
  }
}
