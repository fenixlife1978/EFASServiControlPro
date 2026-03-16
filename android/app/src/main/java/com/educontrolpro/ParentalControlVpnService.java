package com.educontrolpro;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.DatabaseReference;

/**
 * Servicio de VPN con bloqueo de URLs desde Firebase - VERSIÓN REALTIME DB
 */
public class ParentalControlVpnService extends VpnService implements FirebaseBlockerManager.OnBlockedSitesUpdatedListener {
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_MTU = 1400;
    
    // DNS servers
    private static final String DNS1 = "8.8.8.8";
    private static final String DNS2 = "8.8.4.4";
    private static final String DNS3 = "1.1.1.1";
    private static final String DNS4 = "208.67.222.222";
    
    // Acciones
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private Thread vpnThread;
    
    // Firebase Blocker
    private FirebaseBlockerManager blockerManager;
    private Set<String> sitiosBloqueados = new HashSet<>();
    
    // Realtime Database
    private FirebaseDatabase realtimeDb;
    private DatabaseReference logsRef;
    private String deviceId;
    private String institutionId;
    private boolean cuotaExcedida = false;
    
    // Control de logs
    private long ultimoLogRealtime = 0;
    private static final long LOG_INTERVAL = 300000; // 5 minutos entre logs
    
    // Contadores
    private int totalPaquetesPermitidos = 0;
    private int totalPaquetesBloqueados = 0;
    private int ultimosPaquetesReportados = 0;
    private int ultimosBloqueosReportados = 0;
    
    // Cache de última URL bloqueada
    private String ultimaUrlBloqueada = "";
    private long ultimoBloqueoTime = 0;
    private static final long BLOQUEO_COOLDOWN = 10000; // 10 seg
    
    private String packageName;
    private Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        
        packageName = getPackageName();
        
        // Inicializar Realtime Database
        realtimeDb = FirebaseDatabase.getInstance();
        
        obtenerIdsLocales();
        NotificationUtils.createNotificationChannel(this);
        
        blockerManager = FirebaseBlockerManager.getInstance();
        blockerManager.init(this);
        blockerManager.startListening(this);
        
