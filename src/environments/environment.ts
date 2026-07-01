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
  mapillaryToken: 'MLY|27232696753044973|162c805ddb2365b4a8765bb2cb346f2b',
};
