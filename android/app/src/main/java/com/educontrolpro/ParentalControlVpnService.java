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

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

/**
 * Servicio de VPN con bloqueo de URLs desde Firebase - VERSIÓN OPTIMIZADA
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
    
    // Firebase Logging - OPTIMIZADO
    private FirebaseFirestore db;
    private String deviceId;
    private String institutionId;
    private boolean cuotaExcedida = false;
    
    // OPTIMIZACIÓN: Control de logs
    private long ultimoLogFirebase = 0;
    private static final long LOG_INTERVAL = 300000; // 5 minutos entre logs
    
    // OPTIMIZACIÓN: Contadores acumulados
    private int totalPaquetesPermitidos = 0;
    private int totalPaquetesBloqueados = 0;
    private int ultimosPaquetesReportados = 0;
    private int ultimosBloqueosReportados = 0;
    
    // OPTIMIZACIÓN: Cache de última URL bloqueada
    private String ultimaUrlBloqueada = "";
    private long ultimoBloqueoTime = 0;
    private static final long BLOQUEO_COOLDOWN = 10000; // 10 seg entre logs del mismo sitio
    
    // Nombre del paquete de la app
    private String packageName;
    
    // Handler para delays
    private Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        
        packageName = getPackageName();
        db = FirebaseFirestore.getInstance();
        
        obtenerIdsLocales();
        NotificationUtils.createNotificationChannel(this);
        
        blockerManager = FirebaseBlockerManager.getInstance();
        blockerManager.init(this);
        blockerManager.startListening(this);
        
        SimpleLogger.i("VPN Service - Inicializado. Paquete: " + packageName);
    }

    private void obtenerIdsLocales() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            deviceId = prefs.getString("deviceId", null);
            institutionId = prefs.getString("InstitutoId", null);
            
            SimpleLogger.i("VPN Service - deviceId: " + deviceId + ", institutionId: " + institutionId);
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error obteniendo IDs: " + e.getMessage());
        }
    }

    // OPTIMIZACIÓN: Log a Firebase con límite de frecuencia
    private void logToFirebase(String tipo, String mensaje) {
        if (cuotaExcedida || deviceId == null) return;
        
        long ahora = System.currentTimeMillis();
        if (ahora - ultimoLogFirebase < LOG_INTERVAL) {
            return; // No escribir tan seguido
        }
        
        Map<String, Object> logEntry = new HashMap<>();
        logEntry.put("tipo", tipo);
        logEntry.put("mensaje", mensaje);
        logEntry.put("timestamp", FieldValue.serverTimestamp());
        logEntry.put("sitiosBloqueados", sitiosBloqueados != null ? sitiosBloqueados.size() : 0);
        logEntry.put("paquetesPermitidos", totalPaquetesPermitidos);
        logEntry.put("paquetesBloqueados", totalPaquetesBloqueados);
        
        db.collection("dispositivos")
            .document(deviceId)
            .collection("vpn_logs")
            .add(logEntry)
            .addOnFailureListener(e -> {
                String error = e.getMessage();
                if (error != null && (error.contains("PERMISSION_DENIED") || error.contains("429"))) {
                    SimpleLogger.e("VPN Service - Cuota excedida, desactivando logs");
                    cuotaExcedida = true;
                }
            });
        
        ultimoLogFirebase = ahora;
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
                        
                        logToFirebase("VPN_START", "Iniciada con " + tamañoLista + " sitios");
                    }
                }, 3000);
            } else {
                SimpleLogger.i("VPN Service - Iniciando con " + sitiosBloqueados.size() + " sitios");
                isRunning.set(true);
                vpnThread = new Thread(this::runVpn, "VpnThread");
                vpnThread.start();
                startForeground(101, createNotification());
                
                logToFirebase("VPN_START", "Iniciada con " + sitiosBloqueados.size() + " sitios");
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
                long lastFirebaseLog = lastStatTime;

                while (isRunning.get() && !Thread.interrupted()) {
                    int length = in.read(packetArray);
                    if (length > 0) {
                        packet.limit(length);
                        
                        if (debeBloquearPaquete(packetArray, length)) {
                            totalPaquetesBloqueados++;
                        } else {
                            out.write(packetArray, 0, length);
                            out.flush();
                            totalPaquetesPermitidos++;
                        }
                    }
                    packet.clear();
                    
                    long now = System.currentTimeMillis();
                    
                    // Log a console cada 30 segundos (gratis)
                    if (now - lastStatTime > 30000) {
                        SimpleLogger.d("Stats - P: " + totalPaquetesPermitidos + 
                                      ", B: " + totalPaquetesBloqueados);
                        lastStatTime = now;
                    }
                    
                    // Log a Firebase solo cuando hay cambios significativos
                    if (now - lastFirebaseLog > LOG_INTERVAL) {
                        if (totalPaquetesPermitidos > ultimosPaquetesReportados || 
                            totalPaquetesBloqueados > ultimosBloqueosReportados) {
                            
                            logToFirebase("VPN_STATS", 
                                "P: " + totalPaquetesPermitidos + 
                                ", B: " + totalPaquetesBloqueados);
                            
                            ultimosPaquetesReportados = totalPaquetesPermitidos;
                            ultimosBloqueosReportados = totalPaquetesBloqueados;
                            lastFirebaseLog = now;
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
        if (sitiosBloqueados == null || sitiosBloqueados.isEmpty()) {
            return false;
        }
        
        if (length < 10) return false;
        
        try {
            int analyzeLength = Math.min(length, 512);
            String packetContent = new String(packet, 0, analyzeLength).toLowerCase();
            
            if (packetContent.contains("host:") || 
                packetContent.contains("get ") || 
                packetContent.contains("post ")) {
                
                for (String sitio : sitiosBloqueados) {
                    if (sitio != null && !sitio.isEmpty() && packetContent.contains(sitio.toLowerCase())) {
                        
                        // OPTIMIZACIÓN: No loguear el mismo sitio repetidamente
                        long ahora = System.currentTimeMillis();
                        if (!sitio.equals(ultimaUrlBloqueada) || 
                            ahora - ultimoBloqueoTime > BLOQUEO_COOLDOWN) {
                            
                            SimpleLogger.d("🚫 BLOQUEADO: " + sitio);
                            ultimaUrlBloqueada = sitio;
                            ultimoBloqueoTime = ahora;
                        }
                        
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            // Ignorar
        }
        
        return false;
    }

    @Override
    public void onBlockedSitesUpdated(Set<String> sitios) {
        this.sitiosBloqueados = sitios;
        int count = sitios != null ? sitios.size() : 0;
        SimpleLogger.i("Lista actualizada: " + count + " sitios");
        
        if (count > 0 && !cuotaExcedida) {
            logToFirebase("SITIOS_ACTUALIZADOS", count + " sitios");
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
            logToFirebase("VPN_STOP", "Detenida - P: " + totalPaquetesPermitidos + 
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