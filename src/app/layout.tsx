import "./globals.css";

export const metadata = {
  title: "EFAS ServiControlPro",
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
      </body>
    </html>
  );
}
