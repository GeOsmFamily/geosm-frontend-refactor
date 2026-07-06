import { test, expect } from '@playwright/test';

/**
 * Suite E2E de l'authentification, contre l'app réelle servie par `ng serve` (voir
 * playwright.config.ts), avec le backend mocké via l'interception réseau Playwright plutôt
 * qu'une stack docker-compose complète - déterministe et rapide en CI, sans dépendre d'une
 * vraie base de données/API déployée. L'URL absolue mockée doit matcher environment.apiUrl
 * (http://localhost:3005/api/v1) puisque ApiService construit ses requêtes en absolu.
 */

const API_BASE = 'http://localhost:3005/api/v1';

test.beforeEach(async ({ page }) => {
  // Filet de sécurité en premier (moins prioritaire - Playwright teste les routes en LIFO,
  // donc les mocks plus spécifiques enregistrés après dans chaque test prennent le dessus) :
  // évite toute fuite vers un vrai backend qui tournerait en local sur ce port pendant les
  // tests (ex. docker-compose de dev), ce qui rendrait la suite non déterministe (un token
  // factice y renverrait 401, déclenchant le refresh-token puis le logout automatique de
  // l'interceptor d'erreurs, et ferait échouer des tests sans rapport avec l'authentification).
  await page.route(`${API_BASE}/**`, (route) => route.fulfill({ json: { success: true, data: null } }));
  // Toujours mocké : ngOnInit du login appelle getOsmStatus() indépendamment du scénario testé.
  await page.route(`${API_BASE}/auth/osm/status`, (route) =>
    route.fulfill({ json: { success: true, data: { configured: false } } }),
  );
});

test.describe('Login', () => {
  test('redirects an unauthenticated visitor from a protected route to /login', async ({ page }) => {
    await page.goto('/map');
    await expect(page).toHaveURL(/\/login/);
  });

  test('renders the login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('shows a validation message when submitting without credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('logs in successfully and redirects to /map', async ({ page }) => {
    await page.route(`${API_BASE}/auth/login`, (route) =>
      route.fulfill({
        json: { success: true, data: { accessToken: 'e2e-access-token', refreshToken: 'e2e-refresh-token' } },
      }),
    );
    // Le layout de la carte charge des instances au montage - mocké en vide pour un rendu
    // stable, ce test se concentre sur le flux de connexion, pas sur la carte elle-même.
    await page.route(`${API_BASE}/instances*`, (route) =>
      route.fulfill({ json: { success: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } }),
    );

    await page.goto('/login');
    await page.locator('input[name="email"]').fill('admin@geosm.org');
    await page.locator('input[name="password"]').fill('AdminP@ssw0rd!');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/map/);
  });

  test('shows the server error message on invalid credentials', async ({ page }) => {
    // Forme réelle de l'enveloppe d'erreur backend : {success:false, error:{code, message}} -
    // voir le correctif de login.component.ts (lisait err.error.message au lieu de
    // err.error.error.message, affichant toujours le message générique de repli).
    await page.route(`${API_BASE}/auth/login`, (route) =>
      route.fulfill({
        status: 401,
        json: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
      }),
    );

    await page.goto('/login');
    await page.locator('input[name="email"]').fill('wrong@example.com');
    await page.locator('input[name="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
    await expect(page).toHaveURL(/\/login/);
  });
});
