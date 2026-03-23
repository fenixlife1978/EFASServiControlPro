package com.educontrolpro.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
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
import java.net.InetSocketAddress;
import java.util.HashSet;
import java.util.concurrent.ConcurrentHashMap;

/**
 * VpnService con DNS Sinkhole
 * Intercepta peticiones DNS y bloquea dominios en lista negra
 * respondiendo con 127.0.0.1 para dominios prohibidos
 */
public class LocalVpnService extends VpnService implements Runnable {
    private static final String TAG = "EDU_VpnService";
    private static final int NOTIFICATION_ID = 1001;
    
    // Dirección virtual de la VPN
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_PREFIX_LENGTH = 24;
    
    // Servidor DNS real
    private static final String DNS_SERVER = "8.8.8.8";
    private static final int DNS_PORT = 53;
    
    private ParcelFileDescriptor vpnInterface;
    private Thread vpnThread;
    private boolean isRunning = false;
    
    // Socket para comunicación con el DNS real
    private DatagramSocket dnsSocket;
    private InetAddress dnsServerAddress;
    
    // Referencia a las listas
    private static volatile HashSet<String> blacklist = new HashSet<>();
    private static volatile HashSet<String> whitelist = new HashSet<>();
    
    // Caché de decisiones
    private static final ConcurrentHashMap<String, Boolean> decisionCache = new ConcurrentHashMap<>();
    
    // Bridge para comunicación con WebView
    private static VpnCallback callback;
    
    // Mapa para mantener seguimiento de consultas DNS pendientes
    private final ConcurrentHashMap<Integer, byte[]> pendingQueries = new ConcurrentHashMap<>();
    private int queryId = 0;
    
    public interface VpnCallback {
        void onBlockedDomain(String domain);
    }
    
    public static void setCallback(VpnCallback cb) {
        callback = cb;
    }
    
