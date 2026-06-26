# GeOSM Frontend v3.0 -- Client web du geoportail open-source base sur OpenStreetMap

![CI](https://github.com/GeOsmFamily/geosm-frontend-refactor/actions/workflows/ci.yml/badge.svg)
![Securite](https://github.com/GeOsmFamily/geosm-frontend-refactor/actions/workflows/security.yml/badge.svg)
![Qualite](https://github.com/GeOsmFamily/geosm-frontend-refactor/actions/workflows/code-quality.yml/badge.svg)
![Licence](https://img.shields.io/badge/licence-MIT-blue)
![Angular](https://img.shields.io/badge/Angular-18-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)

---

## Description

**GeOSM** (Geographic OpenStreetMap) est un geoportail open-source qui permet de **visualiser, gerer et diffuser des donnees geographiques**, principalement issues d'**OpenStreetMap**. Concu pour l'Afrique, il offre une infrastructure SIG complete permettant aux organisations de creer des portails cartographiques multi-instances.

Ce depot contient le **client web frontend** construit avec Angular 18. Il fournit une interface cartographique interactive basee sur OpenLayers, un catalogue hierarchique de couches, des outils de dessin/mesure/impression, et se connecte a l'[API backend GeOSM](https://github.com/GeOsmFamily/geosm-api-refactor) pour toutes les operations de donnees.

---

## Stack technique

| Categorie | Technologie |
|---|---|
| Framework | Angular 18 |
| Langage | TypeScript 5.4 (mode strict) |
| UI | Angular Material 18 |
| Carte | OpenLayers 10 |
| Gestion d'etat | RxJS BehaviorSubjects + Angular Signals |
| Internationalisation | @ngx-translate/core v16 (fr, en, es) |
| Impression | jsPDF + dom-to-image-more |
| Polices | Avenir Next Rounded Pro (custom) |
| Theme | #023f5f (primaire), #00ada7 (accent) |
| Tests | Karma + Jasmine |
| CI/CD | GitHub Actions |
| Conteneurisation | Docker (nginx) |

---

## Demarrage rapide

### Prerequis

- **Node.js** 20+
- **npm** 10+
- **Angular CLI** 18

### Installation

```bash
# 1. Cloner le depot
git clone https://github.com/GeOsmFamily/geosm-frontend-refactor.git
cd geosm-frontend-refactor

# 2. Installer les dependances
npm install

# 3. Demarrer le serveur de developpement
ng serve
```

L'application est accessible sur `http://localhost:4200`. Elle se connecte a l'API backend sur `http://localhost:3005/api/v1`.

### Avec Docker

```bash
# Construire l'image
docker build -t geosm-frontend .

# Demarrer le conteneur
docker run -p 80:80 geosm-frontend
```

L'application est accessible sur `http://localhost`.

---

## Configuration d'environnement

Le fichier de configuration se trouve dans `src/environments/environment.ts` :

| Propriete | Description | Valeur par defaut |
|---|---|---|
| `apiUrl` | URL de l'API backend | `http://localhost:3005/api/v1` |
| `mapDefaults.center` | Centre de la carte par defaut [lng, lat] | `[11.5, 3.85]` |
| `mapDefaults.zoom` | Niveau de zoom par defaut | `6` |
| `defaultLanguage` | Langue par defaut | `fr` |
| `availableLanguages` | Langues disponibles | `['fr', 'en', 'es']` |
| `primaryColor` | Couleur primaire du theme | `#023f5f` |
| `accentColor` | Couleur d'accent du theme | `#00ada7` |

---

## Architecture

```
src/app/
├── core/               # Services, modeles, intercepteurs, guards
│   ├── models/          # 28 interfaces TypeScript
│   ├── services/        # 15 services (API, auth, layers, routing...)
│   ├── interceptors/    # Auth + Error interceptors
│   └── guards/          # Auth guard
├── features/           # Modules fonctionnels
│   ├── map/            # Carte OL, layout, toolbar, popups, geosignets
│   ├── layers/         # Catalogue, couches actives, fonds de carte, legende
│   ├── tools/          # Dessin, mesure, itineraire, export, impression, commentaire, altimetrie
│   ├── search/         # Barre de recherche avec geocodage
│   ├── auth/           # Login, inscription
│   └── sharing/        # Partage social, carte partagee
└── shared/             # Composants reutilisables
```

---

## Fonctionnalites

L'application comprend **27 composants** organises en modules fonctionnels :

### Carte interactive
- Carte OpenLayers avec controles de navigation
- Barre d'outils carte avec historique de navigation
- Menu contextuel (clic droit)
- Zoom aux coordonnees GPS
- Geosignets (bookmarks localStorage)

### Catalogue et couches
- Catalogue hierarchique (Groupes > Sous-groupes > Couches)
- Couches actives avec drag-drop, opacite, visibilite
- Fonds de carte (OSM, satellite, etc.)
- Legende WMS GetLegendGraphic
- Fiche descriptive avec liens Wikipedia/Wikidata/OSM

### Outils
- Dessin (points, lignes, polygones)
- Mesure (distance, surface)
- Itineraire
- Export de donnees
- Impression PDF (jsPDF + dom-to-image-more)
- Commentaires
- Altimetrie

### Recherche et geocodage
- Barre de recherche avec geocodage Nominatim

### Partage
- Partage social (Facebook, Twitter, WhatsApp, LinkedIn)
- Carte partagee en lecture seule

### Authentification
- Authentification JWT avec refresh token automatique
- Login et inscription

### Internationalisation
- 3 langues supportees (francais, anglais, espagnol)
- 304 cles de traduction
- Fichiers dans `src/assets/i18n/`

---

## Integration API

L'application integre **15 services** qui communiquent avec l'API backend :

| Service | Endpoints backend |
|---|---|
| AuthService | `/auth/login`, `/auth/register`, `/auth/refresh-token`, `/auth/logout` |
| InstanceService | `/instances`, `/instances/:id` |
| GroupService | `/instances/:id/groups` |
| SubGroupService | `/groups/:id/sub-groups` |
| LayerService | `/instances/:id/layers`, `/layers/:id` |
| BaseMapService | `/instances/:id/base-maps` |
| FeatureService | `/layers/:id/features` |
| GeocodeService | `/geocode/search`, `/geocode/reverse` |
| RoutingService | `/routing/route` |
| ExportService | `/exports` |
| DrawingService | `/drawings` |
| ShareService | `/share` |
| CatalogService | `/catalog/:instanceSlug` |
| GeoportailService | `/geoportail/altitude`, `/geoportail/profile` |
| SearchService | `/search` |

---

## Routes

| Route | Description |
|---|---|
| `/` | Redirection vers `/map` |
| `/login` | Page de connexion |
| `/register` | Page d'inscription |
| `/map` | Carte principale |
| `/map/:instanceSlug` | Carte d'une instance specifique |
| `/share/:code` | Carte partagee en lecture seule |

---

## Internationalisation

L'application supporte 3 langues avec **304 cles de traduction** :

| Langue | Code | Fichier |
|---|---|---|
| Francais | `fr` | `src/assets/i18n/fr.json` |
| Anglais | `en` | `src/assets/i18n/en.json` |
| Espagnol | `es` | `src/assets/i18n/es.json` |

La langue par defaut est le francais. L'utilisateur peut changer de langue via le selecteur dans l'interface.

---

## Tests

```bash
# Lancer les tests unitaires
ng test

# Lancer les tests avec couverture de code
ng test --code-coverage
```

---

## Docker

L'image Docker utilise un build multi-stage :

1. **Stage build** : Node.js 20 Alpine compile l'application Angular en mode production
2. **Stage production** : nginx 1.27 Alpine sert les fichiers statiques avec :
   - Routage SPA (fallback vers `index.html`)
   - Proxy inverse vers l'API backend (`/api/`)
   - Cache statique (1 an pour JS, CSS, images, polices)
   - Compression gzip

```bash
# Build
docker build -t geosm-frontend .

# Run
docker run -p 80:80 geosm-frontend
```

---

## CI/CD

Le projet dispose d'un pipeline CI/CD complet via GitHub Actions :

| Workflow | Declencheur | Description |
|---|---|---|
| **CI** | push/PR sur main, dev | Linting, TypeScript, tests unitaires, build production |
| **Qualite du code** | push/PR sur main, dev | ESLint, verification TypeScript, couverture de code |
| **Securite** | push/PR + hebdomadaire | Audit npm, detection de secrets, scan de vulnerabilites |
| **Deploiement** | push sur main | Tests, build Docker, push GHCR, creation de release |

Les workflows sont definis dans `.github/workflows/`.

---

## Contribution

Consultez [CONTRIBUTING.md](./CONTRIBUTING.md) pour les directives de contribution a ce projet.

---

## Licence

Ce projet est sous licence MIT. Voir [LICENSE](./LICENSE) pour les details.

Copyright (c) 2024-2026 GeOSM Family
