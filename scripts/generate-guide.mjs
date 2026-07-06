// Génère les guides PDF GeOSM (fr/en) à partir d'un gabarit HTML statique - PAS à la demande
// par requête HTTP, le contenu est de la documentation, pas des données dynamiques. À relancer
// manuellement après une mise à jour du contenu (voir scripts/guide-pdf/content.mjs), ou
// automatiquement en CI/CD avant un déploiement.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer';
import { buildHtml } from './guide-pdf/content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = join(__dirname, 'guide-pdf', 'template.html');
const outputDir = join(__dirname, '..', 'src', 'assets', 'docs');

async function generate() {
  const template = readFileSync(templatePath, 'utf8');
  mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  try {
    for (const lang of ['fr', 'en']) {
      const html = buildHtml(template, lang);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const outputPath = join(outputDir, `geosm-guide-${lang}.pdf`);
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate: '<div style="font-size:8px; width:100%; text-align:center; color:#94a3b8;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        headerTemplate: '<div></div>',
        margin: { top: '10mm', bottom: '14mm', left: '0mm', right: '0mm' },
      });
      await page.close();
      console.log(`Generated ${outputPath}`);
    }
  } finally {
    await browser.close();
  }
}

generate().catch((err) => {
  console.error('Guide PDF generation failed:', err);
  process.exitCode = 1;
});
