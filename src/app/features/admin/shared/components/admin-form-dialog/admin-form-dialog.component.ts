import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Coquille partagée par les dialogs de formulaire admin basés sur un FormGroup réactif
 * (base-map, thème, groupe/sous-groupe, instance, utilisateur, template d'instance) : titre,
 * mat-dialog-content, boutons annuler/enregistrer avec [disabled]="form.invalid". Les champs
 * du formulaire restent projetés par chaque dialog appelant (<ng-content>).
 *
 * Ce composant NE porte PAS lui-même le <form [formGroup]>. La directive formControlName
 * résout son ControlContainer via @Host() borné à la vue du composant qui la déclare : un
 * <form> déclaré ici (dans la vue de AdminFormDialogComponent) ne serait pas visible par les
 * formControlName déclarés dans la vue du dialog appelant, même une fois leur contenu projeté
 * ici (erreur NG01050, vérifié en pratique). Chaque dialog appelant garde donc son propre
 * <form [formGroup]="form" (ngSubmit)="onSubmit()"> enveloppant <app-admin-form-dialog> - le
 * bouton type="submit" rendu ici déclenche cet ancêtre via la bulle native de l'événement
 * submit du DOM, qui elle ignore les frontières de vue Angular.
 *
 * boundary-picker-dialog n'utilise pas cette coquille : il n'est pas basé sur un FormGroup
 * réactif (ngModel direct) et sa condition d'activation du bouton de confirmation diffère
 * (sélection d'une limite administrative, pas validité de formulaire).
 */
@Component({
  selector: 'app-admin-form-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TranslateModule],
  templateUrl: './admin-form-dialog.component.html',
  styleUrl: './admin-form-dialog.component.scss',
})
export class AdminFormDialogComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) form!: FormGroup;
  @Input() minWidth = 360;

  @Output() readonly cancel = new EventEmitter<void>();
}
