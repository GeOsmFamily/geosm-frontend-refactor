import { ErrorHandler, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Remonte les erreurs JS non gérées côté frontend vers le backend (POST /logs/frontend-error),
 * en plus du comportement par défaut (log console) - jusqu'ici une erreur frontend restait
 * invisible en dehors de la console du navigateur du visiteur.
 *
 * Utilise `fetch` direct plutôt que HttpClient/ApiService : ErrorHandler est un singleton
 * racine qui peut être invoqué très tôt (avant que l'injection HttpClient soit pertinente) ou
 * en réaction à une erreur HTTP elle-même - passer par HttpClient ré-exposerait ce nouvel appel
 * aux mêmes intercepteurs (auth/error) qui pourraient re-déclencher une boucle d'erreurs.
 * Best-effort : un échec de remontée ne doit jamais lui-même lever d'erreur.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error('Unhandled error', error);

    // Les erreurs HTTP sont déjà journalisées côté serveur (elles y sont nées) - ne pas les
    // renvoyer créerait un doublon sans valeur ajoutée.
    if (error instanceof HttpErrorResponse) {
      return;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    const body = {
      message: err.message.slice(0, 2000),
      stack: err.stack?.slice(0, 8000),
      url: globalThis.location?.href?.slice(0, 2000),
      userAgent: navigator?.userAgent?.slice(0, 500),
    };

    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${environment.apiUrl}/logs/frontend-error`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      // Best-effort : ne jamais faire planter le handler d'erreurs lui-même.
    });
  }
}
