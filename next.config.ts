import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cambiamos a false para estandarizar rutas y evitar 404 por redirecciones de barra
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Genera identificadores únicos para que el navegador sepa que hay archivos nuevos
  generateEtags: true,
  async headers() {
    return [
      {
        source: "/downloads/:path*",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          {
            key: "Content-Disposition",
            value: "attachment",
          },
        ],
      },
      // Cabeceras para forzar la actualización de la red Edge de Vercel en otros países
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=1, stale-while-revalidate=59",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
