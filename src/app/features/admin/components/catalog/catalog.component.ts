import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

import { InstanceService } from '../../../../core/services/instance.service';
import { Instance } from '../../../../core/models/index';
import { CatalogTreeComponent } from './catalog-tree/catalog-tree.component';
import { BaseMapsComponent } from './base-maps/base-maps.component';
import { DefaultThemesComponent } from './default-themes/default-themes.component';
import { CatalogToolsComponent } from './catalog-tools/catalog-tools.component';

/**
 * Point d'entrée du catalogue cartographique admin. Les groupes/couches/fonds de carte sont
 * scopés par instance (contrairement aux thèmes par défaut, globaux) - un sélecteur d'instance
 * conditionne donc les onglets qui en dépendent.
 */
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    TranslateModule,
    CatalogTreeComponent,
    BaseMapsComponent,
    DefaultThemesComponent,
    CatalogToolsComponent,
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent implements OnInit {
  private readonly instanceService = inject(InstanceService);

  readonly instances = signal<Instance[]>([]);
  readonly selectedInstanceId = signal<string | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.instanceService.list({ limit: 100 }).subscribe({
      next: (res) => {
        this.instances.set(res.data);
        if (res.data.length > 0) this.selectedInstanceId.set(res.data[0].id);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onInstanceChange(id: string): void {
    this.selectedInstanceId.set(id);
  }
}
