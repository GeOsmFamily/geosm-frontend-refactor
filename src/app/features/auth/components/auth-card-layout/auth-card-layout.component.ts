import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Coquille partagée par les 3 écrans auth "carte centrée" (mot de passe oublié,
 * réinitialisation, vérification d'email) : fond dégradé, carte blanche, icône de marque,
 * titre. Le contenu spécifique à chaque écran (formulaire, états de succès/erreur, lien
 * retour) reste projeté par la page appelante — voir <ng-content>.
 */
@Component({
  selector: 'app-auth-card-layout',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './auth-card-layout.component.html',
  styleUrl: './auth-card-layout.component.scss',
})
export class AuthCardLayoutComponent {
  @Input({ required: true }) title = '';
}
