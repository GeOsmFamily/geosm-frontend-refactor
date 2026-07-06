import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number | null = null;
  @Input() icon = 'bar_chart';
  @Input() loading = false;
  /** Nom de variable CSS (ex. '--accent') utilisé pour teinter l'icône, cohérent avec les autres panneaux. */
  @Input() accentVar = '--accent';
}
