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
   * Mode sombre temporairement désactivé (à la demande) - no-op tant que ce
   * n'est pas réactivé, quel que soit l'appelant.
   */
  toggle(_dark: boolean): void {
    this._isDark$.next(false);
    this.applyToDOM(false);
    localStorage.removeItem(THEME_KEY);
  }

  private loadFromStorage(): boolean {
    // Mode sombre temporairement désactivé - toujours clair, on ignore une
    // éventuelle préférence déjà stockée dans le navigateur.
    return false;
  }

  private applyToDOM(dark: boolean): void {
    if (dark) {
      document.body.classList.add(DARK_CLASS);
    } else {
      document.body.classList.remove(DARK_CLASS);
    }
  }
}
