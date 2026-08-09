# 0001. Composants Angular standalone (pas de NgModules)

Statut : Accepte
Date : 2026-08-08

## Contexte

Depuis Angular 14+, un composant peut declarer directement ses propres imports
(`@Component({ standalone: true, imports: [...] })`) sans passer par un `NgModule`
intermediaire qui les regroupe. GeOSM est un projet a l'architecture par fonctionnalites
(`src/app/features/map`, `features/layers`, `features/tools`, `features/admin`...) avec
beaucoup de composants relativement independants (chaque outil de la barre d'outils, chaque
panneau flottant) plutot qu'une hierarchie figee.

## Decision

Tous les composants du projet sont standalone - aucun `NgModule` de fonctionnalite. Chaque
composant importe explicitement ce dont il a besoin (`CommonModule`, modules Angular Material,
`TranslateModule`...) directement dans son propre `@Component`. Le routage utilise
`loadComponent` (lazy-loading direct d'un composant) plutot que `loadChildren` vers un module.

## Consequences

- Les dependances d'un composant sont visibles directement dans son fichier - pas besoin de
  remonter jusqu'a un `NgModule` pour savoir ce qu'un composant a importe pour fonctionner.
- Le lazy-loading par route est plus granulaire (par composant plutot que par module entier),
  ce qui a deja evite un vrai probleme reel : un import circulaire entre un composant enfant et
  son parent charge en lazy cassait la navigation en developpement (`ng serve`, erreur JIT) -
  detecte et corrige via un `@Output()` plutot qu'une injection directe du parent (voir
  CHANGELOG). Le decoupage standalone rend ce genre de dependance circulaire plus visible et
  plus facile a corriger localement, sans toucher a un module partage.
- Chaque composant repete ses propres imports (`CommonModule`, `TranslateModule`, modules
  Material...) - plus verbeux qu'un `NgModule` partage qui les centraliserait une seule fois,
  mais chaque fichier reste comprehensible isolement.
- Aucune notion de module "shared" a maintenir a jour - le dossier `shared/` du projet ne
  contient que des composants reutilisables directement importables, pas un module a
  enregistrer quelque part.

## Alternatives envisagees

- **NgModules classiques** (l'approche historique d'Angular) : ecarte - Angular lui-meme
  recommande desormais standalone comme approche par defaut pour tout nouveau projet, et le
  decoupage par fonctionnalites deja en place dans `features/` se marie naturellement avec des
  composants independants plutot qu'avec des modules qui regroupent artificiellement des
  composants qui n'ont pas forcement besoin d'etre lies entre eux.
