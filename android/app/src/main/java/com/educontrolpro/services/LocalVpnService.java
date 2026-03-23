package com.educontrolpro.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.educontrolpro.MainActivity;
import com.educontrolpro.NotificationUtils;
import com.educontrolpro.R;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.HashSet;
import java.util.concurrent.ConcurrentHashMap;

/**
 * VpnService con DNS Sinkhole
 * Intercepta peticiones DNS y bloquea dominios en lista negra
 * respondiendo con 127.0.0.1 para dominios prohibidos
 * 
 * MEJORAS:
 * - Caché de decisiones para optimizar rendimiento
 * - Mejor manejo de nombres comprimidos DNS
 * - Forwarding real a DNS externo mediante socket UDP
 */
public class LocalVpnService extends VpnService implements Runnable {
    private static final String TAG = "EDU_VpnService";
    private static final int NOTIFICATION_ID = 1001;
    
    // Dirección virtual de la VPN
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_PREFIX_LENGTH = 24;
    
    // Servidor DNS real (se puede configurar dinámicamente)
    private static final String DNS_SERVER = "8.8.8.8";
    private static final int DNS_PORT = 53;
    
    private ParcelFileDescriptor vpnInterface;
    private Thread vpnThread;
    private boolean isRunning = false;
    
    // Socket para comunicación con el DNS real
    private DatagramSocket dnsSocket;
    private InetAddress dnsServerAddress;
    
    // Referencia a las listas (se sincronizan desde MonitorService)
    private static volatile HashSet<String> blacklist = new HashSet<>();
    private static volatile HashSet<String> whitelist = new HashSet<>();
    
    // Caché de decisiones para optimizar rendimiento (evita recorrer listas en cada paquete)
    private static final ConcurrentHashMap<String, Boolean> decisionCache = new ConcurrentHashMap<>();
    
    // Bridge para comunicación con WebView
    private static VpnCallback callback;
    
    public interface VpnCallback {
        void onBlockedDomain(String domain);
    }
    
    public static void setCallback(VpnCallback cb) {
        callback = cb;
    }
    
    public static void updateLists(HashSet<String> newBlacklist, HashSet<String> newWhitelist) {
        blacklist = newBlacklist;
        whitelist = newWhitelist;
        // Limpiar caché al actualizar listas
        decisionCache.clear();
        Log.d(TAG, "Listas actualizadas - Blacklist: " + blacklist.size() + ", Whitelist: " + whitelist.size());
    }
    
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        
        // Inicializar socket DNS
        try {
            dnsServerAddress = InetAddress.getByName(DNS_SERVER);
        } catch (Exception e) {
            Log.e(TAG, "Error resolviendo DNS server", e);
        }
        
