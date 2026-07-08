# Contribuer a GeOSM Frontend

Merci de votre interet pour contribuer a GeOSM Frontend. Ce document fournit les directives et instructions pour contribuer au projet.

## Pour commencer

1. **Forker** le depot sur GitHub
2. **Cloner** votre fork localement :
   ```bash
   git clone https://github.com/<votre-utilisateur>/geosm-frontend.git
   cd geosm-frontend
   ```
3. **Creer une branche** pour votre travail :
   ```bash
   git checkout -b feat/nom-de-votre-fonctionnalite
   ```
4. **Installer les dependances** et configurer votre environnement (voir [README.md](./README.md), section `environment.ts`)
5. **Effectuer vos modifications**, ecrire les tests et verifier que tout passe
6. **Pousser** votre branche et ouvrir une **Pull Request**

---

## Style de code

- **Langage** : TypeScript (mode strict), Angular 18 (composants standalone, Signals, nouvelle syntaxe de controle de flux `@if`/`@for`/`@switch`)
- **Linting** : ESLint 9 avec `angular-eslint` + `typescript-eslint`
- **Formatage** : Prettier 3 (le parser `angular` est applique automatiquement aux fichiers `*.html` via `.prettierrc`)
- **Conventions de nommage** :
  - `kebab-case` pour les noms de fichiers (ex: `layer-panel.component.ts`)
  - `PascalCase` pour les classes, interfaces et composants (ex: `LayerPanelComponent`)
  - `camelCase` pour les variables, fonctions et proprietes
  - Suffixes standards Angular : `.component.ts`, `.service.ts`, `.guard.ts`, `.interceptor.ts`, `.spec.ts`

Executez ces commandes avant de commiter :

```bash
npm run lint          # Verifier les problemes de linting (ng lint)
npm run format        # Formater automatiquement le code avec Prettier
npm run format:check  # Verifier le formatage sans modifier (utilise en CI)
```

> **Piege connu** : `npx tsc --noEmit` (verification TypeScript brute) ne detecte PAS les erreurs de compilation de templates Angular (ex: un alias `as x` non enregistre dans un bloc `@else if (...; as x)`). Apres toute modification d'un fichier `.html`, verifiez toujours avec `ng build` ou en observant le log du serveur `ng serve` — pas seulement `tsc`.

---

## Directives architecturales

Le projet est organise en modules fonctionnels sous `src/app/` :

### `src/app/core/`

- **Services** : Un service par domaine (auth, layers, instances, catalogue, etc.), injectes en `providedIn: 'root'`
- **Guards** : Protection des routes (`authGuard`, `adminGuard`, etc.)
- **Interceptors** : Gestion transverse HTTP (`error.interceptor.ts`, `auth.interceptor.ts`)
- **Models** : Interfaces TypeScript partagees (`core/models/index.ts`)

### `src/app/features/`

- Un dossier par domaine fonctionnel (`map`, `layers`, `admin`, `auth`, `tools`, etc.)
- Chaque composant est **standalone** (pas de `NgModule`), avec ses propres `imports`
- Les composants complexes suivent le pattern `.component.ts` / `.component.html` / `.component.scss` / `.component.spec.ts`

### `src/app/shared/`

- Composants, pipes et directives reutilisables entre plusieurs features

### Principes cles

- Utiliser les **Signals** plutot que `BehaviorSubject` pour l'etat local de composant quand c'est pertinent
- Utiliser la nouvelle syntaxe de controle de flux (`@if`/`@for`/`@switch`) plutot que `*ngIf`/`*ngFor`
- Toute nouvelle chaine visible utilisateur doit avoir une cle i18n ajoutee **dans les 3 langues** (`src/assets/i18n/fr.json`, `en.json`, `es.json`) — la CI verifie la parite des cles entre les 3 fichiers
- Les appels HTTP passent par un service dedie dans `core/services/`, jamais directement dans un composant

