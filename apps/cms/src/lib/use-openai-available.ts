"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";

/**
 * `null` mientras carga, luego `true`/`false` según haya una API key de
 * OpenAI configurada (Configuración → Inteligencia Artificial, o el
 * `OPENAI_API_KEY` del `.env` como respaldo — ver AiSettingsService en la
 * API). Los selectores de "Proveedor de IA" la usan para no ofrecer OpenAI
 * cuando la llamada fallaría por falta de key.
 */
export function useOpenAiAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.baseUrl}/cms/settings/ai`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { openaiApiKeySet: false }))
      .then((data: { openaiApiKeySet?: boolean }) => {
        if (!cancelled) setAvailable(!!data.openaiApiKeySet);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
