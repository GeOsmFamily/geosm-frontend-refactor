import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import { IconCatalogService } from '../../../../../core/services/icon-catalog.service';
import { IconCatalogEntry } from '../../../../../core/models/index';

interface IconTile extends IconCatalogEntry {
  svg: SafeHtml;
}

export type IconShape = 'circle' | 'square' | 'triangle' | 'star' | 'pin';

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './icon-picker.component.html',
  styleUrl: './icon-picker.component.scss',
})
export class IconPickerComponent implements OnInit, OnChanges {
  @Input() color = '#00ada7';
  @Input() shape: IconShape = 'circle';
  @Input() selectedKey: string | null = null;
  @Output() readonly selectedKeyChange = new EventEmitter<string>();

  private readonly iconCatalogService = inject(IconCatalogService);
  private readonly sanitizer = inject(DomSanitizer);

  private catalog: IconCatalogEntry[] = [];
  readonly loading = signal(true);
  readonly tiles = signal<IconTile[]>([]);
  readonly categories = signal<string[]>([]);
  readonly activeCategory = signal<string>('all');

  private colorDebounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.iconCatalogService.listCatalog().subscribe({
      next: (catalog) => {
        this.catalog = catalog;
        this.categories.set(['all', ...Array.from(new Set(catalog.map((c) => c.category)))]);
        this.regeneratePreviews();
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnChanges(): void {
    if (this.catalog.length === 0) return;
    clearTimeout(this.colorDebounce);
    this.colorDebounce = setTimeout(() => this.regeneratePreviews(), 200);
  }

  private regeneratePreviews(): void {
    this.loading.set(true);
    const options = this.catalog.map((entry) => ({
      color: this.color,
      shape: this.shape,
      size: 28,
      strokeColor: '#ffffff',
      strokeWidth: 2,
      iconKey: entry.key,
    }));
    this.iconCatalogService.generatePreview(options).subscribe({
      next: (result) => {
        this.tiles.set(
          this.catalog.map((entry, i) => ({
            ...entry,
            svg: this.sanitizer.bypassSecurityTrustHtml(result.svgs[i]),
          })),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  visibleTiles(): IconTile[] {
    const cat = this.activeCategory();
    return cat === 'all' ? this.tiles() : this.tiles().filter((t) => t.category === cat);
  }

  select(key: string): void {
    this.selectedKey = key;
    this.selectedKeyChange.emit(key);
  }
}
