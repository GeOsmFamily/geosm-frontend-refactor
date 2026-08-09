# Architecture Decision Records (ADR)

Ce dossier documente le **pourquoi** des choix d'architecture structurants du frontend GeOSM -
pas le comment (deja couvert par le `README.md` a la racine). Une ADR n'est pas un journal de
toutes les decisions techniques : seulement celles qui sont couteuses a revenir dessus, ou qui
surprennent systematiquement les nouveaux contributeurs qui les redecouvrent par essai-erreur
faute de les avoir lues quelque part - voir par exemple l'ADR [0002](0002-nx-workspace.md), qui
documente un piege reel (`ng build` echoue silencieusement en dehors de tout contexte) rencontre
en pratique.

## Pourquoi ce dossier existe

Ce projet est open source et accepte des contributions externes. Le meme dossier existe cote
backend (`geosm-api-refactor/docs/adr/`) - les deux se lisent independamment, chaque ADR reste
specifique a son depot.

## Index

| # | Titre | Statut |
|---|---|---|
| [0001](0001-standalone-components.md) | Composants Angular standalone (pas de NgModules) | Accepte |
| [0002](0002-nx-workspace.md) | Nx comme outillage de build (pas de `angular.json`) | Accepte |
| [0003](0003-openlayers-over-mapbox-gl.md) | OpenLayers plutot que Mapbox GL JS/Leaflet | Accepte |
| [0004](0004-ngx-translate-i18n.md) | i18n via ngx-translate avec parite de cles verifiee en CI | Accepte |

## Proposer une nouvelle ADR

Voir le `template.md` de ce dossier, et le meme processus que cote backend : copier le
template, remplir Contexte/Decision/Consequences/Alternatives, ouvrir une PR, ajouter une ligne
au tableau ci-dessus. Le statut d'une ADR se remplace (`Remplace par 000N`), il ne se reecrit
jamais silencieusement.
