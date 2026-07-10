import { environment } from '../../../../../environments/environment';

export interface ObservabilityLink {
  key: string;
  url: string;
  icon: string;
}

/**
 * Liens externes vers les outils de supervision déjà déployés (docker-compose.yml). Les URL
 * viennent de `environment.observabilityLinks` (localhost en dev, sous-domaines publics en
 * prod - voir docs/deploiement.md côté backend) plutôt que d'être codées en dur ici, pour ne
 * pas exposer des ports internes dans le build de production.
 */
export const OBSERVABILITY_LINKS: ObservabilityLink[] = [
  { key: 'grafana', url: environment.observabilityLinks.grafana, icon: 'dashboard' },
  { key: 'prometheus', url: environment.observabilityLinks.prometheus, icon: 'query_stats' },
  { key: 'jaeger', url: environment.observabilityLinks.jaeger, icon: 'timeline' },
  { key: 'graylog', url: environment.observabilityLinks.graylog, icon: 'description' },
];