        SimpleLogger.i("VPN Service - Inicializado (Realtime DB). Paquete: " + packageName);
    }

    private void obtenerIdsLocales() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            deviceId = prefs.getString("deviceId", null);
            institutionId = prefs.getString("InstitutoId", null);
            
            if (deviceId != null) {
                logsRef = realtimeDb.getReference("dispositivos").child(deviceId).child("vpn_logs");
            }
            
            SimpleLogger.i("VPN Service - deviceId: " + deviceId + ", institutionId: " + institutionId);
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error obteniendo IDs: " + e.getMessage());
        }
    }

    // Log a Realtime Database con límite de frecuencia
    private void logToRealtime(String tipo, String mensaje) {
        if (cuotaExcedida || deviceId == null || logsRef == null) return;
        
        long ahora = System.currentTimeMillis();
        if (ahora - ultimoLogRealtime < LOG_INTERVAL) {
            return;
        }
        
        Map<String, Object> logEntry = new HashMap<>();
        logEntry.put("tipo", tipo);
        logEntry.put("mensaje", mensaje);
        logEntry.put("timestamp", ahora);
        logEntry.put("origen", "VPNService");
        logEntry.put("sitiosBloqueados", sitiosBloqueados != null ? sitiosBloqueados.size() : 0);
        logEntry.put("paquetesPermitidos", totalPaquetesPermitidos);
        logEntry.put("paquetesBloqueados", totalPaquetesBloqueados);
        
        logsRef.push().setValue(logEntry)
            .addOnFailureListener(e -> {
                String error = e.getMessage();
                if (error != null && error.contains("PERMISSION_DENIED")) {
                    SimpleLogger.e("VPN Service - Permiso denegado en Realtime DB");
                    cuotaExcedida = true;
                }
            });
        
        ultimoLogRealtime = ahora;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_VPN.equals(intent.getAction())) {
            SimpleLogger.w("VPN Service - Recibida orden de detención");
            stopVpn();
            return START_NOT_STICKY;
        }

        if (!isRunning.get()) {
            if (sitiosBloqueados == null || sitiosBloqueados.isEmpty()) {
                SimpleLogger.i("VPN Service - Esperando lista de sitios...");
                
                handler.postDelayed(() -> {
                    if (!isRunning.get()) {
                        int tamañoLista = sitiosBloqueados != null ? sitiosBloqueados.size() : 0;
                        SimpleLogger.i("VPN Service - Iniciando con " + tamañoLista + " sitios");
                        
                        isRunning.set(true);
                        vpnThread = new Thread(this::runVpn, "VpnThread");
                        vpnThread.start();
                        startForeground(101, createNotification());
                        
                        logToRealtime("VPN_START", "Iniciada con " + tamañoLista + " sitios");
                    }
                }, 3000);
            } else {
                SimpleLogger.i("VPN Service - Iniciando con " + sitiosBloqueados.size() + " sitios");
                isRunning.set(true);
                vpnThread = new Thread(this::runVpn, "VpnThread");
                vpnThread.start();
                startForeground(101, createNotification());
                
                logToRealtime("VPN_START", "Iniciada con " + sitiosBloqueados.size() + " sitios");
            }
        }

        return START_STICKY;
    }

    private void runVpn() {
        SimpleLogger.i("VPN Service - Configurando interfaz");
        
        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro VPN");
            builder.setMtu(VPN_MTU);
            builder.addAddress(VPN_ADDRESS, 32);
            builder.addRoute("0.0.0.0", 0);
            
            // DNS servers OBLIGATORIOS
            builder.addDnsServer(DNS1);
            builder.addDnsServer(DNS2);
            builder.addDnsServer(DNS3);
            builder.addDnsServer(DNS4);

            // EXCLUIR NUESTRA APP
            try {
                builder.addDisallowedApplication(packageName);
                SimpleLogger.i("VPN Service - App EXCLUIDA: " + packageName);
            } catch (PackageManager.NameNotFoundException e) {
                SimpleLogger.e("VPN Service - Error al excluir: " + e.getMessage());
            }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - No se pudo establecer interfaz");
                return;
            }

            SimpleLogger.i("VPN Service - Interfaz establecida");

            ByteBuffer packet = ByteBuffer.allocate(65535);
            byte[] packetArray = packet.array();
            
            try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
                 FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {
                
                long lastStatTime = System.currentTimeMillis();
                long lastRealtimeLog = lastStatTime;

                while (isRunning.get() && !Thread.interrupted()) {
                    int length = in.read(packetArray);
                    if (length > 0) {
                        packet.limit(length);
                        
                        // 🔍 ANALIZAR PAQUETE CON PARSERS MEJORADOS
                        boolean bloquear = false;
                        
                        try {
                            // Parsear cabecera IP
                            PacketParser.IpHeader ip = PacketParser.parseIpHeader(packet);
                            
                            // Solo analizar tráfico saliente (desde dispositivo)
                            if (ip.sourceIp.startsWith("10.0.0.")) { // Nuestra IP virtual
                                
                                if (ip.protocol == 6) { // TCP
                                    PacketParser.TcpHeader tcp = PacketParser.parseTcpHeader(packet, ip.headerLength);
                                    
                                    // Bloquear HTTP (puerto 80)
                                    if (tcp.destPort == 80) {
                                        SimpleLogger.d("🚫 BLOQUEADO HTTP: " + ip.destIp + ":" + tcp.destPort);
                                        bloquear = true;
                                    }
                                    
                                } else if (ip.protocol == 17) { // UDP
                                    PacketParser.UdpHeader udp = PacketParser.parseUdpHeader(packet, ip.headerLength);
                                    
                                    // Analizar DNS (puerto 53)
                                    if (udp.destPort == 53) {
                                        try {
                                            String domain = DnsParser.parseDomain(packet, ip.headerLength, 8);
                                            
                                            if (!domain.isEmpty()) {
                                                // Verificar contra lista de sitios bloqueados
                                                for (String sitio : sitiosBloqueados) {
                                                    if (domain.contains(sitio) || sitio.contains(domain)) {
                                                        SimpleLogger.d("🚫 BLOQUEADO DNS: " + domain);
                                                        bloquear = true;
                                                        break;
                                                    }
                                                }
                                            }
                                        } catch (Exception e) {
                                            // Ignorar errores de parsing DNS
                                        }
                                    }
                                }
                            }
                        } catch (Exception e) {
                            // Error parseando paquete, permitir por defecto
                        }
                        
                        if (bloquear) {
                            totalPaquetesBloqueados++;
                            // NO REENVIAR = BLOQUEADO
                        } else {
                            // ✅ REENVIAR SIEMPRE los paquetes permitidos
                            out.write(packetArray, 0, length);
                            out.flush();
                            totalPaquetesPermitidos++;
                        }
                    }
                    packet.clear();
                    
                    long now = System.currentTimeMillis();
                    
                    // Log a console cada 30 segundos
                    if (now - lastStatTime > 30000) {
                        SimpleLogger.d("Stats - P: " + totalPaquetesPermitidos + 
                                      ", B: " + totalPaquetesBloqueados);
                        lastStatTime = now;
                    }
                    
                    // Log a Realtime DB cuando hay cambios significativos
                    if (now - lastRealtimeLog > LOG_INTERVAL) {
                        if (totalPaquetesPermitidos > ultimosPaquetesReportados || 
                            totalPaquetesBloqueados > ultimosBloqueosReportados) {
                            
                            logToRealtime("VPN_STATS", 
                                "P: " + totalPaquetesPermitidos + 
                                ", B: " + totalPaquetesBloqueados);
                            
                            ultimosPaquetesReportados = totalPaquetesPermitidos;
                            ultimosBloqueosReportados = totalPaquetesBloqueados;
                            lastRealtimeLog = now;
                        }
                    }
                }
            } catch (IOException e) {
                SimpleLogger.e("VPN Service - Error: " + e.getMessage());
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error: " + e.getMessage());
        } finally {
            stopVpn();
        }
    }

    private boolean debeBloquearPaquete(byte[] packet, int length) {
        // Este método ya no se usa, pero lo mantenemos por compatibilidad
        return false;
    }

    @Override
    public void onBlockedSitesUpdated(Set<String> sitios) {
        this.sitiosBloqueados = sitios;
        int count = sitios != null ? sitios.size() : 0;
        SimpleLogger.i("Lista actualizada: " + count + " sitios");
        
        if (count > 0 && !cuotaExcedida) {
            logToRealtime("SITIOS_ACTUALIZADOS", count + " sitios");
        }
    }

    private void stopVpn() {
        if (!isRunning.get() && vpnInterface == null) return;

        isRunning.set(false);
        SimpleLogger.i("VPN Service - Cerrando túnel");

        if (blockerManager != null) {
            blockerManager.stopListening();
        }

        if (vpnThread != null) {
            vpnThread.interrupt();
            try {
                vpnThread.join(1000);
            } catch (InterruptedException e) {
                // Ignorar
            }
            vpnThread = null;
        }

        if (vpnInterface != null) {
            try {
                vpnInterface.close();
            } catch (IOException e) {
                SimpleLogger.e("VPN Service - Error al cerrar: " + e.getMessage());
            }
            vpnInterface = null;
        }

        stopForeground(true);
        stopSelf();
        
        if (!cuotaExcedida) {
            logToRealtime("VPN_STOP", "Detenida - P: " + totalPaquetesPermitidos + 
                         ", B: " + totalPaquetesBloqueados);
        }
    }

    private Notification createNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_IMMUTABLE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_UPDATE_CURRENT;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        String estado = (sitiosBloqueados != null && !sitiosBloqueados.isEmpty()) 
            ? "Activo - " + sitiosBloqueados.size() + " sitios" 
            : "Activo - Sin restricciones";

        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("EduControlPro")
                .setContentText(estado)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
    }

    @Override
    public void onRevoke() {
        SimpleLogger.w("VPN Service - Permiso revocado");
        stopVpn();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }
}