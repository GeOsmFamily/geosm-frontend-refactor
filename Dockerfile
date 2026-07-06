# Stage 1: Build
FROM node:20-alpine AS builder

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
RUN --mount=type=secret,id=mapillary_token \
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
FROM nginx:1.27-alpine AS production

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
