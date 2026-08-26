try {
  process.loadEnvFile();
} catch {
  // sin .env es válido — YouTube simplemente no aparece en el reporte
}

import { runAndSave } from "./run";
import { DEFAULT_SITE_ID, SITES } from "./sites";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = { geo: "MX", site: DEFAULT_SITE_ID };
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key && value) opts[key] = value;
  }
  return opts;
}

async function main() {
  const { geo, site } = parseArgs();

  if (!SITES[site]) {
    console.error(`Sitio desconocido: "${site}". Sitios válidos: ${Object.keys(SITES).join(", ")}`);
    process.exit(1);
  }

  console.log(`Consultando Google Trends (Trending Now) + Google News CDMX para site=${site} geo=${geo}...`);

  const { report, file } = await runAndSave(site, geo);
  console.log(report);
  console.log(`\nReporte guardado en ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
