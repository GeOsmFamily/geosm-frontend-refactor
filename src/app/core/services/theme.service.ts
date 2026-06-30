import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const THEME_KEY = 'geosm_theme';
const DARK_CLASS = 'dark-theme';

/**
 * Service singleton de gestion du thème (clair / sombre).
 * Il centralise la persistance dans localStorage et notifie
 * les abonnés (ex : MapService) lorsque le thème change.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _isDark$ = new BehaviorSubject<boolean>(this.loadFromStorage());

  /** Observable du thème courant (true = sombre) */
  readonly isDark$ = this._isDark$.asObservable();

  /** Valeur synchrone du thème courant */
  get isDark(): boolean {
    return this._isDark$.value;
  }

  constructor() {
    // Appliquer le thème stocké dès l'instanciation du service
    this.applyToDOM(this._isDark$.value);
  }

  /**
   * Bascule le thème et notifie tous les abonnés.
   */
  toggle(dark: boolean): void {
    this._isDark$.next(dark);
    this.applyToDOM(dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }

  private loadFromStorage(): boolean {
    return localStorage.getItem(THEME_KEY) === 'dark';
  }

  private applyToDOM(dark: boolean): void {
    if (dark) {
      document.body.classList.add(DARK_CLASS);
    } else {
      document.body.classList.remove(DARK_CLASS);
    }
  }
}
