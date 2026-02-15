import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
// Importación directa del proveedor unificado para evitar conflictos de contexto
import { FirebaseClientProvider } from '@/firebase/client-provider';

// Constantes de marca actualizadas [cite: 2026-02-14]
const APP_NAME = "EFAS ServiControlPro";
const APP_DESCRIPTION = "Servidor Web para Control Parental Multi-Usuarios.";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/logo-efas-192.png",
    apple: "/logo-efas-512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a", // Azul Profundo de la marca
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Optimización para experiencia PWA nativa
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Fuentes optimizadas para el estilo Black Italic de la marca */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        {/* FirebaseClientProvider: Centro de Control de Identidad. 
            Maneja la inicialización de protocolos de seguridad y servicios de datos.
        */}
        <FirebaseClientProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </FirebaseClientProvider>
        
        {/* Sistema de notificaciones de protocolos */}
        <Toaster />
      </body>
    </html>
  );
}
