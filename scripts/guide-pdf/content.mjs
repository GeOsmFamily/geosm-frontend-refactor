// Contenu complet (fr/en) du guide d'utilisation GeOSM - Lot P8. Chaque section reprend les
// fonctionnalites reellement implementees (voir docs/fonctionnalites-detaillees.md cote backend
// pour le detail technique), avec une explication orientee utilisateur et un exemple concret.

const sections = {
  fr: [
    {
      title: '1. Carte et navigation',
      items: [
        { h3: 'Vue interactive de la carte', body: 'GeOSM affiche une carte interactive basée sur OpenLayers, avec navigation fluide à la souris, au trackpad ou au doigt (zoom, déplacement, rotation). La position et le niveau de zoom courants sont conservés lorsque vous changez d\'outil, pour ne jamais perdre le fil de votre exploration.', useCase: 'Vous explorez le quartier de Bastos à Yaoundé en zoomant progressivement depuis la vue du pays jusqu\'au niveau de la rue, sans jamais recharger la page.' },
        { h3: 'Historique de navigation', body: 'Comme dans un navigateur web, GeOSM conserve un historique des positions et niveaux de zoom visités. Les boutons « précédent » et « suivant » de la barre d\'outils permettent de revenir rapidement à une vue explorée plus tôt sans avoir à la retrouver manuellement.', useCase: 'Après avoir zoomé sur trois villes différentes pour comparer leurs infrastructures scolaires, vous revenez en un clic à la première vue grâce au bouton précédent.' },
        { h3: 'Menu contextuel (clic droit)', body: 'Un clic droit (ou appui long sur mobile) n\'importe où sur la carte ouvre un menu contextuel proposant les actions disponibles à cet endroit précis : copier les coordonnées, centrer la vue, lancer une mesure, créer un géosignet, etc.', useCase: 'Vous faites un clic droit sur un croisement pour en copier immédiatement les coordonnées GPS et les transmettre par message à un collègue sur le terrain.' },
        { h3: 'Zoom vers des coordonnées GPS', body: 'Si vous connaissez déjà les coordonnées exactes d\'un lieu (par exemple relevées avec un GPS de terrain), vous pouvez les saisir directement pour que la carte s\'y centre et y zoome instantanément, sans passer par une recherche par nom.', useCase: 'Un agent de terrain reçoit par SMS les coordonnées « 3.8480, 11.5021 » et les saisit directement pour localiser le point exact sur la carte.' },
        { h3: 'Géosignets (positions sauvegardées)', body: 'Un géosignet enregistre une position de carte (centre et niveau de zoom) sous un nom de votre choix, pour y revenir en un clic depuis n\'importe quelle session future, sans devoir renaviguer ni rechercher le lieu à nouveau.', useCase: 'Vous consultez régulièrement le quartier de Bonapriso : vous l\'enregistrez comme géosignet « Bonapriso » et le retrouvez instantanément à chaque connexion.' },
        { h3: 'Mes cartes (compositions de couches)', body: '« Mes cartes » permet d\'enregistrer une combinaison précise de couches actives (avec leur opacité et leur ordre) sous un nom, pour la retrouver et la réactiver d\'un seul coup plus tard, au lieu de réactiver chaque couche une par une.', useCase: 'Vous composez une carte « Infrastructures scolaires » combinant écoles, collèges et universités, que vous rappelez d\'un clic à chaque réunion de suivi.' },
        { h3: 'Paramètres de la carte', body: 'Le panneau Paramètres regroupe les préférences d\'affichage de la carte : langue de l\'interface (français, anglais, espagnol), unités de mesure, et autres options qui s\'appliquent immédiatement sans rechargement de page.', useCase: 'Un utilisateur anglophone bascule l\'interface en anglais depuis le panneau Paramètres en une seule action.' },
        { h3: 'Comparaison de cartes par balayage', body: 'L\'outil de comparaison par balayage superpose deux fonds de carte (par exemple une vue satellite récente et une vue plus ancienne) avec un curseur que vous glissez pour révéler progressivement l\'un ou l\'autre, utile pour observer une évolution du terrain.', useCase: 'Vous comparez une image satellite de 2015 et une de 2024 pour visualiser l\'extension urbaine d\'un quartier de Douala.' },
        { h3: 'Fiche descriptive et popup d\'information', body: 'En cliquant sur un objet de la carte, une popup affiche ses informations principales ; un bouton « en savoir plus » ouvre une fiche descriptive enrichie avec des liens vers Wikipedia, Wikidata et la fiche OpenStreetMap correspondante lorsqu\'ils existent.', useCase: 'Vous cliquez sur un monument historique et accédez directement à sa page Wikipedia pour en apprendre davantage sur son histoire.' },
      ],
    },
    {
      title: '2. Recherche et découverte',
      items: [
        { h3: 'Recherche géographique (Nominatim)', body: 'La barre de recherche permet de trouver une adresse, un lieu-dit ou un point d\'intérêt par son nom, grâce au moteur de géocodage Nominatim. La carte se centre automatiquement sur le premier résultat pertinent.', useCase: 'Vous tapez « Marché Central Yaoundé » dans la barre de recherche et la carte se centre immédiatement sur son emplacement exact.' },
        { h3: 'Suggestions personnalisées', body: 'Dès l\'ouverture de la carte, GeOSM propose une liste de couches suggérées, calculée à partir des couches les plus fréquemment activées par l\'ensemble des utilisateurs de l\'instance, pour vous faire gagner du temps sans avoir à parcourir tout le catalogue.', useCase: 'À l\'ouverture de la carte du Cameroun, vous voyez immédiatement suggérées « Hôpitaux », « Écoles » et « Routes principales », les couches les plus consultées.' },
        { h3: 'Catalogue hiérarchique de couches', body: 'Le catalogue organise l\'ensemble des couches disponibles en une arborescence Groupes > Sous-groupes > Couches (par exemple Santé > Hôpitaux), pour naviguer facilement même lorsque des dizaines de couches sont disponibles.', useCase: 'Vous cherchez les données de transport : vous dépliez le groupe « Transport » puis le sous-groupe « Routes » pour trouver la couche exacte recherchée.' },
        { h3: 'Couches actives (opacité, vue chaleur, resynchronisation)', body: 'Une fois une couche activée, un panneau dédié permet d\'ajuster son opacité, de basculer vers une représentation en carte de chaleur pour visualiser les concentrations, et de la resynchroniser si les données sources ont été mises à jour côté administration.', useCase: 'Vous réduisez l\'opacité de la couche « Limites administratives » à 40 % pour mieux voir le fond satellite en dessous, puis basculez la couche « Hôpitaux » en vue chaleur pour repérer les zones sous-équipées.' },
        { h3: 'Changement de fond de carte', body: 'Le sélecteur de fonds de carte permet de basculer entre plusieurs styles de fond (plan classique, satellite, relief...) sans perdre les couches actives ni la position courante.', useCase: 'Vous passez du fond « Plan » au fond « Satellite » pour vérifier visuellement si une route tracée correspond bien à une voie existante.' },
        { h3: 'Légende', body: 'La légende affiche, pour chaque couche active, la signification des couleurs, symboles et icônes utilisés, se mettant à jour automatiquement à mesure que vous activez ou désactivez des couches.', useCase: 'En activant la couche « Occupation du sol », vous consultez la légende pour comprendre ce que représente chaque teinte de vert affichée.' },
        { h3: 'Recommandations de couches (co-activation)', body: 'En complément des suggestions initiales, GeOSM propose des couches complémentaires à celles déjà actives, sur la base des combinaisons de couches fréquemment activées ensemble par les autres utilisateurs.', useCase: 'Vous activez la couche « Hôpitaux » et GeOSM vous propose « Pharmacies » et « Centres de santé », souvent consultées en complément.' },
      ],
    },
    {
      title: '3. Outils d\'analyse et de production',
      items: [
        { h3: 'Dessin (points, lignes, polygones)', body: 'L\'outil de dessin permet de tracer directement sur la carte des points, des lignes et des polygones, avec sauvegarde du dessin pour le retrouver plus tard ou le partager avec d\'autres utilisateurs de l\'instance.', useCase: 'Un responsable municipal dessine les contours des zones inondables de son quartier pour les partager avec son équipe technique.' },
        { h3: 'Mesure (distance et surface)', body: 'L\'outil de mesure calcule en temps réel la distance d\'un tracé ou la surface d\'un polygone dessiné directement sur la carte, sans avoir besoin de recourir à un logiciel SIG externe pour une estimation rapide.', useCase: 'Vous tracez le périmètre d\'une parcelle pour en estimer rapidement la surface avant une visite de terrain.' },
        { h3: 'Itinéraire (OSRM)', body: 'Le calcul d\'itinéraire s\'appuie sur le moteur OSRM pour proposer un trajet routier réel entre deux points, avec la distance, la durée estimée et le tracé affiché directement sur la carte.', useCase: 'Vous tracez un itinéraire de Douala à Yaoundé et obtenez une distance de 240 km, une durée estimée et le tracé complet sur la carte.' },
        { h3: 'Recherche du plus proche par distance routière réelle', body: 'Plutôt que de se baser sur la distance à vol d\'oiseau, cette recherche identifie l\'entité la plus proche (un hôpital, une école...) en tenant compte du réseau routier réel, ce qui évite les erreurs lorsque deux lieux proches géométriquement sont en réalité séparés par un obstacle.', useCase: 'Vous cliquez sur la carte pour savoir quel hôpital est réellement le plus proche en temps de trajet, alors que deux hôpitaux semblent à égale distance à vol d\'oiseau mais que l\'un est séparé par une rivière sans pont.' },
        { h3: 'Analyse spatiale (buffer, intersection, union, différence)', body: 'Le module d\'analyse spatiale permet de générer une zone tampon autour d\'un objet, ou de combiner plusieurs géométries par intersection, union ou différence, pour répondre à des questions d\'aménagement du territoire.', useCase: 'Un urbaniste crée une zone tampon de 500 m autour d\'une école pour identifier tous les bâtiments situés à proximité immédiate.' },
        { h3: 'Export multi-format', body: 'Les données d\'une couche peuvent être exportées dans plusieurs formats standards (dont Shapefile, GeoJSON) pour être réutilisées dans un logiciel SIG de bureau comme QGIS.', useCase: 'Un chercheur télécharge les données des écoles du Cameroun au format Shapefile pour les analyser dans QGIS Desktop.' },
        { h3: 'Impression', body: 'La fonction d\'impression génère une version imprimable de la vue actuelle de la carte, avec les couches actives, pour un usage hors ligne ou une inclusion dans un rapport.', useCase: 'Vous imprimez la vue actuelle montrant les écoles d\'un quartier pour l\'inclure dans un rapport papier destiné à une réunion communale.' },
        { h3: 'Plan de localisation PDF', body: 'Le plan de localisation génère un document PDF de mise en page professionnelle (format A4) centré sur un point choisi, avec titre, point de repère et contexte cartographique environnant, idéal pour se rendre sur un site précis sur le terrain.', useCase: 'Un agent terrain choisit un point sur la carte, saisit un titre et un point de repère, puis génère un plan de localisation A4 à imprimer pour se rendre sur site.' },
        { h3: 'Commentaires géolocalisés', body: 'Les commentaires permettent d\'épingler une remarque, un signalement ou une question directement sur un point de la carte ; chaque épingle ouvre un fil de discussion complet, avec possibilité de répondre et de marquer le sujet comme résolu.', useCase: 'Un éditeur répond à un signalement de nid-de-poule pour indiquer que la réparation est en cours, puis marque le commentaire comme résolu une fois les travaux terminés.' },
        { h3: 'Altimétrie', body: 'En cliquant sur la carte, GeOSM affiche l\'altitude du point sélectionné (à partir de données SRTM) ; pour un tracé, un profil altimétrique complet montre les variations de dénivelé tout au long du parcours.', useCase: 'Un ingénieur routier trace une route projetée et visualise les variations d\'altitude le long du tracé pour anticiper les zones de forte pente.' },
        { h3: 'Mapillary (vues panoramiques de rue)', body: 'L\'intégration Mapillary affiche, lorsqu\'elles existent, des photos panoramiques prises au niveau de la rue à l\'endroit sélectionné sur la carte, pour visualiser concrètement un lieu sans s\'y déplacer.', useCase: 'Avant de vous rendre sur site, vous consultez la vue Mapillary d\'un carrefour pour repérer visuellement les commerces environnants.' },
        { h3: 'Statistiques (dont statistiques narrées par l\'IA)', body: 'Chaque couche dispose d\'un panneau de statistiques (nombre d\'entités, répartition...) ; l\'assistant IA peut également transformer ces chiffres en une phrase narrative claire plutôt qu\'un simple tableau brut.', useCase: 'Vous activez la couche « Hôpitaux » et voyez s\'afficher : « Cette couche compte 342 hôpitaux répartis sur l\'ensemble du territoire, avec une concentration plus forte autour de Yaoundé et Douala. »' },
      ],
    },
    {
      title: '4. Assistant IA',
      items: [
        { h3: 'Requêtes en langage naturel', body: 'L\'assistant conversationnel comprend des questions posées en langage naturel (en français comme en anglais) concernant les données et fonctionnalités de la carte, sans nécessiter de connaître une syntaxe particulière.', useCase: 'Vous tapez « Combien d\'hôpitaux y a-t-il autour de Yaoundé ? » et obtenez une réponse directe en langage naturel.' },
        { h3: 'Actions sur la carte pilotées par l\'assistant', body: 'Au-delà de répondre, l\'assistant peut agir directement sur la carte (activer une couche, zoomer sur une zone, lancer une analyse spatiale) grâce au function-calling Gemini, transformant une conversation en une véritable télécommande de la carte.', useCase: 'Vous tapez « Montre-moi les hôpitaux à moins de 5 km du centre-ville et zoome dessus » ; l\'assistant active la couche Hôpitaux, lance une analyse de proximité, et zoome automatiquement sur le résultat.' },
        { h3: 'Plans de localisation rédigés via le chat', body: 'Depuis la conversation avec l\'assistant, il est possible de demander la création d\'un plan de localisation ; l\'IA peut également rédiger automatiquement la description et le point de repère lorsque vous ne fournissez que le titre et les coordonnées.', useCase: 'Un agent terrain pressé saisit juste un titre et des coordonnées, coche « Rédaction automatique », et laisse l\'IA proposer une description et un point de repère qu\'il corrige avant validation.' },
        { h3: 'Résumés et statistiques narrés', body: 'L\'assistant peut résumer en une phrase la vue actuelle de la carte ou les statistiques d\'une couche active, pratique pour un compte-rendu rapide sans avoir à interpréter soi-même des chiffres bruts.', useCase: 'Vous cliquez sur « Résumer la vue » après avoir navigué sur la carte et obtenez un paragraphe décrivant ce que vous regardez, utile pour un rapport rapide ou un partage par email.' },
        { h3: 'Historique de conversations', body: 'Chaque conversation avec l\'assistant est conservée et associée à votre compte utilisateur, pour reprendre un échange précédent ou vous y référer plus tard sans tout retaper.', useCase: 'Vous retrouvez, une semaine plus tard, l\'échange dans lequel l\'assistant vous avait aidé à localiser les écoles d\'un quartier précis.' },
      ],
    },
    {
      title: '5. Partage',
      items: [
        { h3: 'Partage sur les réseaux sociaux', body: 'Un bouton de partage permet de publier directement la vue actuelle de la carte sur les réseaux sociaux, pour diffuser rapidement une information géographique auprès d\'un large public.', useCase: 'Vous partagez sur les réseaux sociaux une vue montrant l\'avancement des travaux d\'une nouvelle route.' },
        { h3: 'Cartes partagées en lecture seule', body: 'Un lien de partage donne accès à une vue précise de la carte (couches actives, position) en lecture seule, consultable par n\'importe qui sans avoir besoin de créer un compte.', useCase: 'Vous partagez une vue montrant les écoles et hôpitaux de Yaoundé avec un collègue via un lien court, qu\'il consulte sans avoir à se connecter.' },
      ],
    },
    {
      title: '6. Gestion de compte',
      items: [
        { h3: 'Connexion classique (email/mot de passe)', body: 'La connexion par email et mot de passe reste disponible pour tout utilisateur, avec vérification d\'email à l\'inscription et procédure de réinitialisation de mot de passe en cas d\'oubli.', useCase: 'Vous vous connectez avec votre email professionnel et votre mot de passe pour accéder aux fonctionnalités d\'édition réservées aux éditeurs.' },
        { h3: 'Connexion en un clic via OpenStreetMap (OAuth 2.0)', body: 'Un contributeur OpenStreetMap déjà habitué à son compte osm.org peut se connecter en un clic via « Se connecter avec OpenStreetMap », sans créer de nouveau mot de passe ; un compte GeOSM local est automatiquement créé lors de la première connexion.', useCase: 'Un contributeur OSM clique sur « Se connecter avec OpenStreetMap » et accède immédiatement au géoportail sans passer par une inscription classique.' },
        { h3: 'Profil (dont profil OpenStreetMap lié)', body: 'Le panneau profil affiche vos informations personnelles et, si un compte OpenStreetMap est lié, son nom d\'affichage, sa date de création et son nombre de contributions, avec la possibilité de lier ou délier ce compte à tout moment.', useCase: 'Vous consultez votre profil pour vérifier depuis quand votre compte OpenStreetMap existe et combien de contributions y sont associées.' },
      ],
    },
    {
      title: '7. Administration',
      items: [
        { h3: 'Gestion des instances (pays)', body: 'Réservée aux comptes habilités, la gestion des instances permet de créer, configurer et administrer un déploiement GeOSM pour un pays donné, avec ses propres couches, utilisateurs et thématiques.', useCase: 'Le super administrateur déploie GeOSM pour un nouveau pays africain, le Togo, en définissant les coordonnées et les paramètres de l\'instance.' },
        { h3: 'Gestion des thématiques et couches', body: 'Les administrateurs et éditeurs peuvent créer et organiser des thématiques (groupes et sous-groupes), ainsi que créer, styliser et mettre à jour les couches de données qui y sont rattachées.', useCase: 'L\'éditeur crée une couche « Écoles primaires » de type point, rattachée au sous-groupe « Éducation primaire ».' },
        { h3: 'Gestion des utilisateurs et des rôles', body: 'Les comptes habilités peuvent créer des comptes utilisateurs sans passer par l\'inscription publique, et attribuer les rôles appropriés (Super Administrateur, Administrateur d\'instance, Éditeur, Visualisateur) selon les responsabilités de chacun.', useCase: 'Le super administrateur crée un compte pour un nouveau gestionnaire d\'instance et lui attribue le rôle Administrateur d\'instance.' },
      ],
    },
  ],
  en: [
    {
      title: '1. Map and navigation',
      items: [
        { h3: 'Interactive map view', body: 'GeOSM displays an interactive map built on OpenLayers, with smooth navigation via mouse, trackpad or touch (zoom, pan, rotate). The current position and zoom level are preserved when switching tools, so you never lose track of what you were exploring.', useCase: 'You explore the Bastos neighborhood in Yaoundé by progressively zooming in from the country view down to street level, without ever reloading the page.' },
        { h3: 'Navigation history', body: 'Just like a web browser, GeOSM keeps a history of visited positions and zoom levels. The toolbar\'s back and forward buttons let you quickly return to a previously explored view without having to find it again manually.', useCase: 'After zooming into three different cities to compare their school infrastructure, you return to the first view in one click using the back button.' },
        { h3: 'Context menu (right-click)', body: 'Right-clicking (or long-pressing on mobile) anywhere on the map opens a context menu with the actions available at that exact spot: copy coordinates, center the view, start a measurement, create a geosignet, and more.', useCase: 'You right-click on an intersection to instantly copy its GPS coordinates and send them to a colleague in the field.' },
        { h3: 'Zoom to GPS coordinates', body: 'If you already know the exact coordinates of a place (for example recorded with a field GPS unit), you can enter them directly so the map centers and zooms in instantly, without going through a name search.', useCase: 'A field agent receives the coordinates "3.8480, 11.5021" by text message and enters them directly to locate the exact point on the map.' },
        { h3: 'Geosignets (saved positions)', body: 'A geosignet saves a map position (center and zoom level) under a name of your choice, so you can return to it in one click from any future session, without having to navigate or search for the place again.', useCase: 'You regularly check the Bonapriso neighborhood: you save it as a "Bonapriso" geosignet and find it instantly on every visit.' },
        { h3: 'My Maps (layer compositions)', body: '"My Maps" lets you save a specific combination of active layers (with their opacity and order) under a name, so you can find and reactivate it in one action later, instead of turning on each layer one by one.', useCase: 'You build a "School infrastructure" map combining primary schools, colleges and universities, and recall it in one click at every follow-up meeting.' },
        { h3: 'Map settings', body: 'The Settings panel gathers the map\'s display preferences: interface language (French, English, Spanish), units of measurement, and other options that apply instantly without reloading the page.', useCase: 'An English-speaking user switches the interface to English from the Settings panel in a single action.' },
        { h3: 'Swipe map comparison', body: 'The swipe comparison tool overlays two base maps (for example a recent satellite view and an older one) with a slider you drag to progressively reveal one or the other, useful for observing changes in the terrain.', useCase: 'You compare a 2015 satellite image with a 2024 one to visualize urban expansion in a Douala neighborhood.' },
        { h3: 'Descriptive sheet and information popup', body: 'Clicking on a map object displays a popup with its main information; a "learn more" button opens an enriched descriptive sheet with links to Wikipedia, Wikidata and the corresponding OpenStreetMap entry when available.', useCase: 'You click on a historic landmark and go straight to its Wikipedia page to learn more about its history.' },
      ],
    },
    {
      title: '2. Search and discovery',
      items: [
        { h3: 'Geographic search (Nominatim)', body: 'The search bar lets you find an address, place name or point of interest by name, powered by the Nominatim geocoding engine. The map automatically centers on the first relevant result.', useCase: 'You type "Marché Central Yaoundé" into the search bar and the map immediately centers on its exact location.' },
        { h3: 'Personalized suggestions', body: 'As soon as the map opens, GeOSM proposes a list of suggested layers, computed from the layers most frequently activated by all users of the instance, saving you time browsing the whole catalog.', useCase: 'When opening the Cameroon map, you immediately see "Hospitals", "Schools" and "Main roads" suggested, the most consulted layers.' },
        { h3: 'Hierarchical layer catalog', body: 'The catalog organizes all available layers into a Groups > Sub-groups > Layers tree (for example Health > Hospitals), making it easy to navigate even when dozens of layers are available.', useCase: 'You\'re looking for transport data: you expand the "Transport" group then the "Roads" sub-group to find the exact layer you need.' },
        { h3: 'Active layers (opacity, heatmap, resync)', body: 'Once a layer is activated, a dedicated panel lets you adjust its opacity, switch to a heatmap representation to visualize concentrations, and resync it if the source data has been updated on the admin side.', useCase: 'You lower the opacity of the "Administrative boundaries" layer to 40% to better see the satellite base underneath, then switch the "Hospitals" layer to heatmap view to spot underserved areas.' },
        { h3: 'Base map switching', body: 'The base map selector lets you switch between several base styles (standard, satellite, terrain...) without losing active layers or the current position.', useCase: 'You switch from the "Standard" base map to "Satellite" to visually check whether a drawn road matches an existing track.' },
        { h3: 'Legend', body: 'The legend shows, for each active layer, the meaning of the colors, symbols and icons used, updating automatically as you activate or deactivate layers.', useCase: 'After activating the "Land use" layer, you check the legend to understand what each shade of green represents.' },
        { h3: 'Layer recommendations (co-activation)', body: 'In addition to the initial suggestions, GeOSM proposes complementary layers to the ones already active, based on layer combinations frequently activated together by other users.', useCase: 'You activate the "Hospitals" layer and GeOSM suggests "Pharmacies" and "Health centers", often consulted alongside it.' },
      ],
    },
    {
      title: '3. Analysis and production tools',
      items: [
        { h3: 'Drawing (points, lines, polygons)', body: 'The drawing tool lets you sketch points, lines and polygons directly on the map, with the drawing saved so you can find it later or share it with other users of the instance.', useCase: 'A municipal official draws the outlines of flood-prone areas in his neighborhood to share them with his technical team.' },
        { h3: 'Measurement (distance and area)', body: 'The measurement tool computes, in real time, the distance of a path or the area of a polygon drawn directly on the map, without needing an external GIS tool for a quick estimate.', useCase: 'You trace the boundary of a plot of land to quickly estimate its area before a field visit.' },
        { h3: 'Routing (OSRM)', body: 'Route calculation relies on the OSRM engine to propose a real road route between two points, with distance, estimated duration and the path displayed directly on the map.', useCase: 'You trace a route from Douala to Yaoundé and get a distance of 240 km, an estimated duration and the full path on the map.' },
        { h3: 'Nearest search by real road distance', body: 'Rather than relying on straight-line distance, this search finds the nearest entity (a hospital, a school...) accounting for the actual road network, avoiding errors when two geometrically close places are actually separated by an obstacle.', useCase: 'You click on the map to find out which hospital is actually closest by travel time, when two hospitals seem equidistant as the crow flies but one is separated by a river with no bridge.' },
        { h3: 'Spatial analysis (buffer, intersection, union, difference)', body: 'The spatial analysis module lets you generate a buffer zone around an object, or combine several geometries via intersection, union or difference, to answer land-use planning questions.', useCase: 'An urban planner creates a 500 m buffer zone around a school to identify all buildings in its immediate vicinity.' },
        { h3: 'Multi-format export', body: 'Layer data can be exported in several standard formats (including Shapefile and GeoJSON) for reuse in a desktop GIS tool like QGIS.', useCase: 'A researcher downloads Cameroon\'s school data in Shapefile format to analyze it in QGIS Desktop.' },
        { h3: 'Printing', body: 'The print function generates a printable version of the current map view, with active layers, for offline use or inclusion in a report.', useCase: 'You print the current view showing a neighborhood\'s schools for inclusion in a paper report for a community meeting.' },
        { h3: 'PDF location plan', body: 'The location plan generates a professionally laid-out PDF document (A4 format) centered on a chosen point, with a title, a landmark and the surrounding cartographic context, ideal for reaching a specific site in the field.', useCase: 'A field agent picks a point on the map, enters a title and a landmark, then generates an A4 location plan to print for reaching the site.' },
        { h3: 'Geolocated comments', body: 'Comments let you pin a remark, a report or a question directly to a point on the map; each pin opens a full discussion thread, with the ability to reply and mark the topic as resolved.', useCase: 'An editor replies to a pothole report to say that repairs are underway, then marks the comment as resolved once the work is done.' },
        { h3: 'Elevation', body: 'Clicking on the map shows the elevation of the selected point (from SRTM data); for a traced path, a full elevation profile shows the grade changes along the route.', useCase: 'A road engineer traces a planned road and views the elevation changes along the route to anticipate steep sections.' },
        { h3: 'Mapillary (street-level imagery)', body: 'The Mapillary integration displays, where available, street-level panoramic photos at the selected map location, to get a concrete view of a place without traveling there.', useCase: 'Before heading to a site, you check the Mapillary view of an intersection to spot the surrounding shops.' },
        { h3: 'Statistics (including AI-narrated statistics)', body: 'Every layer has a statistics panel (entity count, distribution...); the AI assistant can also turn these figures into a clear narrative sentence rather than a plain raw table.', useCase: 'You activate the "Hospitals" layer and see: "This layer counts 342 hospitals spread across the territory, with a stronger concentration around Yaoundé and Douala."' },
      ],
    },
    {
      title: '4. AI Assistant',
      items: [
        { h3: 'Natural language queries', body: 'The conversational assistant understands questions asked in natural language (in both French and English) about the map\'s data and features, without requiring you to know any particular syntax.', useCase: 'You type "How many hospitals are there around Yaoundé?" and get a direct answer in natural language.' },
        { h3: 'Assistant-driven map actions', body: 'Beyond answering, the assistant can act directly on the map (activate a layer, zoom to an area, run a spatial analysis) thanks to Gemini function-calling, turning a conversation into a real remote control for the map.', useCase: 'You type "Show me the hospitals within 5 km of downtown and zoom in"; the assistant activates the Hospitals layer, runs a proximity analysis, and automatically zooms to the result.' },
        { h3: 'Location plans drafted via chat', body: 'From the conversation with the assistant, you can request the creation of a location plan; the AI can also automatically draft the description and landmark when you only provide the title and coordinates.', useCase: 'A field agent in a hurry enters just a title and coordinates, checks "Auto-draft", and lets the AI propose a description and landmark that he corrects before submitting.' },
        { h3: 'Narrated summaries and statistics', body: 'The assistant can summarize the current map view or a layer\'s statistics in a single sentence, handy for a quick report without having to interpret raw figures yourself.', useCase: 'You click "Summarize view" after navigating the map and get a paragraph describing what you\'re looking at, useful for a quick report or an email.' },
        { h3: 'Conversation history', body: 'Every conversation with the assistant is kept and linked to your user account, so you can resume a previous exchange or refer back to it later without retyping everything.', useCase: 'A week later, you find the exchange in which the assistant helped you locate schools in a specific neighborhood.' },
      ],
    },
    {
      title: '5. Sharing',
      items: [
        { h3: 'Social media sharing', body: 'A share button lets you publish the current map view directly to social media, to quickly spread geographic information to a wide audience.', useCase: 'You share a view showing the progress of new road works on social media.' },
        { h3: 'Read-only shared maps', body: 'A share link gives access to a specific map view (active layers, position) in read-only mode, viewable by anyone without needing to create an account.', useCase: 'You share a view showing Yaoundé\'s schools and hospitals with a colleague via a short link, which he views without needing to log in.' },
      ],
    },
    {
      title: '6. Account management',
      items: [
        { h3: 'Classic login (email/password)', body: 'Email and password login remains available to every user, with email verification at sign-up and a password reset procedure in case of a forgotten password.', useCase: 'You log in with your work email and password to access editing features reserved for editors.' },
        { h3: 'One-click login via OpenStreetMap (OAuth 2.0)', body: 'An OpenStreetMap contributor already used to their osm.org account can log in with one click via "Log in with OpenStreetMap", without creating a new password; a local GeOSM account is automatically created on first login.', useCase: 'An OSM contributor clicks "Log in with OpenStreetMap" and immediately accesses the geoportal without going through a classic sign-up.' },
        { h3: 'Profile (including linked OpenStreetMap profile)', body: 'The profile panel shows your personal information and, if an OpenStreetMap account is linked, its display name, creation date and number of contributions, with the ability to link or unlink this account at any time.', useCase: 'You check your profile to see how long your OpenStreetMap account has existed and how many contributions are linked to it.' },
      ],
    },
    {
      title: '7. Administration',
      items: [
        { h3: 'Instance (country) management', body: 'Restricted to authorized accounts, instance management lets you create, configure and administer a GeOSM deployment for a given country, with its own layers, users and themes.', useCase: 'The super administrator deploys GeOSM for a new African country, Togo, by defining its coordinates and instance settings.' },
        { h3: 'Theme and layer management', body: 'Administrators and editors can create and organize themes (groups and sub-groups), as well as create, style and update the data layers attached to them.', useCase: 'The editor creates a "Primary schools" point layer, attached to the "Primary education" sub-group.' },
        { h3: 'User and role management', body: 'Authorized accounts can create user accounts without going through public sign-up, and assign the appropriate role (Super Administrator, Instance Administrator, Editor, Viewer) according to each person\'s responsibilities.', useCase: 'The super administrator creates an account for a new instance manager and assigns them the Instance Administrator role.' },
      ],
    },
  ],
};

