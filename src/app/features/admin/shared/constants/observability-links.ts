export interface ObservabilityLink {
  key: string;
  url: string;
  icon: string;
}

/** Liens externes vers les outils de supervision déjà déployés (docker-compose.yml). */
export const OBSERVABILITY_LINKS: ObservabilityLink[] = [
  { key: 'grafana', url: 'http://localhost:3001', icon: 'dashboard' },
  { key: 'prometheus', url: 'http://localhost:9090', icon: 'query_stats' },
  { key: 'jaeger', url: 'http://localhost:16686', icon: 'timeline' },
  { key: 'graylog', url: 'http://localhost:9009', icon: 'description' },
];
