# Image de developpement (VS Code Dev Containers / GitHub Codespaces) - distincte du Dockerfile
# de production a la racine du depot (qui build vers une image nginx minimale). Ici on garde
# toutes les devDependencies et les outils utiles a un contributeur.
FROM node:26-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Pas d'installation manuelle de Chrome ici : `npm ci` declenche deja le telechargement du
# Chromium de Puppeteer (utilise par scripts/generate-guide.mjs ET auto-detecte par
# karma-chrome-launcher pour les tests unitaires, voir karma.conf.js) - `npx playwright install
# --with-deps chromium` (voir devcontainer.json, postCreateCommand) installe ensuite le
# Chromium dedie de Playwright ainsi que les bibliotheques systeme partagees necessaires pour
# executer un navigateur headless dans les deux cas.

# Tourne en root (pas de USER dedie) : conteneur jetable et local a chaque contributeur, jamais
# expose - simplifie les permissions sur le bind mount du depot.