    public static void updateLists(HashSet<String> newBlacklist, HashSet<String> newWhitelist) {
        blacklist = newBlacklist;
        whitelist = newWhitelist;
        decisionCache.clear();
        Log.d(TAG, "Listas actualizadas - Blacklist: " + blacklist.size() + ", Whitelist: " + whitelist.size());
    }
    
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        
        try {
            dnsServerAddress = InetAddress.getByName(DNS_SERVER);
            dnsSocket = new DatagramSocket();
        } catch (Exception e) {
            Log.e(TAG, "Error inicializando DNS socket", e);
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
            channel.setDescription("Protección de navegación activa");
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
                .setContentText("Protección activa - DNS Sinkhole")
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
                    .addRoute("0.0.0.0", 0)
                    .setBlocking(true);
            
            vpnInterface = builder.establish();
            
            isRunning = true;
            vpnThread = new Thread(this, "VpnThread");
            vpnThread.start();
            
            // Hilo para recibir respuestas DNS
            new Thread(this::dnsResponseReceiver, "DnsReceiver").start();
            
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
                    // Escribir directamente al cliente (reenviar todo el tráfico)
                    // Solo interceptamos DNS de manera paralela
                    out.write(packet, 0, length);
                    
                    // Procesar DNS en paralelo (sin bloquear el flujo)
                    processDnsPacketAsync(packet, length);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en hilo VPN", e);
        }
    }
    
    /**
     * Procesa paquetes DNS de forma asíncrona sin bloquear el tráfico
     */
    private void processDnsPacketAsync(byte[] packet, int length) {
        try {
            // Verificar si es paquete UDP DNS
            if (length > 20 && packet[9] == 17) {
                int dstPort = ((packet[22] & 0xFF) << 8) | (packet[23] & 0xFF);
                
                if (dstPort == 53) {
                    // Es una consulta DNS saliente
                    String domain = extractDomainFromDnsQuery(packet, length);
                    
                    if (domain != null && !domain.isEmpty()) {
                        // Verificar whitelist
                        if (whitelist.contains(domain.toLowerCase())) {
                            Log.d(TAG, "Dominio permitido (whitelist): " + domain);
                            return;
                        }
                        
                        // Verificar blacklist
                        if (isDomainBlocked(domain)) {
                            Log.w(TAG, "DOMINIO BLOQUEADO: " + domain);
                            
                            if (callback != null) {
                                callback.onBlockedDomain(domain);
                            }
                            
                            // Enviar respuesta falsa interceptando el paquete original
                            sendDnsResponseWithFakeIp(packet, length);
                        } else {
                            // Reenviar al DNS real (ya se está reenviando por el flujo normal)
                            Log.d(TAG, "Dominio permitido: " + domain);
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error procesando DNS", e);
        }
    }
    
    /**
     * Envía una respuesta DNS falsa (bloqueo)
     */
    private void sendDnsResponseWithFakeIp(byte[] queryPacket, int length) {
        try {
            // Construir respuesta DNS falsa
            byte[] response = new byte[length + 32];
            System.arraycopy(queryPacket, 0, response, 0, Math.min(length, response.length));
            
            // Modificar flags: QR=1 (respuesta)
            response[2] = (byte) 0x81;
            response[3] = (byte) 0x80;
            
            // Número de respuestas: 1
            response[6] = 0;
            response[7] = 1;
            
            int pos = 12;
            
            // Saltar el nombre de dominio
            while (pos < length && response[pos] != 0) {
                if ((response[pos] & 0xC0) == 0xC0) {
                    pos += 2;
                    break;
                }
                pos += (response[pos] & 0xFF) + 1;
            }
            if (pos < length && response[pos] == 0) {
                pos++;
            }
            
            // Agregar respuesta con IP 127.0.0.1
            response[pos] = 0;
            response[pos+1] = 1;   // Tipo A
            response[pos+2] = 0;
            response[pos+3] = 1;   // Clase IN
            response[pos+4] = 0;
            response[pos+5] = 0;
            response[pos+6] = 0;
            response[pos+7] = 4;   // TTL
            response[pos+8] = 0;
            response[pos+9] = 4;   // Longitud 4
            response[pos+10] = 127;
            response[pos+11] = 0;
            response[pos+12] = 0;
            response[pos+13] = 1;
            
            int responseLength = pos + 14;
            
            // Enviar respuesta a través del túnel VPN
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
            out.write(response, 0, responseLength);
            
            Log.d(TAG, "Respuesta DNS falsa enviada (bloqueo)");
            
        } catch (Exception e) {
            Log.e(TAG, "Error enviando respuesta DNS falsa", e);
        }
    }
    
    /**
     * Hilo para recibir respuestas DNS del servidor real
     */
    private void dnsResponseReceiver() {
        byte[] buffer = new byte[4096];
        while (isRunning) {
            try {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                dnsSocket.receive(packet);
                
                // Reenviar respuesta al túnel VPN
                if (vpnInterface != null) {
                    FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
                    out.write(packet.getData(), 0, packet.getLength());
                }
            } catch (Exception e) {
                if (isRunning) {
                    Log.e(TAG, "Error en receptor DNS", e);
                }
            }
        }
    }
    
    private String extractDomainFromDnsQuery(byte[] packet, int length) {
        try {
            int dnsHeaderSize = 12;
            if (packet.length <= dnsHeaderSize) return null;
            
            boolean isQuery = (packet[dnsHeaderSize] & 0x80) == 0;
            if (!isQuery) return null;
            
            int pos = dnsHeaderSize;
            StringBuilder domain = new StringBuilder();
            
            while (pos < length) {
                int labelLength = packet[pos] & 0xFF;
                if (labelLength == 0) break;
                
                if ((labelLength & 0xC0) == 0xC0) {
                    pos += 2;
                    break;
                }
                
                pos++;
                if (pos + labelLength > length) break;
                
                if (domain.length() > 0) domain.append(".");
                domain.append(new String(packet, pos, labelLength));
                pos += labelLength;
            }
            
            return domain.length() > 0 ? domain.toString().toLowerCase() : null;
            
        } catch (Exception e) {
            return null;
        }
    }
    
    private boolean isDomainBlocked(String domain) {
        String lowerDomain = domain.toLowerCase();
        
        Boolean cached = decisionCache.get(lowerDomain);
        if (cached != null) return cached;
        
        boolean blocked = false;
        if (blacklist.contains(lowerDomain)) {
            blocked = true;
        } else {
            for (String blockedDomain : blacklist) {
                if (lowerDomain.equals(blockedDomain) || lowerDomain.endsWith("." + blockedDomain)) {
                    blocked = true;
                    break;
                }
            }
        }
        
        if (decisionCache.size() > 1000) decisionCache.clear();
        decisionCache.put(lowerDomain, blocked);
        
        return blocked;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        stopVpn();
    }
}