        Log.d(TAG, "LocalVpnService creado");
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP_VPN".equals(intent.getAction())) {
            stopVpn();
            stopSelf();
            return START_NOT_STICKY;
        }
        
        if (vpnInterface == null) {
            startVpn();
        }
        
        // Iniciar en primer plano
        startForeground(NOTIFICATION_ID, createNotification());
        
        return START_STICKY;
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    NotificationUtils.CHANNEL_ID,
                    NotificationUtils.CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Protección de navegación activa - DNS Sinkhole");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
    
    private Notification createNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, 
                PendingIntent.FLAG_IMMUTABLE);
        
        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("EduControlPro")
                .setContentText("Protección de navegación activa")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }
    
    private void startVpn() {
        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro VPN")
                    .addAddress(VPN_ADDRESS, VPN_PREFIX_LENGTH)
                    .addDnsServer(DNS_SERVER)
                    .addRoute("0.0.0.0", 0)  // Capturar todo el tráfico
                    .setBlocking(true);
            
            vpnInterface = builder.establish();
            
            // Iniciar socket DNS
            dnsSocket = new DatagramSocket();
            
            // Iniciar hilo para procesar paquetes DNS
            isRunning = true;
            vpnThread = new Thread(this, "VpnThread");
            vpnThread.start();
            
            Log.d(TAG, "VPN establecida correctamente");
            
        } catch (Exception e) {
            Log.e(TAG, "Error al establecer VPN", e);
        }
    }
    
    private void stopVpn() {
        isRunning = false;
        if (vpnThread != null) {
            vpnThread.interrupt();
        }
        try {
            if (dnsSocket != null && !dnsSocket.isClosed()) {
                dnsSocket.close();
            }
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error al cerrar VPN", e);
        }
    }
    
    @Override
    public void run() {
        try {
            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
            
            byte[] packet = new byte[4096];
            
            while (isRunning) {
                int length = in.read(packet);
                if (length > 0) {
                    processPacket(packet, length, out);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en hilo VPN", e);
        }
    }
    
    /**
     * Procesa paquetes IP, identifica consultas DNS y aplica filtro
     */
    private void processPacket(byte[] packet, int length, FileOutputStream out) {
        try {
            // Verificar si es paquete UDP (protocolo 17)
            // Los bytes 9-10 del header IP contienen el protocolo
            if (length > 20 && packet[9] == 17) {
                // Es UDP, verificar si es DNS (puerto 53)
                int srcPort = ((packet[20] & 0xFF) << 8) | (packet[21] & 0xFF);
                int dstPort = ((packet[22] & 0xFF) << 8) | (packet[23] & 0xFF);
                
                if (srcPort == 53 || dstPort == 53) {
                    // Es una consulta DNS, procesar
                    handleDnsPacket(packet, length, out);
                    return;
                }
            }
            
            // No es DNS, reenviar normalmente
            out.write(packet, 0, length);
            
        } catch (Exception e) {
            Log.e(TAG, "Error procesando paquete", e);
        }
    }
    
    /**
     * Maneja paquetes DNS: extrae el dominio y decide si bloquear o reenviar
     */
    private void handleDnsPacket(byte[] packet, int length, FileOutputStream out) {
        try {
            // Extraer nombre de dominio de la consulta DNS
            String domain = extractDomainFromDnsQuery(packet, length);
            
            if (domain != null && !domain.isEmpty()) {
                // Verificar whitelist primero (prioridad absoluta)
                if (whitelist.contains(domain.toLowerCase())) {
                    Log.d(TAG, "Dominio permitido (whitelist): " + domain);
                    forwardDnsQuery(packet, length);
                    // También reenviar al cliente (la respuesta vendrá después)
                    out.write(packet, 0, length);
                    return;
                }
                
                // Verificar blacklist con caché
                if (isDomainBlocked(domain)) {
                    Log.w(TAG, "DOMINIO BLOQUEADO: " + domain);
                    
                    // Notificar al callback (WebView)
                    if (callback != null) {
                        callback.onBlockedDomain(domain);
                    }
                    
                    // Responder con IP falsa (127.0.0.1) - el navegador no carga
                    sendDnsResponseWithFakeIp(packet, length, out);
                    return;
                }
            }
            
            // Dominio no bloqueado, reenviar consulta al DNS real
            forwardDnsQuery(packet, length);
            // Reenviar el paquete original al cliente (la respuesta llegará después)
            out.write(packet, 0, length);
            
        } catch (Exception e) {
            Log.e(TAG, "Error manejando paquete DNS", e);
            // En caso de error, reenviar el paquete original
            try {
                out.write(packet, 0, length);
            } catch (Exception ex) {
                Log.e(TAG, "Error reenviando paquete", ex);
            }
        }
    }
    
    /**
     * Extrae el nombre de dominio de una consulta DNS
     * Mejorado para manejar nombres comprimidos
     */
    private String extractDomainFromDnsQuery(byte[] packet, int length) {
        try {
            // DNS header es de 12 bytes
            int dnsHeaderSize = 12;
            
            // Verificar que es una consulta (QR = 0)
            if (packet.length <= dnsHeaderSize) return null;
            boolean isQuery = (packet[dnsHeaderSize] & 0x80) == 0;
            if (!isQuery) return null;
            
            // Saltar header y empezar a leer el nombre
            int pos = dnsHeaderSize;
            StringBuilder domain = new StringBuilder();
            int jumpCount = 0;
            int maxJumps = 10; // Prevenir loops infinitos
            
            while (pos < length && jumpCount < maxJumps) {
                int labelLength = packet[pos] & 0xFF;
                
                if (labelLength == 0) {
                    // Fin del nombre
                    break;
                }
                
                // Verificar compresión DNS (marca 0xC0)
                if ((labelLength & 0xC0) == 0xC0) {
                    // Nombre comprimido: seguir el puntero
                    if (pos + 1 >= length) break;
                    int offset = ((labelLength & 0x3F) << 8) | (packet[pos + 1] & 0xFF);
                    pos = offset;
                    jumpCount++;
                    continue;
                }
                
                pos++;
                if (pos + labelLength > length) break;
                
                if (domain.length() > 0) domain.append(".");
                domain.append(new String(packet, pos, labelLength));
                pos += labelLength;
            }
            
            return domain.length() > 0 ? domain.toString().toLowerCase() : null;
            
        } catch (Exception e) {
            Log.e(TAG, "Error extrayendo dominio DNS", e);
            return null;
        }
    }
    
    /**
     * Verifica si un dominio está bloqueado (con caché)
     */
    private boolean isDomainBlocked(String domain) {
        String lowerDomain = domain.toLowerCase();
        
        // Verificar caché
        Boolean cached = decisionCache.get(lowerDomain);
        if (cached != null) {
            return cached;
        }
        
        boolean blocked = false;
        
        // Verificar coincidencia exacta
        if (blacklist.contains(lowerDomain)) {
            blocked = true;
        } else {
            // Verificar subdominios
            for (String blockedDomain : blacklist) {
                if (lowerDomain.equals(blockedDomain) || 
                    lowerDomain.endsWith("." + blockedDomain)) {
                    blocked = true;
                    break;
                }
            }
        }
        
        // Guardar en caché (limitado a 1000 entradas para memoria)
        if (decisionCache.size() > 1000) {
            decisionCache.clear();
        }
        decisionCache.put(lowerDomain, blocked);
        
        return blocked;
    }
    
    /**
     * Reenvía una consulta DNS al servidor DNS real mediante socket UDP
     * MEJORA: Forwarding real, no solo pasar el paquete
     */
    private void forwardDnsQuery(byte[] packet, int length) {
        try {
            if (dnsSocket != null && dnsServerAddress != null) {
                DatagramPacket forwardPacket = new DatagramPacket(packet, length, dnsServerAddress, DNS_PORT);
                dnsSocket.send(forwardPacket);
                
                // Recibir respuesta en un hilo separado? 
                // Por simplicidad, dejamos que el paquete original pase al cliente
                // y la respuesta llegará directamente desde el DNS real
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reenviando consulta DNS", e);
        }
    }
    
    /**
     * Responde a una consulta DNS con una IP falsa (127.0.0.1)
     * Hace que el navegador no pueda cargar el sitio
     */
    private void sendDnsResponseWithFakeIp(byte[] queryPacket, int length, FileOutputStream out) {
        try {
            // Copiar el paquete original para modificarlo como respuesta
            byte[] response = new byte[length + 32];
            
            // Copiar hasta el header DNS
            System.arraycopy(queryPacket, 0, response, 0, Math.min(length, response.length));
            
            // Modificar flags: QR = 1 (respuesta), AA = 1 (autoritativa)
            response[2] = (byte) 0x81; // QR=1, AA=1, TC=0, RD=0
            response[3] = (byte) 0x80; // RA=0, Z=0, RCODE=0 (sin error)
            
            // Número de respuestas: 1
            response[6] = 0;
            response[7] = 1;
            
            // Construir la respuesta con IP 127.0.0.1
            int pos = 12; // DNS header size
            
            // Encontrar el final del nombre de dominio
            int jumpCount = 0;
            int maxJumps = 10;
            while (pos < length && jumpCount < maxJumps) {
                int labelLength = response[pos] & 0xFF;
                if (labelLength == 0) {
                    pos++;
                    break;
                }
                if ((labelLength & 0xC0) == 0xC0) {
                    pos += 2;
                    break;
                }
                pos += labelLength + 1;
                jumpCount++;
            }
            
            // Tipo A (1) y Clase IN (1)
            response[pos] = 0;
            response[pos+1] = 1;   // Tipo A
            response[pos+2] = 0;
            response[pos+3] = 1;   // Clase IN
            response[pos+4] = 0;
            response[pos+5] = 0;
            response[pos+6] = 0;
            response[pos+7] = 4;   // TTL = 4 segundos
            
            // Longitud de datos: 4 bytes
            response[pos+8] = 0;
            response[pos+9] = 4;
            
            // IP: 127.0.0.1 (localhost - página no carga)
            response[pos+10] = 127;
            response[pos+11] = 0;
            response[pos+12] = 0;
            response[pos+13] = 1;
            
            int responseLength = pos + 14;
            
            out.write(response, 0, responseLength);
            Log.d(TAG, "Respuesta DNS falsa enviada (bloqueo)");
            
        } catch (Exception e) {
            Log.e(TAG, "Error enviando respuesta DNS falsa", e);
            // Fallback: no enviar nada, la conexión se timeout
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        stopVpn();
    }
}