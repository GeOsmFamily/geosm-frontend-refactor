# Audit Frontend — GeOSM

**Date de l'audit :** 2026-07-09
**Périmètre :** `geosm-frontend-refactor` (Angular 18, standalone components)
**Statut :** Phase 0 — cartographie et audit. Aucune modification de code effectuée.

---

## 1. Stack et conventions existantes

- **Framework :** Angular 18 (standalone components, signals utilisés dans plusieurs composants récents comme `map-layout`).
- **UI Kit :** Angular Material 18 (`@angular/material`, `@angular/cdk`), thème M2 personnalisé (`mat.m2-define-light-theme` / `mat.m2-define-dark-theme`) dans `src/styles.scss`.
- **Cartographie :** OpenLayers 10 (`ol`), Turf.js pour l'analyse spatiale.
- **i18n :** `@ngx-translate/core`, fichiers `src/assets/i18n/{fr,en,es}.json`.
- **Style :** SCSS par composant + un fichier global `src/styles.scss` (731 lignes) contenant déjà un socle de tokens CSS (`:root { --primary, --accent, --background, --surface, --text*, --border*, --radius-sm/md/lg/xl, --shadow-sm/md/lg/xl, --transition-fast/normal/slow, --header-height, --sidebar-width }`) et un thème sombre (`body.dark-theme`).
- **Police :** `Avenir Next Rounded Pro` (self-hosted, plusieurs graisses) avec repli `Roboto` (chargé aussi depuis Google Fonts CDN dans `index.html`).
- **Icônes :** `material-icons` (police, via `<mat-icon>`) + un dossier `src/assets/icones/` de 34 fichiers `.svg`/`.png` hétérogènes.
- **Tests :** Karma/Jasmine (unitaires), Playwright (e2e, `e2e/auth.spec.ts`).

**Constat clé :** contrairement à ce qu'on pourrait craindre pour un projet de cette taille, un **socle de design tokens existe déjà** (radius, shadow, couleurs, transitions, dark mode). Le travail n'est donc pas de partir de zéro, mais de :
1. compléter les tokens manquants (espacement, typographie, z-index) ;
2. faire respecter les tokens existants (de nombreux fichiers les contournent avec des valeurs en dur) ;
3. factoriser la duplication massive de markup/CSS entre composants similaires ;
4. corriger des trous fonctionnels UI concrets (fermeture Escape/clic-extérieur, responsive de l'admin, états d'erreur manquants).

**Remarque sur les captures d'écran fournies :** les maquettes montrent un réseau social (posts, groupes, profils, badges) qui **n'existe pas** dans ce code source. Ce codebase est une plateforme cartographique (carte, couches, outils SIG, admin). Conformément à la consigne, ces maquettes sont traitées comme **inspiration visuelle uniquement** (épuré, blanc dominant, coins arrondis, une couleur d'accent) — aucune fonctionnalité social/réseau ne sera ajoutée.

---

## 2. Problèmes transverses (impact le plus large — à traiter en Phase 1)

### 2.1 Tokens manquants malgré un système déjà mature
- Aucune **échelle d'espacement** (`--space-*`) : seuls `.gap-4`/`.gap-8` existent (`styles.scss:636-641`). Le reste du fichier (et de l'app) utilise des marges/paddings magiques (`24px` répété 6 fois dans `styles.scss` seul, `40px 32px`, `12px` vs `16px` pour les mêmes éléments selon le fichier).
- Aucune **échelle typographique** (`--font-size-*`) : tailles fragmentées de 10px à 16px sans paliers nommés, constaté dans les 5 audits (auth, map, tools, admin).
- Aucune **échelle de z-index** : valeurs magiques `1, 10, 50, 55, 60, 100, 1000, 9999` dispersées sur 8+ fichiers sans hiérarchie documentée (`map-layout.component.scss` empile 6 valeurs locales différentes ; `context-menu` et le modal de partage partagent tous deux `1000` par coïncidence).
- Le **font-family** complet (`'Avenir Next Rounded Pro Regular', 'Roboto', ...`) est recopié en toutes lettres **12+ fois** dans `styles.scss` seul, et à nouveau dans quasiment chaque `.scss` de composant, au lieu d'une variable `--font-family-base`.
- `--radius-xl: 24px` existe mais `styles.scss:718-731` recode `24px` en dur 4 fois au lieu de le réutiliser.

