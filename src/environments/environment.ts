export const environment = {
  production: false,
  apiUrl: 'http://localhost:3005/api/v1',
  mapDefaults: { center: [11.5, 3.85] as [number, number], zoom: 6 },
  defaultLanguage: 'fr',
  availableLanguages: ['fr', 'en', 'es'],
  primaryColor: '#023f5f',
  accentColor: '#00ada7',
  instanceName: 'GeOSM',
  qgisServerUrl: 'http://localhost:8380/ows',
  observabilityLinks: {
    grafana: 'http://localhost:3001',
    prometheus: 'http://localhost:9090',
    jaeger: 'http://localhost:16686',
    graylog: 'http://localhost:9009',
  },
  // Un vrai token a ete committe ici par le passe et doit etre considere compromis (revoque-le
  // sur mapillary.com/dashboard). Pour du dev local, generez votre propre token dev sur
  // https://www.mapillary.com/dashboard/developers et collez-le ici SANS le committer :
  // `git update-index --skip-worktree src/environments/environment.ts` pour eviter qu'un
  // `git add` accidentel ne le recapture.
  mapillaryToken: '',
};
