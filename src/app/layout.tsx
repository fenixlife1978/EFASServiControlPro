import "./globals.css";
import LockListener from "@/components/security/LockListener";

export const metadata = {
  title: "EDUControlPro - Sistema de Monitoreo y Control Parental",
  description: "Sistema de Control de Institutos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        {/* El guardián silencioso de la tablet */}
        <LockListener />
      </body>
    </html>
  );
}
