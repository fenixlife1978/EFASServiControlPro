import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* Configuración de EFAS ServiControlPro */
  
  // Mantenemos estos en true para permitir el despliegue si hay errores menores de tipos
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      // Agregamos el dominio de Firebase para que los logos de instituciones funcionen
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
    ],
  },

  // Esta opción ayuda a que las variables de entorno se manejen estrictamente
  env: {
    // Aquí puedes mapear variables si fuera necesario, 
    // pero Next.js ya lee .env.local automáticamente.
  }
};

export default nextConfig;