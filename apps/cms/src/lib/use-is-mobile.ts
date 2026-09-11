"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * true por debajo del breakpoint `md` de Tailwind (767px) — usado para que
 * el shell del CMS cambie de sidebar fija (desktop) a drawer con overlay
 * (celular) en vez de solo apoyarse en CSS, porque el sidebar ya tiene un
 * estado "colapsado" propio que en celular no aplica (ahí siempre se ve
 * expandido dentro del drawer).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
