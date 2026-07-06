// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Baseline pragmatique à l'introduction d'ESLint sur ce projet (aucun linting n'existait
      // avant) : `any` est utilisé abondamment pour l'interop OpenLayers/API externes (Mapillary,
      // MeiliSearch...) - le repasser en `error` nécessiterait un audit type par type trop risqué
      // à faire en une passe. `warn` pour l'instant, à durcir progressivement fichier par fichier.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      // Convention standard : un paramètre préfixé `_` est délibérément inutilisé (ex:
      // signature conservée pour compat appelants), pas une inutilisation par oubli.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // *ngIf/*ngFor -> @if/@for est une vraie amélioration mais touche ~10 templates
      // existants (dont des *ngFor sans track à ajouter soigneusement) - à migrer
      // progressivement plutôt qu'en masse à l'introduction du linter.
      "@angular-eslint/template/prefer-control-flow": "warn",
      // Accessibilité clavier sur les éléments cliquables - vraie dette, mais corriger
      // correctement demande d'ajouter de vrais gestionnaires clavier (pas juste supprimer
      // l'avertissement), donc à traiter composant par composant plutôt qu'en masse ici.
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
    },
  }
]);
