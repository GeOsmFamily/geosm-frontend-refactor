import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Coquille partagée par les écrans auth "plein écran deux colonnes" (connexion, création de
 * compte) : panneau de marque à gauche (dégradé + logo + accroche), panneau formulaire à
 * droite. Le contenu du formulaire reste projeté par la page appelante (<ng-content>) ; le
 * contenu de marque additionnel (ex. liste de fonctionnalités sur l'écran de connexion) se
 * projette via le slot [brandExtra].
 */
@Component({
  selector: 'app-auth-split-layout',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './auth-split-layout.component.html',
  styleUrl: './auth-split-layout.component.scss',
})
export class AuthSplitLayoutComponent {
  @Input() brandName = 'GeOSM';
  @Input({ required: true }) tagline = '';
}
