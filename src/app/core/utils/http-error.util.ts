import { HttpErrorResponse } from '@angular/common/http';

/**
 * Message d'erreur affichable à l'utilisateur à partir d'une réponse HTTP en échec - jusqu'ici
 * chaque appelant (voir statistics-tool.component.ts) affichait un message générique fixe
 * ("Impossible de...") quel que soit le vrai statut, y compris pour un visiteur non authentifié
 * (401) qui n'avait donc aucune indication de la cause réelle. Priorise le cas 401/403 (le plus
 * fréquent pour un géoportail public consultable sans compte), puis le message métier renvoyé
 * par l'API (`{success:false, error:{code, message}}`, voir successResponse/errorResponse côté
 * backend), avant de retomber sur `fallback`.
 */
export function httpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;

  if (error.status === 401) {
    return 'Vous devez être connecté pour utiliser cette fonctionnalité.';
  }
  if (error.status === 403) {
    return "Vous n'avez pas les droits nécessaires pour cette action.";
  }

  const apiMessage = error.error?.error?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim()) {
    return apiMessage;
  }

  if (error.status === 0) {
    return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
  }

  return fallback;
}
