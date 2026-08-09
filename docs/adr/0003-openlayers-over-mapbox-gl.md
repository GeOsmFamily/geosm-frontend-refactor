# 0003. OpenLayers plutot que Mapbox GL JS/Leaflet

Statut : Accepte
Date : 2026-08-08

## Contexte

La carte est le composant central de GeOSM. Le choix de la bibliotheque cartographique cote
client a des consequences durables : c'est une des dependances les plus difficiles a remplacer
une fois le projet construit dessus (des dizaines de composants dans `features/map` et
`features/layers` en dependent directement). Le backend expose des donnees principalement via
WMS/WFS (QGIS Server, voir `docs/architecture.md`) et des fonds de carte multi-type (XYZ, WMS,
WMTS - voir le modele `BaseMap` cote backend), pas uniquement des vector tiles au format
proprietaire d'un fournisseur.

## Decision

OpenLayers (`ol`) est la bibliotheque cartographique du projet - `TileWMS`, `XYZ`, `VectorLayer`
avec `Cluster`, dessin (`ol/interaction/Draw`), mesure, tout passe par son API native (voir
`features/map/helpers/map.helper.ts`, `features/map/services/map.service.ts`).

## Consequences

- Le support natif de WMS/WFS colle directement au backend QGIS Server sans couche
  d'adaptation - un fond de carte ou une couche WMS ajoutee cote admin (voir le modele
  `BaseMap`, type `WMS`) fonctionne immediatement cote carte sans transformation de format.
- OpenLayers ne demande aucune cle d'API ni jeton commercial pour fonctionner (contrairement a
  Mapbox GL JS, dont l'usage au-dela d'un certain volume est payant) - coherent avec le choix
  d'auto-hebergement du reste de la stack (voir les ADR cote backend sur Nominatim/OSRM/MinIO) :
  aucune fonctionnalite cartographique de base ne depend d'un compte tiers a payer.
- L'API d'OpenLayers est plus verbeuse que celles de Mapbox GL JS ou Leaflet pour des cas
  simples (une couche vectorielle demande explicitement une `Source` puis un `Layer`, un style
  separe...) - plus de code pour un meme resultat basique, en echange d'un controle plus fin
  quand le besoin est complexe (styles conditionnels par zoom, clustering, superposition
  raster/vecteur).
- Le rendu vectoriel par defaut d'OpenLayers est base Canvas 2D, pas WebGL comme Mapbox GL JS -
  suffisant pour les volumes de donnees actuels du projet, mais un jeu de donnees tres dense
  (des centaines de milliers d'entites simultanement visibles) beneficierait davantage d'un
  moteur de rendu WebGL - un plafond de performance a garder en tete si le projet grossit dans
  cette direction plutot qu'un probleme actuel.

## Alternatives envisagees

- **Mapbox GL JS** : rendu WebGL performant et style vector-tiles moderne, mais licence
  commerciale au-dela d'un certain volume d'usage et ecosysteme pense d'abord pour ses propres
  vector tiles hebergees - moins naturel pour un backend qui sert principalement du WMS/WFS
  auto-heberge.
- **Leaflet** : plus simple et leger pour des cas basiques, mais support WMS/WFS moins complet
  nativement (necessite des plugins tiers pour certains besoins couverts nativement par
  OpenLayers) et ecosysteme de plugins moins maintenu que le coeur d'OpenLayers pour les besoins
  SIG avances du projet (dessin, mesure, analyse spatiale interactive).
