"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";

type AiProviderId = "openai" | "claude-cli" | "codex-cli";

interface AiSettingsSnapshot {
  openaiAvailable: boolean;
  /** Predeterminado de Configuración (Codex si no hay uno guardado). */
  defaultProvider: AiProviderId;
}

/** `null` mientras carga. Una sola lectura de /cms/settings/ai por componente. */
export function useAiSettings(): AiSettingsSnapshot | null {
  const [settings, setSettings] = useState<AiSettingsSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.clientBaseUrl}/cms/settings/ai`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { openaiApiKeySet?: boolean; preferredProvider?: AiProviderId | null }) => {
        if (!cancelled) setSettings({ openaiAvailable: !!data.openaiApiKeySet, defaultProvider: data.preferredProvider ?? "codex-cli" });
      })
      .catch(() => {
        if (!cancelled) setSettings({ openaiAvailable: false, defaultProvider: "codex-cli" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}

/**
 * `null` mientras carga, luego `true`/`false` según haya una API key de
 * OpenAI configurada (Configuración → Inteligencia Artificial, o el
 * `OPENAI_API_KEY` del `.env` como respaldo — ver AiSettingsService en la
 * API). Los selectores de "Proveedor de IA" la usan para no ofrecer OpenAI
 * cuando la llamada fallaría por falta de key.
 */
export function useOpenAiAvailable(): boolean | null {
  const settings = useAiSettings();
  return settings ? settings.openaiAvailable : null;
}
