// Génère src/assets/version.json à chaque build (voir "build" dans package.json) - affiché
// dans le panneau Infos. Le nom de code est tiré du catalogue en fonction de (major, minor) -
// change donc sur une version majeure OU mineure (jamais sur un simple build), et reste
// stable d'un build à l'autre pour une même version (voir hashSeed ci-dessous : même entrée
// "major.minor" => même nom, pas un vrai Math.random() qui changerait à chaque exécution du
// script sans qu'aucune version n'ait bougé). Mois/année figent la date de compilation (donc
// de mise en production), pas la date de consultation - les recalculer côté navigateur
// donnerait un mois différent de la vraie date de sortie pour tout visiteur consultant l'app
// après le mois du déploiement.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const [major, minor] = pkg.version.split('.').map(Number);

// Catalogue de noms de code (voir demande du 2026-08-06) - un seul tableau à plat dans l'ordre
// des thématiques fournies ; l'index utilisé est tiré (voir hashSeed) à partir de "major.minor".
const CODENAMES = [
  // 🌍 Géographie & Reliefs
  'Atlas',
  'Terra',
  'Horizon',
  'Meridian',
  'Equator',
  'Zenith',
  'Nadir',
  'Delta',
  'Plateau',
  'Canyon',
  'Summit',
  'Ridge',
  'Valley',
  'Glacier',
  'Volcano',
  'Lagoon',
  'Oasis',
  'Fjord',
  'Tundra',
  'Savannah',
  'Prairie',
  'Steppe',
  'Mesa',
  'Dune',
  'Reef',
  'Archipelago',
  'Peninsula',
  'Isthmus',
  'Basin',
  'Highland',
  'Lowland',
  'Monsoon',

  // 🗺️ Cartographie & SIG
  'Compass',
  'Waypoint',
  'Beacon',
  'NorthStar',
  'Grid',
  'Tile',
  'Raster',
  'Vector',
  'Contour',
  'Surveyor',
  'Cartographer',
  'Navigator',
  'Geodesy',
  'Topography',
  'Elevation',
  'Relief',
  'Azimuth',
  'Bearing',
  'Projection',
  'Datum',
  'Traverse',
  'Locator',
  'AtlasGrid',
  'Mapline',
  'WaypointX',

  // 🛰️ Spatial & Observation
  'Orbit',
  'Apollo',
  'Aurora',
  'Cosmos',
  'Nova',
  'Pioneer',
  'Voyager',
  'Sentinel',
  'Explorer',
  'Odyssey',
  'Helios',
  'Lunar',
  'Solaris',
  'Polaris',
  'Orion',
  'Phoenix',
  'Hubble',
  'Gaia',
  'Copernicus',
  'Skylab',
  'Zen',

  // 🌎 Explorateurs & Scientifiques
  'Magellan',
  'Mercator',
  'Ortelius',
  'Kepler',
  'Galileo',
  'Copernicus',
  'Ptolemy',
  'Amundsen',
  'Shackleton',
  'Livingstone',
  'Humboldt',
  'Cook',
  'Drake',
  'Ross',
  'Nansen',

  // 🌿 Nature
  'Baobab',
  'Sequoia',
  'Cedar',
  'Cypress',
  'Redwood',
  'Mangrove',
  'Amazonia',
  'Okavango',
  'Serengeti',
  'Sahara',
  'Kalahari',
  'Namib',
  'Everest',
  'Kilimanjaro',
  'Denali',
  'Andes',
  'Himalaya',
  'Alps',
  'Pyrenees',
  'Rockies',
  'AtlasMount',
  'Nile',
  'Amazon',
  'Congo',
  'Zambezi',
  'Mekong',

  // 🌌 Concepts inspirants
  'Genesis',
  'Infinity',
  'Origin',
  'Frontier',
  'Nexus',
  'Pulse',
  'Vertex',
  'Apex',
  'Pinnacle',
  'VertexOne',
  'GenesisX',
  'Momentum',
  'Catalyst',
  'Eclipse',
  'AuroraX',
  'OdysseyX',
  'Quantum',
  'VertexPrime',
  'HorizonX',
  'NovaPrime'
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function buildNumber() {
  // En CI (GitHub Actions), GITHUB_RUN_NUMBER s'incrémente automatiquement à chaque exécution
  // du workflow - source de vérité pour "quand j'ai fait la mise à jour", sans compteur à
  // maintenir à la main. En local (pas de CI), repli sur le nombre de commits, pour ne jamais
  // laisser un build à 0.
  if (process.env.GITHUB_RUN_NUMBER) return Number(process.env.GITHUB_RUN_NUMBER);
  try {
    return Number(execSync('git rev-list --count HEAD', { cwd: rootDir }).toString().trim());
  } catch {
    return 0;
  }
}

// Hash déterministe (djb2) - donne un index qui a l'air tiré au hasard dans le catalogue (pas
// un simple compteur séquentiel) tout en restant 100% reproductible : une même paire
// major.minor retombe toujours sur le même nom, d'un build à l'autre.
function hashSeed(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.codePointAt(i);
  }
  return hash >>> 0;
}

const now = new Date();
const codename = CODENAMES[hashSeed(`${major}.${minor}`) % CODENAMES.length];
const build = buildNumber();
const month = MONTHS[now.getUTCMonth()];
const year = now.getUTCFullYear();

const version = {
  major,
  minor,
  build,
  codename,
  month,
  year,
  full: `GeOsm ${major}.${minor}.${build} - ${codename}.${month}.${year}`,
};

const outDir = join(rootDir, 'src', 'assets');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'version.json'), JSON.stringify(version, null, 2) + '\n');
console.log('Generated version.json:', version.full);
