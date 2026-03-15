package com.educontrolpro;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.os.Build;
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
 * Servicio de VPN con bloqueo de URLs desde Firebase
 */
public class ParentalControlVpnService extends VpnService implements FirebaseBlockerManager.OnBlockedSitesUpdatedListener {
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_MTU = 1500;
    
    // DNS servers
    private static final String DNS1 = "8.8.8.8";
    private static final String DNS2 = "1.1.1.1";
    
    // Acciones
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private Thread vpnThread;
    
    // Firebase Blocker
    private FirebaseBlockerManager blockerManager;
    private Set<String> sitiosBloqueados = new HashSet<>();
    
    // Firebase Logging
    private FirebaseFirestore db;
    private String deviceId;
    private String institutionId;
    
    // Nombre del paquete de la app
    private String packageName;

    @Override
    public void onCreate() {
        super.onCreate();
        
        // Guardar nombre del paquete
        packageName = getPackageName();
        
        // Inicializar Firebase
        db = FirebaseFirestore.getInstance();
        
        // Obtener IDs
        obtenerIdsLocales();
        
        // Notificación
        NotificationUtils.createNotificationChannel(this);
        
        // Inicializar Firebase Blocker
        blockerManager = FirebaseBlockerManager.getInstance();
        blockerManager.startListening(this);
        
        // Log inicial
        logToFirebase("VPN_SERVICE_START", "Servicio VPN iniciado. Paquete: " + packageName);
        
        SimpleLogger.i("VPN Service - Inicializado con Firebase Blocker. Paquete: " + packageName);
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

    private void logToFirebase(String tipo, String mensaje) {
        try {
            if (deviceId == null) return;
            
            Map<String, Object> logEntry = new HashMap<>();
            logEntry.put("tipo", tipo);
            logEntry.put("mensaje", mensaje);
            logEntry.put("timestamp", FieldValue.serverTimestamp());
            logEntry.put("sitiosBloqueados", sitiosBloqueados != null ? sitiosBloqueados.size() : 0);
            
            db.collection("dispositivos")
                .document(deviceId)
                .collection("vpn_logs")
                .add(logEntry);
        } catch (Exception e) {
            // Ignorar errores de log
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_VPN.equals(intent.getAction())) {
            SimpleLogger.w("VPN Service - Recibida orden de detención");
            logToFirebase("VPN_STOP", "Recibida orden de detención");
            stopVpn();
            return START_NOT_STICKY;
        }

        if (!isRunning.get()) {
            SimpleLogger.i("VPN Service - Iniciando hilo de túnel");
            logToFirebase("VPN_START", "Iniciando VPN con " + (sitiosBloqueados != null ? sitiosBloqueados.size() : 0) + " sitios bloqueados");
            isRunning.set(true);
            vpnThread = new Thread(this::runVpn, "VpnThread");
            vpnThread.start();
            
            startForeground(101, createNotification());
        }

        return START_STICKY;
    }

    private void runVpn() {
        SimpleLogger.i("VPN Service - Configurando interfaz de red");
        logToFirebase("VPN_CONFIG", "Configurando interfaz de red");
        
        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro VPN");
            builder.addAddress(VPN_ADDRESS, 32);
            builder.addRoute("0.0.0.0", 0);
            builder.setMtu(VPN_MTU);
            
            // Añadir DNS
            builder.addDnsServer(DNS1);
            builder.addDnsServer(DNS2);

            // EXCLUIR NUESTRA APP
            try {
                builder.addDisallowedApplication(packageName);
                SimpleLogger.i("VPN Service - ✅ App EXCLUIDA: " + packageName);
                logToFirebase("VPN_EXCLUSION", "App excluida: " + packageName);
                
                // También excluir servicios de Google Play
                try {
                    builder.addDisallowedApplication("com.google.android.gms");
                } catch (Exception e) {
                    // Ignorar
                }
                
            } catch (PackageManager.NameNotFoundException e) {
                SimpleLogger.e("VPN Service - ❌ Error al excluir paquete: " + e.getMessage());
                logToFirebase("VPN_ERROR", "Error exclusión: " + e.getMessage());
            }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - No se pudo establecer la interfaz");
                logToFirebase("VPN_ERROR", "No se pudo establecer interfaz");
                return;
            }

            SimpleLogger.i("VPN Service - ✅ Interfaz VPN establecida correctamente");
            logToFirebase("VPN_SUCCESS", "Interfaz establecida. DNS: " + DNS1 + ", " + DNS2);

            ByteBuffer packet = ByteBuffer.allocate(32767);
            byte[] packetArray = packet.array();
            
            try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
                 FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {
                
                int packetCount = 0;
                int blockedCount = 0;
                long startTime = System.currentTimeMillis();
                
                SimpleLogger.i("VPN Service - Túnel iniciado, reenviando tráfico...");
                logToFirebase("VPN_RUNNING", "Túnel iniciado. MTU: " + VPN_MTU);

                while (isRunning.get() && !Thread.interrupted()) {
                    int length = in.read(packetArray);
                    if (length > 0) {
                        packet.limit(length);
                        
                        // Verificar si debe bloquearse
                        if (debeBloquearPaquete(packetArray, length)) {
                            blockedCount++;
                            if (blockedCount % 50 == 0) {
                                SimpleLogger.d("VPN Service - Paquetes bloqueados: " + blockedCount);
                            }
                        } else {
                            // REENVIAR EL PAQUETE
                            out.write(packetArray, 0, length);
                            out.flush();
                            packetCount++;
                            
                            if (packetCount % 500 == 0) {
                                SimpleLogger.d("VPN Service - Tráfico permitido: " + packetCount + " paquetes");
                            }
                        }
                    }
                    packet.clear();
                    
                    // Log cada 30 segundos
                    if (System.currentTimeMillis() - startTime > 30000) {
                        logToFirebase("VPN_STATS", "Paquetes: permitidos=" + packetCount + ", bloqueados=" + blockedCount);
                        startTime = System.currentTimeMillis();
                    }
                }
            } catch (IOException e) {
                SimpleLogger.e("VPN Service - Error de E/S: " + e.getMessage());
                logToFirebase("VPN_IO_ERROR", e.getMessage());
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error en el bucle de red: " + e.getMessage());
            logToFirebase("VPN_FATAL_ERROR", e.getMessage());
            e.printStackTrace();
        } finally {
            stopVpn();
        }
    }

