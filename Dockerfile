# Stage 1: Build
FROM node:26-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# Injecte le vrai token Mapillary à la place du placeholder committé (voir environment.prod.ts -
# un vrai token était committé en clair avant ce lot, jamais faire ça pour un secret). Monté via
# BuildKit --mount=type=secret (jamais un ARG) : un ARG classique reste lisible en clair dans
# l'historique de l'image (`docker history`) même après ce RUN - le mount secret n'existe que
# le temps de cette seule commande, jamais persisté dans un layer. Sans secret fourni, le
# placeholder reste inoffensif (aucune occurrence à remplacer, l'app tourne juste sans Mapillary).
#
# CACHEBUST : Docker (et le cache GitHub Actions, cache-from/cache-to: type=gha en CI) met en
# cache les layers RUN par le TEXTE de la commande, PAS par le contenu du secret monté (choix
# volontaire de BuildKit, pour ne jamais faire fuiter un hash de secret dans les métadonnées de
# cache). Résultat vécu en production le 2026-07-09 : un premier build sans le secret configuré
# (ou avec un secret vide) a mis ce layer en cache avec le placeholder toujours présent ; des
# builds ultérieurs, même après avoir correctement configuré MAPILLARY_TOKEN sur GitHub,
# réutilisaient ce même layer en cache car rien d'autre dans le Dockerfile ne changeait pour
# l'invalider - le vrai token n'était donc jamais réellement injecté, silencieusement. Cet ARG
# (rempli avec un horodatage unique par deploy.yml à chaque run CI) force ce layer précis à être
# toujours recalculé, sans affecter la mise en cache légitime des étapes précédentes (npm ci,
# ng build).
ARG CACHEBUST=1
RUN --mount=type=secret,id=mapillary_token \
    echo "cachebust=${CACHEBUST}" > /dev/null && \
    if [ -s /run/secrets/mapillary_token ]; then \
      MAPILLARY_TOKEN="$(cat /run/secrets/mapillary_token)" node -e " \
        const fs = require('fs'); \
        const path = require('path'); \
        const dir = 'dist/geosm-frontend/browser'; \
        const token = process.env.MAPILLARY_TOKEN; \
        for (const file of fs.readdirSync(dir)) { \
          const full = path.join(dir, file); \
          if (!fs.statSync(full).isFile()) continue; \
          const content = fs.readFileSync(full, 'utf8'); \
          if (content.includes('__MAPILLARY_TOKEN__')) { \
            fs.writeFileSync(full, content.split('__MAPILLARY_TOKEN__').join(token)); \
          } \
        } \
      "; \
    fi

# Stage 2: Serve with nginx
FROM nginx:1.31-alpine AS production

# Applique les correctifs de sécurité Alpine publiés après la construction de l'image de base
# (ex. CVE-2026-31789 sur libssl3/libcrypto3), sans quoi le scan Trivy du workflow Sécurité
# échoue sur des CVE CRITICAL déjà corrigées en amont.
RUN apk update && apk upgrade --no-cache

COPY --from=builder /app/dist/geosm-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx:alpine tourne en root par défaut - on bascule sur l'utilisateur non-privilégié déjà
# créé par l'image de base (nginx:nginx), et on ajuste les permissions des répertoires que
# nginx doit pouvoir écrire (cache, pid) en tant que cet utilisateur.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
