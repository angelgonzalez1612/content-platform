import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // content-radar es workspace source (.ts sin build propio, igual que
  // @planazo/types) — sin esto Next no sabe transpilar su código real
  // (run.ts/render.ts sí ejecutan en runtime, a diferencia de los tipos).
  transpilePackages: ["@planazo/content-radar"],

  // El CMS y la API viven en dominios *.vercel.app distintos en
  // producción — vercel.app está en la lista de sufijos públicos, así que
  // un cookie de sesión puesto por la API nunca llega al navegador para el
  // dominio del CMS (las cookies se guardan por host, no por "sitio"), y
  // getSession() (que sí reenvía el cookie recibido) nunca recibe nada:
  // el login parecía funcionar pero cualquier página siguiente rebotaba a
  // /login. La solución es que el navegador SOLO hable con el propio
  // dominio del CMS — este rewrite hace de proxy transparente hacia la API
  // real, así el Set-Cookie de /auth/login llega como si fuera del mismo
  // origen. apiConfig.clientBaseUrl ("/api") es lo que usan los
  // componentes de cliente; apiConfig.baseUrl (URL absoluta) lo sigue
  // usando el código de servidor (auth.ts, cms-api.ts), que al ser
  // servidor-a-servidor no tiene este problema.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*` }];
  },
};

export default nextConfig;
