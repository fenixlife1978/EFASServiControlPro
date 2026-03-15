import "./globals.css";
import { Inter } from "next/font/google";
import { SecurityWrapper } from "@/components/security/SecurityWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "EFAS ServiControlPro",
  description: "Shield Infrastructure - Sistema de Monitoreo y Control Parental",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body 
        className={`${inter.className} antialiased bg-[#050505] text-white selection:bg-orange-500/30 overflow-x-hidden`}
      >
        <SecurityWrapper>
          {children}
        </SecurityWrapper>
      </body>
    </html>
  );
}
