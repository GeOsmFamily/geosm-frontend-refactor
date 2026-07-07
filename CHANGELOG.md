# Changelog

Toutes les modifications notables de ce projet sont documentees dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Unreleased]

### Ajoute

- **Connexion via OpenStreetMap** : bouton de connexion en un clic sur la page de login, panneau Parametres affichant le profil OSM lie (avatar, nom, date de creation du compte, contributions), liaison/deliaison depuis les parametres.
- **CI/CD complet** : ESLint ajoute (aucune configuration n'existait), workflow `ci.yml` (lint, `tsc --noEmit`, tests unitaires avec couverture, build production), `deploy.yml` (build Docker durci + deploiement SSH), suite E2E Playwright committee (`e2e/`) integree en CI.
- **Suite de tests unitaires etendue** : `LayerService`, `SearchService`, `AnalyticsService`, `MapLayerService` desormais couverts.
- **`GlobalErrorHandler`** : les erreurs JS non gerees sont desormais remontees au backend (`POST /logs/frontend-error`) en plus du log console habituel.
- **Bouton "Infos"** dans le header : credits du developpeur, mention open source (lien vers le depot GitHub), telechargement du guide d'utilisation complet au format PDF (fr/en, genere statiquement via un script Puppeteer, voir `npm run generate:guide`), et formulaire de signalement (bug/suggestion/nouvelle fonctionnalite) accessible avec ou sans connexion.
- **Contenu complet du guide PDF bilingue** (`scripts/guide-pdf/content.mjs`) : les 7 sections precedemment livrees avec un contenu provisoire ("a venir") sont desormais entierement redigees en francais et en anglais - 41 fonctionnalites documentees, chacune avec une explication et un exemple de cas d'usage concret (carte et navigation, recherche et decouverte, outils d'analyse et de production, assistant IA, partage, gestion de compte, administration).
- Nettoyage complet des fichiers de traduction (`fr.json`/`en.json`/`es.json`) : suppression des cles mortes heritees d'un fork anterieur, parite complete des cles entre les trois langues verifiee en CI.
- **Plateforme d'administration** (`/admin`, nouveau `roleGuard` reserve SUPER_ADMIN/ADMIN_INSTANCE) : layout dedie (sidebar, KPI d'accueil), gestion des utilisateurs (SUPER_ADMIN uniquement, `/users` reserve cote backend), gestion des instances (CRUD, creation depuis un modele, gestion des utilisateurs par instance) accessible aux deux roles admin.
- **Selecteur de limite administrative** dans le formulaire de creation/edition d'instance : recherche par nom dans une table de limites (avec apercu geometrique OpenLayers avant validation), et import direct d'un shapefile/GeoJSON (mapping du champ nom + niveau administratif) sans quitter le formulaire.

### Corrige

- **Message d'erreur de connexion/inscription** : le composant lisait le mauvais niveau d'imbrication de l'enveloppe d'erreur renvoyee par le backend (`err.error.message` au lieu de `err.error.error.message`), affichant systematiquement un message generique au lieu du vrai message serveur (ex. "Invalid credentials").
- **Bug de compilation JIT sous `ng serve`** : `GeosignetsComponent` importait statiquement son propre parent `MapLayoutComponent` (charge en lazy via le routeur) pour acceder a deux de ses signaux - cet import circulaire enfant/parent cassait la navigation vers `/map` en developpement avec une erreur `needs to be compiled using the JIT compiler`. Corrige via un `@Output() shareRequested` plutot qu'une injection directe du parent. Le build de production (AOT) n'etait pas affecte.
- Deux tests unitaires obsolètes (`tool-panel.component.spec.ts`, `login.component.spec.ts`) desynchronises de l'implementation reelle.

### Securite

- Token Mapillary retire du code source committe (`environment.prod.ts`) au profit d'une injection au build via un secret Docker BuildKit - un ARG classique restait lisible en clair dans l'historique de l'image.
