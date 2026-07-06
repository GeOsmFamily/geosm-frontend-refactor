export const environment = {
  production: true,
  apiUrl: '/api/v1',
  mapDefaults: { center: [11.5, 3.85] as [number, number], zoom: 6 },
  defaultLanguage: 'fr',
  availableLanguages: ['fr', 'en', 'es'],
  primaryColor: '#023f5f',
  accentColor: '#00ada7',
  instanceName: 'GeOSM',
  qgisServerUrl: '/ows',
  // Placeholder injecté au build par le pipeline CI (secret MAPILLARY_TOKEN, voir ci.yml) -
  // ne JAMAIS committer de vrai token ici (l'ancien token en dur committé doit être révoqué
  // sur mapillary.com/dashboard et remplacé par un nouveau, seulement stocké en secret CI).
  mapillaryToken: '__MAPILLARY_TOKEN__',
};
