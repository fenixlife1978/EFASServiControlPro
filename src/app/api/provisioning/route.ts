import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instId = searchParams.get('instId');
  const aulaId = searchParams.get('aulaId');
  const rol = searchParams.get('rol');

  // URL donde tienes alojada la APK físicamente
  const apkUrl = "/downloads/efas.apk"; 

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { background: #0a0c10; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
        .loader { border: 4px solid #1a1d26; border-top: 4px solid #f97316; border-radius: 50%; width: 40px; height: 40px; animate: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        h2 { color: #f97316; font-style: italic; text-transform: uppercase; letter-spacing: -1px; }
        p { color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="loader"></div>
      <h2>EFAS <span style="color:white">ServiControlPro</span></h2>
      <p id="msg">Sincronizando seguridad...</p>
      
      <script>
        const config = {
          InstitutoId: "${instId}",
          aulaId: "${aulaId}",
          rol: "${rol}",
          timestamp: Date.now()
        };

        // Guardamos en localStorage para que si el navegador es interno lo detecte
        localStorage.setItem('pending_provision', JSON.stringify(config));
        
        // Intentamos copiar al portapapeles (método de respaldo para la APK)
        const text = JSON.stringify(config);
        navigator.clipboard.writeText(text).then(() => {
          document.getElementById('msg').innerText = "VINCULACIÓN PREPARADA. DESCARGANDO...";
          setTimeout(() => { window.location.href = "${apkUrl}"; }, 1000);
        }).catch(() => {
          // Si el portapapeles falla, descargamos igual
          window.location.href = "${apkUrl}";
        });
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
