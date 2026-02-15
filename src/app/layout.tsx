import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';

// Constantes de marca actualizadas
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
  themeColor: "#0f172a", 
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Mejora la experiencia PWA al evitar zoom accidental
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        {/* FirebaseClientProvider envuelve la app para gestionar auth y db en el cliente */}
        <FirebaseClientProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </FirebaseClientProvider>
        
        {/* Componente de notificaciones global */}
        <Toaster />
      </body>
    </html>
  );
}