    private boolean debeBloquearPaquete(byte[] packet, int length) {
        // SI NO HAY SITIOS BLOQUEADOS, PERMITIR TODO
        if (sitiosBloqueados == null || sitiosBloqueados.isEmpty()) {
            // LOG IMPORTANTE PARA DIAGNÓSTICO
            SimpleLogger.d("🔥 MODO PERMISIVO: No hay sitios bloqueados, permitiendo TODO el tráfico");
            logToFirebase("MODO_PERMISIVO", "0 sitios bloqueados - Todo permitido");
            return false;
        }
        
        if (length < 10) {
            return false;
        }
        
        try {
            int analyzeLength = Math.min(length, 512);
            String packetContent = new String(packet, 0, analyzeLength).toLowerCase();
            
            // Buscar peticiones HTTP/HTTPS
            if (packetContent.contains("host:") || 
                packetContent.contains("get ") || 
                packetContent.contains("post ") ||
                packetContent.contains("http://") || 
                packetContent.contains("https://")) {
                
                for (String sitio : sitiosBloqueados) {
                    if (sitio != null && !sitio.isEmpty() && packetContent.contains(sitio.toLowerCase())) {
                        SimpleLogger.d("🚫 BLOQUEADO: " + sitio);
                        logToFirebase("BLOQUEO", "Sitio bloqueado: " + sitio);
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            // Ignorar errores
        }
        
        return false;
    }

    @Override
    public void onBlockedSitesUpdated(Set<String> sitios) {
        this.sitiosBloqueados = sitios;
        int count = sitios != null ? sitios.size() : 0;
        SimpleLogger.i("📋 Lista actualizada: " + count + " sitios");
        logToFirebase("SITIOS_ACTUALIZADOS", "Nueva lista: " + count + " sitios");
        
        if (count == 0) {
            SimpleLogger.w("⚠️ ATENCIÓN: 0 sitios bloqueados - VPN permitirá todo");
            logToFirebase("SIN_BLOQUEOS", "0 sitios bloqueados - Modo permisivo");
        } else {
            for (String sitio : sitios) {
                SimpleLogger.d("📌 Sitio: " + sitio);
            }
        }
    }

    private void stopVpn() {
        if (!isRunning.get() && vpnInterface == null) return;

        isRunning.set(false);
        SimpleLogger.i("VPN Service - Cerrando túnel");
        logToFirebase("VPN_STOPPED", "Cerrando túnel VPN");

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
        logToFirebase("VPN_REVOKED", "Permiso de VPN revocado por el usuario");
        stopVpn();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        logToFirebase("VPN_DESTROY", "Servicio destruido");
        stopVpn();
        super.onDestroy();
    }
}