import { Component, Input } from '@angular/core';

/**
 * Coquille partagée par les pages de liste admin de premier niveau (utilisateurs, instances,
 * contenu, signalements) : en-tête titre + actions, barre de filtres, puis le contenu
 * (typiquement <app-admin-data-table>) projeté tel quel. Les pages imbriquées dans un onglet
 * d'instance (base-maps, catalog-tree, default-themes) ont leur propre en-tête fourni par leur
 * parent et n'utilisent pas cette coquille.
 */
@Component({
  selector: 'app-admin-list-page',
  standalone: true,
  templateUrl: './admin-list-page.component.html',
  styleUrl: './admin-list-page.component.scss',
})
export class AdminListPageComponent {
  @Input({ required: true }) title = '';
}