const strings = {
  fr: {
    subtitle: 'Guide complet d\'utilisation',
    meta: `Version 1.0 — ${new Date().toLocaleDateString('fr-FR')}`,
    tocTitle: 'Table des matières',
  },
  en: {
    subtitle: 'Complete user guide',
    meta: `Version 1.0 — ${new Date().toLocaleDateString('en-US')}`,
    tocTitle: 'Table of contents',
  },
};

export function buildHtml(template, lang) {
  const langSections = sections[lang] ?? sections.fr;
  const langStrings = strings[lang] ?? strings.fr;

  const tocItems = langSections.map((s) => `<li>${s.title}</li>`).join('\n');
  const content = langSections
    .map((s) => {
      const items = s.items
        .map(
          (item) =>
            `<h3>${item.h3}</h3><p>${item.body}</p><div class="use-case"><strong>${lang === 'en' ? 'Example' : 'Exemple'} :</strong> ${item.useCase}</div>`,
        )
        .join('\n');
      return `<h2>${s.title}</h2>${items}`;
    })
    .join('\n');

  return template
    .replace('{{LANG}}', lang)
    .replace('{{SUBTITLE}}', langStrings.subtitle)
    .replace('{{META}}', langStrings.meta)
    .replace('{{TOC_TITLE}}', langStrings.tocTitle)
    .replace('{{TOC_ITEMS}}', tocItems)
    .replace('{{CONTENT}}', content);
}
