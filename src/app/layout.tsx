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
      <head>
        {/* Script que se ejecuta antes de que cargue la app */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  // Definir la función global mostrarBloqueo
                  window.mostrarBloqueo = function(domain) {
                    console.log('🚫 [EduControlPro] Dominio bloqueado:', domain);
                    
                    // Crear y disparar evento personalizado
                    var event = new CustomEvent('domainBlocked', { 
                      detail: { domain: domain, timestamp: Date.now() } 
                    });
                    window.dispatchEvent(event);
                    
                    // Guardar en variable global
                    window.lastBlockedDomain = domain;
                    window.lastBlockedTime = Date.now();
                    
                    // Mostrar alerta visual si hay un elemento con id 'blocked-alert'
                    var alertElement = document.getElementById('blocked-alert');
                    if (alertElement) {
                      alertElement.style.display = 'block';
                      alertElement.innerHTML = '⛔ Acceso bloqueado: ' + domain;
                      setTimeout(function() {
                        alertElement.style.display = 'none';
                      }, 3000);
                    }
                  };
                  
                  // Función de respaldo
                  window.onBlockedDomain = function(domain) {
                    if (window.mostrarBloqueo) {
                      window.mostrarBloqueo(domain);
                    }
                  };
                  
                  console.log('✅ [EduControlPro] mostrarBloqueo registrada globalmente');
                }
              })();
            `,
          }}
        />
      </head>
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
