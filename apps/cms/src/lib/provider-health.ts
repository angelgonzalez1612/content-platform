import type { ProviderHealth } from "./automation-types";

export const AI_PROVIDER_LABEL: Record<ProviderHealth["provider"], string> = {
  openai: "OpenAI",
  "claude-cli": "Claude",
  "codex-cli": "Codex",
};

/** Proveedores con problema, "sin tokens" primero (es lo más accionable). */
export function unhealthyProviders(health: ProviderHealth[] | undefined): ProviderHealth[] {
  return (health ?? [])
    .filter((h) => h.state !== "ok")
    .sort((a, b) => (a.state === b.state ? 0 : a.state === "sin-tokens" ? -1 : 1));
}

function formatSince(iso: string | null): string {
  if (!iso) return "";
  return ` desde las ${new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Texto corto (pill del topbar) y largo (avisos) para un proveedor con problema. */
export function describeProviderHealth(h: ProviderHealth): { short: string; long: string } {
  const label = AI_PROVIDER_LABEL[h.provider];
  if (h.state === "sin-tokens") {
    return {
      short: `${label} sin tokens`,
      long: `${label} se quedó sin tokens${formatSince(h.since)}. Las automatizaciones que lo usan se detienen hasta que se renueve el límite de la cuenta o cambies el proveedor predeterminado en Configuración.`,
    };
  }
  return {
    short: `${label} no está generando`,
    long: `${label} lleva ${h.consecutiveFailures} errores seguidos${formatSince(h.since)} y no está generando. Prueba la conexión en Configuración.`,
  };
}
