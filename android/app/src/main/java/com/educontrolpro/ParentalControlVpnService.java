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
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

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
    
    // Nombre del paquete de la app (para excluirla)
    private String packageName;

    @Override
    public void onCreate() {
        super.onCreate();
        
        // Guardar nombre del paquete
        packageName = getPackageName();
        
        // Notificación
        NotificationUtils.createNotificationChannel(this);
        
        // Inicializar Firebase Blocker
        blockerManager = FirebaseBlockerManager.getInstance();
        blockerManager.startListening(this);
        
        SimpleLogger.i("VPN Service - Inicializado con Firebase Blocker. Paquete: " + packageName);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_VPN.equals(intent.getAction())) {
            SimpleLogger.w("VPN Service - Recibida orden de detención");
            stopVpn();
            return START_NOT_STICKY;
        }

        if (!isRunning.get()) {
            SimpleLogger.i("VPN Service - Iniciando hilo de túnel");
            isRunning.set(true);
            vpnThread = new Thread(this::runVpn, "VpnThread");
            vpnThread.start();
            
            startForeground(101, createNotification());
        }

        return START_STICKY;
    }

    private void runVpn() {
        SimpleLogger.i("VPN Service - Configurando interfaz de red");
        
        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro VPN");
            builder.addAddress(VPN_ADDRESS, 32);
            builder.addRoute("0.0.0.0", 0);
            builder.setMtu(VPN_MTU);
            
            // Añadir DNS
            builder.addDnsServer(DNS1);
            builder.addDnsServer(DNS2);

            // EXCLUIR NUESTRA APP - PARTE CRÍTICA CORREGIDA
            try {
                // Usar el package name guardado
                builder.addDisallowedApplication(packageName);
                SimpleLogger.i("VPN Service - ✅ App EXCLUIDA: " + packageName);
                
                // También excluir servicios de Google Play para evitar problemas
                try {
                    builder.addDisallowedApplication("com.google.android.gms");
                } catch (Exception e) {
                    // Ignorar, no es crítico
                }
                
            } catch (PackageManager.NameNotFoundException e) {
                SimpleLogger.e("VPN Service - ❌ Error al excluir paquete: " + e.getMessage());
                // Intentar con el nombre hardcodeado como fallback
                try {
                    builder.addDisallowedApplication("com.educontrolpro");
                    SimpleLogger.i("VPN Service - Exclusión con hardcode: com.educontrolpro");
                } catch (Exception e2) {
                    SimpleLogger.e("VPN Service - Error también con hardcode");
                }
            }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - No se pudo establecer la interfaz");
                return;
            }

            SimpleLogger.i("VPN Service - ✅ Interfaz VPN establecida correctamente");

            ByteBuffer packet = ByteBuffer.allocate(32767);
            byte[] packetArray = packet.array();
            
            try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
                 FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {
                
                int packetCount = 0;
                int blockedCount = 0;
                
                SimpleLogger.i("VPN Service - Túnel iniciado, reenviando tráfico...");

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
                }
            } catch (IOException e) {
                SimpleLogger.e("VPN Service - Error de E/S: " + e.getMessage());
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error en el bucle de red: " + e.getMessage());
            e.printStackTrace();
        } finally {
            stopVpn();
        }
    }

    private boolean debeBloquearPaquete(byte[] packet, int length) {
        // SI NO HAY SITIOS BLOQUEADOS, PERMITIR TODO
        if (sitiosBloqueados == null || sitiosBloqueados.isEmpty()) {
            return false; // ← IMPORTANTE: permitir todo si no hay lista
        }
        
        if (length < 10) {
            return false;
        }
        
        try {
            // Analizar solo los primeros bytes
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
        SimpleLogger.i("📋 Lista actualizada: " + (sitios != null ? sitios.size() : 0) + " sitios");
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
    }

    private Notification createNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_IMMUTABLE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_UPDATE_CURRENT;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("EduControlPro Activo")
                .setContentText("Filtrado activo - " + (sitiosBloqueados != null ? sitiosBloqueados.size() : 0) + " sitios bloqueados")
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