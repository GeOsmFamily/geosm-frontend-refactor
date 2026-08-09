# 0002. Nx comme outillage de build (pas de `angular.json`)

Statut : Accepte
Date : 2026-08-08

## Contexte

Ce depot n'a pas de `angular.json` a sa racine (le fichier de configuration standard que
l'Angular CLI attend) - il a un `project.json` et un `nx.json`, parce que le workspace est gere
par **Nx** plutot que par l'Angular CLI seul. C'est une source de confusion reelle et repetee :
lancer `ng build` ou `ng serve` directement (reflexe naturel pour quiconque a deja travaille sur
un projet Angular classique) echoue avec `Error: This command is not available when running the
Angular CLI outside a workspace` - une erreur qui ne dit pas explicitement "utilisez Nx", ce qui
peut faire perdre du temps a un contributeur qui ne sait pas que le projet utilise Nx.

## Decision

Le workspace est un projet Nx (`@nx/angular`, `@nx/workspace`, voir `package.json`), avec un
seul projet Angular nomme **`geosm-frontend`** (voir le champ `"name"` dans `project.json` - a
ne pas confondre avec le nom du paquet npm `geosm-frontend-refactor`). Toutes les commandes
passent par les scripts npm definis (`npm start` = `nx serve`, `npm run build` = `nx build`,
`npm test` = `nx test`, `npm run lint` = `nx lint`) plutot que par l'Angular CLI en direct.

## Consequences

- Les commandes `ng build`/`ng serve` sans passer par les scripts npm (ou sans prefixer par
  `nx`) echouent immediatement - un contributeur venant d'un projet Angular CLI classique doit
  apprendre ce reflexe des le premier lancement. Le devcontainer de ce depot
  (`.devcontainer/`) documente `npm start` comme point d'entree justement pour eviter ce piege.
- Nx apporte la mise en cache des taches (build/test/lint) et le calcul de graphe de
  dependances, utile si le workspace grossit vers plusieurs projets (ex. une future librairie
  partagee entre plusieurs apps) - un benefice qui ne se voit pas encore avec un seul projet
  Angular dans le workspace, mais qui evite une migration plus tard si ce besoin apparait.
- Toute commande Angular CLI generique documentee sur le web (Stack Overflow, doc officielle
  Angular) doit etre mentalement traduite ("`ng g component X`" reste generalement valide via
  `nx g @nx/angular:component X`, mais "`ng build --configuration production`" doit passer par
  `nx build --configuration production` ou le script `npm run build`).

## Alternatives envisagees

- **Angular CLI seul** (`angular.json`, sans Nx) : c'est l'option la plus familiere pour la
  majorite des contributeurs Angular, et evite entierement le piege documente ci-dessus. Pas
  retenue ici parce que le choix Nx etait deja fait avant la redaction de cette ADR (voir
  `git log` pour l'historique) - documentee a posteriori pour que le compromis (familiarite
  contre outillage de cache/scaling) soit au moins explicite pour la suite, plutot que
  silencieux.
