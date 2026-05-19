/** @type {import('next').NextConfig} */

const isAndroidBuild = process.env.IS_ANDROID_BUILD === 'true';
const isDesktopBuild = process.env.IS_DESKTOP_BUILD === 'true';

const isStaticExport = isAndroidBuild || isDesktopBuild;

const nextConfig = {
  output: isStaticExport ? 'export' : undefined,
  distDir: isStaticExport ? 'out' : '.next',
  images: {
    unoptimized: true,
  },
  trailingSlash: isAndroidBuild ? true : false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ✅ Excluir rutas de API del export estático (con tipos correctos)
  exportPathMap: async function (
    defaultPathMap: Record<string, { page: string; query?: Record<string, string> }>
  ): Promise<Record<string, { page: string; query?: Record<string, string> }>> {
    const filteredPaths: Record<string, { page: string; query?: Record<string, string> }> = {};
    for (const [path, config] of Object.entries(defaultPathMap)) {
      if (!path.startsWith('/api')) {
        filteredPaths[path] = config;
      }
    }
    return filteredPaths;
  },
};

export default nextConfig;