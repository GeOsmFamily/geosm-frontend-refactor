# 0004. i18n via ngx-translate avec parite de cles verifiee en CI

Statut : Accepte
Date : 2026-08-08

## Contexte

GeOSM cible plusieurs pays et plusieurs langues (francais, anglais, espagnol - voir
`src/assets/i18n/{fr,en,es}.json`, 304 cles de traduction). Angular propose son propre mecanisme
de i18n natif (`@angular/localize`), base sur une compilation *par langue* (un build genere par
locale, avec redirection au niveau du serveur/reverse proxy) - puissant mais rigide : changer de
langue demande de recharger une version entierement differente de l'application.

Le selecteur de langue de GeOSM (panneau Parametres) doit permettre un changement de langue
instantane, sans rechargement de page, dans une application qui n'a qu'un seul build de
production a deployer (pas un build par langue a gerer separement au niveau infrastructure).

## Decision

`ngx-translate` (fichiers JSON charges a l'execution, cle -> traduction) plutot que
`@angular/localize`. Le changement de langue est un simple appel `TranslateService.use(lang)` -
aucune recompilation ni rechargement necessaire. Une verification de parite des cles entre les
trois fichiers (`fr.json`/`en.json`/`es.json`) tourne en CI - une cle presente dans une langue
mais absente d'une autre echoue le build, plutot que de laisser une traduction manquante
silencieuse apparaitre en production (repli visible sur la cle brute, ex. `MAP.ZOOM_IN`, au lieu
du texte attendu).

## Consequences

- Changer de langue est instantane pour l'utilisateur - aucun rechargement de page, coherent
  avec le reste de l'application qui est une SPA a etat persistant (carte, couches actives...).
- Un seul build de production sert les trois langues - pas de complexite de deploiement liee au
  routage par locale (pas de sous-domaines ou prefixes d'URL par langue a gerer cote reverse
  proxy).
- Les traductions sont chargees a l'execution (fichiers JSON recuperes par requete HTTP), pas
  inlinees a la compilation - legerement moins performant qu'une inline `@angular/localize` au
  premier chargement, et une cle mal orthographiee dans le code (`'MAP.ZOM_IN'` au lieu de
  `'MAP.ZOOM_IN'`) n'est detectee par aucun outil a la compilation, seulement a l'usage reel (la
  cle brute s'affiche alors a l'ecran) - la verification CI ne garantit que la parite ENTRE
  langues, pas qu'une cle utilisee dans le code existe reellement dans les fichiers JSON.
- Ajouter une langue supplementaire est un changement purement additif (un nouveau fichier JSON
  + une entree dans `availableLanguages`, voir `environment.ts`) - aucune recompilation par
  locale a mettre en place, contrairement a `@angular/localize`.

## Alternatives envisagees

- **`@angular/localize`** (i18n natif Angular) : performance superieure (traductions inlinees,
  pas de requete HTTP a l'execution) et verification a la compilation des cles manquantes -
  ecarte principalement pour la rigidite du changement de langue (necessite un build/une
  redirection par locale), incompatible avec le changement instantane attendu du selecteur de
  langue, et pour la complexite de deploiement additionnelle (un artefact par langue) alors que
  le reste du projet vise une infrastructure la plus simple possible a operer (voir les ADR
  cote backend sur l'auto-hebergement).
