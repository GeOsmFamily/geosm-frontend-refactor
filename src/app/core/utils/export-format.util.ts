/**
 * Extension de fichier réelle par format d'export - ne correspond pas toujours
 * au nom du format lui-même (GEOPACKAGE -> .gpkg, SHAPEFILE -> .zip car un
 * shapefile n'est valide qu'accompagné de ses fichiers .shx/.dbf/.prj, livrés
 * groupés dans un zip par le backend).
 */
const FORMAT_EXTENSIONS: Record<string, string> = {
  GEOJSON: 'geojson',
  KML: 'kml',
  GEOPACKAGE: 'gpkg',
  SHAPEFILE: 'zip',
  CSV: 'csv',
};

export function getExportFileExtension(format: string): string {
  return FORMAT_EXTENSIONS[(format || '').toUpperCase()] || (format || '').toLowerCase();
}