---

## Tests

- **Unitaires** : Karma + Jasmine (`*.spec.ts` a cote du fichier source)
- **End-to-end** : Playwright (`e2e/`)

```bash
npm test        # Lancer les tests unitaires (Karma, mode watch par defaut)
npm run e2e      # Lancer les tests end-to-end (Playwright)
npm run e2e:ui   # Playwright en mode UI interactif
```

> **Piege connu** : `npx tsc --noEmit` ne type-check pas les fichiers `*.spec.ts` (seul `ng test`, qui utilise `tsconfig.spec.json`, le fait). Executez `npm test` avant de commiter si vous avez touche a des mocks ou des interfaces partagees, meme si `tsc --noEmit` est propre.

Toutes les PRs doivent passer les tests existants. Les nouvelles fonctionnalites doivent inclure des tests.

---

## CI/CD

Le projet utilise **GitHub Actions** avec 4 pipelines :

| Pipeline | Declencheur | Description |
|---|---|---|
| **CI** (`ci.yml`) | Push/PR sur `main`, `dev`, `claude/**` | Lint, tests unitaires (Karma headless), build |
| **Qualite du code** (`code-quality.yml`) | Push/PR sur `main`, `dev`, `claude/**` | Build strict production, formatage Prettier, taille du bundle, parite i18n fr/en/es |
| **Securite** (`security.yml`) | Push/PR + hebdomadaire | Audit npm, scan de secrets, analyse SAST, scan Docker |
| **Deploiement** (`deploy.yml`) | Push sur `main` | Build Docker, push GHCR, release |

**Dependabot** est configure pour les mises a jour hebdomadaires (npm, Docker, GitHub Actions) sur la branche `dev`.

---

## Format des commits

Suivez la specification [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(<portee>): <description courte>

[corps optionnel]

[pied de page optionnel]
```

### Types

| Type | Description |
|---|---|
| `feat` | Nouvelle fonctionnalite |
| `fix` | Correction de bogue |
| `docs` | Modifications de documentation |
| `style` | Modifications de style de code (formatage, aucun changement de logique) |
| `refactor` | Refactorisation de code (ni fonctionnalite ni correction) |
| `perf` | Amelioration des performances |
| `test` | Ajout ou mise a jour de tests |
| `chore` | Modifications du build, CI ou outillage |

### Exemples

```
feat(map): ajouter le clustering des marqueurs de points
fix(auth): corriger la redirection apres verification d'email
docs(readme): mettre a jour la liste des composants
refactor(layers): extraire la logique de style dans un service dedie
test(admin): ajouter des tests pour le composant de statistiques
```

---

## Checklist PR

Avant de soumettre votre PR, verifiez :

- [ ] Le build production passe (`ng build --configuration production`)
- [ ] Le linting passe (`npm run lint`)
- [ ] Le formatage est correct (`npm run format:check`)
- [ ] Tous les tests unitaires passent (`npm test`)
- [ ] Les nouvelles chaines visibles sont traduites dans `fr.json`, `en.json` et `es.json`
- [ ] Les messages de commit suivent le format conventional commits
- [ ] Le titre de la PR est concis et descriptif
- [ ] La description de la PR explique le "pourquoi" du changement
- [ ] Les nouvelles routes sont ajoutees a `app.routes.ts` (et `admin.routes.ts` si applicable)
- [ ] Les composants standalone declarent explicitement leurs `imports`

---

## Code de conduite

Soyez respectueux, constructif et collaboratif. Nous nous engageons a offrir une experience accueillante et inclusive pour tous. Le harcelement, la discrimination et les comportements irrespectueux ne seront pas toleres.

---

## Questions ?

Ouvrez une issue sur GitHub en utilisant les templates disponibles (bug, fonctionnalite, documentation) pour les questions, demandes de fonctionnalites ou rapports de bogues.

---

*Derniere mise a jour : Juillet 2026*