### 2.2 Icônes : trois systèmes qui coexistent sans règle
1. `<mat-icon>` (police material-icons) — 377 occurrences, dominant et globalement bien choisi.
2. `src/assets/icones/` — 34 fichiers `.svg`/`.png`/`.jpg`, dont seulement ~4 références actives trouvées dans le code (le reste semble être des assets orphelins, avec des doublons probables : `mappilary.png`, `mappilary-copy.png`, `mapillary-couche.png`, `logo-mapillary.png`).
3. Icônes SVG génératives dans `icon-picker` (admin) pour les marqueurs de carte — légitime mais non signalé comme système distinct.

Tailles de `mat-icon` observées à travers l'app : **13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 34, 36, 40, 44, 52-54px** — aucune échelle nommée ; chaque composant redéfinit `font-size + width + height` en trio à la main.

### 2.3 Panneaux flottants de la carte : aucun ne se ferme au clavier ou au clic extérieur
Les 8 panneaux `floating-panel` de `map-layout.component.html` (geosignets, mes cartes, assistant, fonds de carte, réglages, info, menu d'outils, outil actif) :
- n'ont **aucun** gestionnaire `Escape` (`@HostListener`/`keydown` absents),
- n'ont **aucun** overlay/backdrop de fermeture au clic extérieur (contrairement au modal de partage `share-modal-overlay`, qui lui gère les deux correctement).

Les vraies `MatDialog` (zoom, métadonnées, fiche descriptive) héritent du comportement par défaut de Material (Escape + backdrop click) — bon point, mais accentue l'incohérence avec les panneaux custom.

Côté admin, à l'inverse, **aucun dialog n'utilise `disableClose`**, y compris l'assistant de création de couche à 4 étapes (`layer-creation-wizard`) — un Escape accidentel perd tout un formulaire multi-étapes sans confirmation.

### 2.4 Responsive : deux zones critiques sans aucune stratégie
- **`admin-layout`** : sidebar fixe 240px, `<aside>`/flex à la main (pas de `mat-sidenav`), **zéro `@media`** dans tout le fichier. Sur mobile/tablette, le contenu se comprime au lieu que la sidebar se transforme en drawer.
- **`--sidebar-width: 340px`** (carte) : la seule media query (`768px`) fait passer le panneau en `position: absolute` mais garde la largeur fixe à 340px — sur un mobile de 360px de large, le panneau occupe la quasi-totalité de l'écran.
- Plus largement, **seuls 6 fichiers `.scss` sur l'ensemble de l'app** contiennent une `@media` query.
- Les tables (`admin-data-table`, tables admin "faites main" dans `jobs`/`system-tools`, `metadata-modal`) n'ont pas de wrapper `overflow-x: auto` ni de transformation en cartes sur mobile — elles débordent ou sont tronquées.

### 2.5 Duplication massive de markup/CSS (candidats à factorisation prioritaires)
| Pattern dupliqué | Fichiers concernés | Ampleur |
|---|---|---|
| Layout "split-screen" auth (login/register) | `login.*`, `register.*` | ~300 lignes quasi identiques |
| Layout "carte centrée" auth (mot de passe oublié/réinitialisation/vérification) | `forgot-password.*`, `reset-password.*`, `verify-email.*` | ~230 lignes quasi identiques |
| `geosignets` vs `my-maps` | composants + styles | ~98% identiques |
| Skeleton "page liste admin" (header + filtres + `admin-data-table`) | `users`, `instances`, `content`, `feedback`, `base-maps`, `default-themes`, `catalog-tree` | 10+ instances quasi identiques |
| Skeleton "dialog formulaire admin" | 7 `*-form-dialog.component.*` | boilerplate Material/FormBuilder/actions identique |
| Bloc CSS partagé des outils (h3/h4/.hint) non étendu à tous les outils | `nearest-search`, `plan-localisation`, `spatial-analysis` (absents de la liste `styles.scss:671-680`), `altimetry` (présent mais réécrit quand même) | ~40 lignes × 4 |
| Bouton CTA "générer" en dégradé | `print-tool`, `plan-localisation-tool`, `export-tool` | ~30 lignes × 3 |
| Keyframe spinner CSS | `map-toolbar`, `map-layout`, `catalog-browser`, `assistant-chat`, `search-bar` | 5 implémentations indépendantes |

### 2.6 États d'interface incohérents
- **Erreurs de chargement silencieuses côté admin** : `users`, `instances`, `content`, `feedback`, `base-maps`, `catalog-tree`, `default-themes` — un échec d'API sur le GET initial affiche le même message "aucun résultat" qu'une liste réellement vide, sans distinction.
- **Aucun état d'erreur explicite** dans les 6 outils asynchrones de la carte (export, impression, routage, statistiques, analyse spatiale, recherche du plus proche) — si l'appel échoue, le spinner disparaît simplement sans message.
- **5 traitements visuels différents** pour "chargement en cours" entre les composants (icône qui tourne, `hourglass_empty` statique, `mat-spinner` avec/sans libellé).
- Boutons de soumission (`login`, `register`, `forgot-password`, `reset-password`) : aucun `min-width`, le remplacement du libellé par un spinner peut provoquer un saut de layout.
- `LoadingSpinnerComponent` partagé existe et est utilisé dans 10 endroits, mais **12 autres composants** recréent leur propre `<mat-spinner>` brut au lieu de le réutiliser.

### 2.7 Code mort et fichiers inutilisés
- `src/assets/css/bootstrap.css`, `bootstrap.min.css`, `animate.css` : **confirmés non référencés** (ni dans `angular.json`, ni dans `index.html`, ni via aucun `@import`/`@use` SCSS). À supprimer.
- `mapillary-tool.component.html:144-153` : bouton de déclenchement du mode plein écran encapsulé dans `@if (false)` — markup et SCSS associés (`mapillary-tool.component.scss:245-259`) définitivement inatteignables.
- La majorité des 34 fichiers de `src/assets/icones/` semblent orphelins (seuls ~4 sont référencés).

---

## 3. Constats détaillés par zone fonctionnelle

### 3.1 Authentification (`src/app/features/auth/`)
- **Responsive** : seuls `login`/`register` ont des `@media` (900px, 480px) ; les 3 écrans "carte centrée" n'en ont aucun (acceptable vu la fluidité du layout, mais `padding: 40px 32px` sur carte `max-width: 400px` est serré sous 360px).
- **Boutons** : hauteur forcée `48px !important` sur login/register, absente sur les 3 autres écrans → boutons de tailles visuellement différentes selon l'écran. Aucun état `:focus-visible` custom sur les liens (`back-link`, `forgot-link`). Champ "confirmer le mot de passe" de `reset-password` **n'a pas** de bouton œil afficher/masquer alors que le champ mot de passe juste au-dessus en a un.
- **Texte** : `register.component.ts` stocke des messages d'erreur en anglais en dur (`'All fields are required.'`) alors que le reste de l'app est traduit via `ngx-translate` ; `reset-password` fait bien le lien avec `| translate`. Incohérence de langue potentielle pour l'utilisateur final.
- **Couleurs** : `forgot-password`, `reset-password`, `verify-email` utilisent des couleurs hexadécimales en dur (`#023f5f`, `#00ada7`, `#ef4444`...) au lieu des variables CSS — ces 3 écrans **ne s'adapteront pas** au thème sombre, contrairement à `login`/`register` qui utilisent bien `var(--primary)` etc.
- **États** : bon pattern de spinner dans le bouton de soumission partout, mais **aucune erreur inline par champ** (`mat-error` jamais utilisé malgré `MatFormFieldModule` importé) — uniquement une bannière générique en haut du formulaire.
- **Code** : deux familles de layout dupliquées (voir §2.5) ; `auth-callback.component.ts` est le seul composant auth en template/styles inline au lieu de fichiers séparés.

### 3.2 Carte, couches, recherche, partage (`map/`, `layers/`, `search/`, `sharing/`)
- **Panneaux** : voir §2.3 (Escape/clic-extérieur absents partout sauf le modal de partage).
- **Responsive** : `--sidebar-width: 340px` non responsive (voir §2.4) ; `metadata-modal`/`descriptive-sheet` ont un `min-width: 400px` sans wrapper de scroll horizontal dédié pour leurs tableaux.
- **z-index** : voir §2.2 — collisions potentielles entre `context-menu` (1000) et `share-modal-overlay` (1000) ; `search-bar` réutilise `100` (même valeur que le header) sans lien logique.
- **Boutons** : bon set d'états sur `map-toolbar` (hover/disabled/dark-mode) mais aucun `:focus-visible` ; 3 traitements différents du spinner "loading" (rotation d'icône, `hourglass_empty`, `mat-spinner`) pour le même concept.
- **Icônes** : cohérent (pas d'`<img>` utilisé comme icône fonctionnelle hors logos légitimes Wikipedia/Wikidata/OSM), mais tailles très fragmentées (voir §2.2).
- **Texte** : police en dur recopiée dans quasiment chaque `.scss` de cette zone ; mélange de clés i18n et de chaînes françaises/anglaises codées en dur dans les `.ts` (`shared-map.component.ts:57` est en anglais alors que le reste est en français).
- **États** : `geosignets`/`my-maps` ont un bon état vide illustré + état "connexion requise" — mais dupliqué mot pour mot entre les deux au lieu d'être factorisé. `legend.component.html` n'a pas de gestion d'erreur sur ses images de légende WMS (`(error)` absent), contrairement à `feature-info`/`base-map-switcher` qui le font.
- **Code** : duplication quasi totale `geosignets`/`my-maps` (§2.5) ; `feature-info.component.ts` fait 449 lignes et mélange logique de présentation et logique métier lourde (clustering, polling d'export) — candidat à extraction de service ; `search-bar.component.ts` utilise `fetch()` natif au lieu du `ApiService`/intercepteurs utilisés partout ailleurs.

### 3.3 Outils de carte (`tools/` — 12 composants)
- **Duplication principale** : 4 outils (`nearest-search`, `plan-localisation`, `spatial-analysis`, et `altimetry` qui le fait quand même bien qu'inclus) recodent un bloc h3/.hint/.pick-btn identique au lieu d'étendre la liste de sélecteurs partagée dans `styles.scss:671-680`.
- **Titres incohérents** : `compare-tool`, `statistics-tool`, `mapillary-tool` utilisent `<h4>` (sous-titre, 13px) comme titre principal au lieu de `<h3>` (15px/600) utilisé par les 9 autres outils — leur titre paraît plus faible visuellement.
- **Sélecteur de mode incohérent** : la plupart des outils utilisent `mat-button-toggle-group` (chacun avec son propre `::ng-deep` différent), mais `drawing-tool` utilise une rangée de `mat-mini-fab` — deux paradigmes différents pour la même tâche "choisir un mode".
- **Boutons CTA dupliqués** (dégradé `linear-gradient(135deg,#023f5f,#00ada7)`) dans `print-tool`, `plan-localisation-tool`, `export-tool` — ~30 lignes × 3 au lieu d'une classe `.cta-button` partagée.
- **Tailles de boutons icône non standardisées** : 22×22, 24×24, 28×28, 30×30, 32×32px selon le fichier, sans token commun.
- **Padding en double** : `mapillary-tool`, `compare-tool`, `statistics-tool` ajoutent leur propre padding sur la racine en plus de celui déjà appliqué par `tool-panel.component.scss` — largeur utile réduite pour ces 3 outils uniquement.
- **`mapillary-tool`** utilise un style "glass" sombre (fond blanc translucide, bordures blanches translucides) pensé pour un fond sombre, mais s'affiche dans le panneau clair (`--background` clair) — bordures/fonds quasi invisibles.
- **`drawing-tool`** n'utilise **aucune** variable CSS (`#1976d2`, `#ccc`, `#f5f5f5`... en dur), y compris une couleur bleue hors palette qui ne correspond ni à `--primary` ni à `--accent`.
- **États** : aucun des 6 outils asynchrones n'affiche d'état d'erreur explicite ; 5 traitements visuels différents du "chargement en cours" ; `print-tool` et `statistics-tool` n'ont aucun état vide.

### 3.4 Back-office admin (`admin/`)
- **Responsive** : `admin-layout` — sidebar fixe 240px, zéro `@media`, pas de `mat-sidenav`/drawer (voir §2.4, le problème structurel le plus important de tout l'audit).
- **`admin-data-table`** (réutilisé par 8 pages sur 11) : `overflow: hidden` au lieu de `overflow-x: auto` → aucun fallback responsive pour les tables larges.
- **Tables "faites main"** dans `jobs`/`system-tools` : même lacune, plus duplication de leur propre CSS de table au lieu de partager celui de `admin-data-table`.
- **Panneaux/dialogs** : squelette de dialog très cohérent visuellement (titre/contenu/actions) mais copié-collé 7 fois sans base commune ; **aucun `disableClose`** nulle part, y compris sur l'assistant de création de couche à 4 étapes — un Escape accidentel perd tout le formulaire.
- **Pagination fantôme** : plusieurs listes (`base-maps`, `default-themes`, `catalog-tree` ×3) affichent un `mat-paginator` avec `pageSize=100` uniquement pour désactiver la pagination réelle — espace vertical gâché pour un contrôle sans usage réel.
- **Icônes** : tailles locales incohérentes (22, 20, 16, 14, 18px) sans échelle partagée.
- **Texte** : bypass i18n localisé — `jobs.component.html` passe des libellés anglais en dur (`"Waiting"`, `"Active"`...) au lieu de `| translate`, alors que le reste du module est traduit.
- **États** : erreurs de chargement initial silencieuses sur 7 pages de liste (voir §2.6) ; état vide générique unique (`admin.common.noResults`) sans distinction ni illustration sur ~10 pages.
- **Code** : duplication du skeleton "page liste" sur 10+ instances et du skeleton "dialog formulaire" sur 7 instances (voir §2.5, l'essentiel de la dette de ce module) ; `layer-creation-wizard.component.html` est un composant monolithique de ~300 lignes mélangeant 4 étapes qui gagnerait à être scindé en sous-composants.

---

## 4. Plan de correction proposé (Phase 1 → Phase 2)

### Phase 1 — Compléter le design system (avant tout refactor visuel)
1. Ajouter dans `styles.scss` : échelle d'espacement (`--space-1..8`, multiples de 4px), échelle typographique (`--font-size-xs..xl` + `--font-family-base`), échelle de z-index (`--z-panel: 10; --z-sticky: 20; --z-overlay: 30; --z-modal: 40; --z-toast: 50`), échelle d'icônes (`--icon-sm: 16px; --icon-md: 20px; --icon-lg: 24px`).
2. Supprimer les fichiers CSS morts (`bootstrap.css`, `bootstrap.min.css`, `animate.css`).
3. Auditer et supprimer les assets orphelins de `assets/icones/`.
4. Créer un mixin/classe utilitaire `.icon-sm/.icon-md/.icon-lg` pour remplacer les triplets `font-size+width+height` copiés partout.
5. Créer un mixin `.floating-panel-close-behavior` (Escape + backdrop click) réutilisable par les 8 panneaux carte + composants admin concernés.

### Phase 2 — Traitement fichier par fichier (ordre proposé)
1. **Layout global** : `app.component`, `styles.scss` (nettoyage), `admin-layout` (responsive + drawer mobile — priorité haute, seule zone totalement non responsive).
2. **Navigation** : `map-layout` header/panneaux (fermeture Escape/backdrop, z-index cohérent, sidebar responsive).
3. **Auth** : extraire 2 layouts partagés (`AuthSplitLayoutComponent`, `AuthCardLayoutComponent`) pour supprimer ~500 lignes dupliquées et corriger l'incohérence dark-mode/couleurs en dur.
4. **Carte/Layers/Search/Sharing** : factoriser `geosignets`/`my-maps`, ajouter gestion d'erreur sur les images de légende, uniformiser le spinner "loading".
5. **Tools** : étendre le bloc CSS partagé aux 3 outils manquants, unifier le sélecteur de mode, extraire `.cta-button` partagé, corriger `mapillary-tool` (thème glass) et `drawing-tool` (tokens absents).
6. **Admin** : factoriser le skeleton "page liste" et le skeleton "dialog formulaire", corriger `admin-data-table` (scroll horizontal), ajouter des états d'erreur distincts des états vides, décider au cas par cas si `disableClose` doit être ajouté sur les dialogs à perte de données (ex. `layer-creation-wizard`).

---

## 5. Suivi des corrections

*(Cette section sera mise à jour au fur et à mesure des commits de la Phase 2 — chaque problème listé ci-dessus sera marqué corrigé avec référence au fichier et à la nature du correctif.)*

- [ ] Phase 1 — Design system consolidé
- [ ] Layout global / admin-layout responsive
- [ ] Navigation carte (panneaux : Escape + backdrop + z-index)
- [ ] Auth (layouts partagés)
- [ ] Carte / Layers / Search / Sharing
- [ ] Tools (12 composants)
- [ ] Admin (listes + dialogs)
