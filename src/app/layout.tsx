import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';

// Constantes de marca actualizadas [cite: 2026-02-11]
const APP_NAME = "EFAS ServiControlPro";
const APP_DESCRIPTION = "Servidor Web para Control Parental Multi-Usuarios.";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json", // Habilita la instalación de la PWA [cite: 2026-02-13]
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/logo-efas-192.png", // Icono generado de 192x192 [cite: 2026-02-13]
    apple: "/logo-efas-512.png",    // Icono generado de 512x512 [cite: 2026-02-13]
  },
};

export const viewport: Viewport = {
  // Color Azul Profundo de la marca para la barra del navegador [cite: 2026-02-11]
  themeColor: "#0f172a", 
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Optimizamos la carga de fuentes para la estética Italic/Black [cite: 2026-02-13] */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <FirebaseClientProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
