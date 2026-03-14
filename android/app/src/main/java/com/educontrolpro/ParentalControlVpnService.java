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
    private static final int VPN_MTU = 1280;
    
    // Acciones para el Intent
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private Thread vpnThread;
    
    // Firebase Blocker
    private FirebaseBlockerManager blockerManager;
    private Set<String> sitiosBloqueados = new HashSet<>();

    @Override
    public void onCreate() {
        super.onCreate();
        // Notificación
        NotificationUtils.createNotificationChannel(this);
        
        // Inicializar Firebase Blocker
        blockerManager = FirebaseBlockerManager.getInstance();
        blockerManager.startListening(this);
        
        SimpleLogger.i("VPN Service - Inicializado con Firebase Blocker");
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

            // Excluir nuestra app
            try {
                builder.addDisallowedApplication(getPackageName());
                SimpleLogger.i("VPN Service - Exclusión exitosa: " + getPackageName());
            } catch (PackageManager.NameNotFoundException e) {
                SimpleLogger.e("VPN Service - Error al excluir paquete: " + e.getMessage());
            }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - No se pudo establecer la interfaz");
                return;
            }

            ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
            byte[] packetArray = packet.array();
            
            try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
                 FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {
                
                int packetCount = 0;
                int blockedCount = 0;

                while (isRunning.get() && !Thread.interrupted()) {
                    int length = in.read(packetArray);
                    if (length > 0) {
                        if (debeBloquearPaquete(packetArray, length)) {
                            blockedCount++;
                            if (blockedCount % 100 == 0) {
                                SimpleLogger.d("VPN Service - Paquetes bloqueados: " + blockedCount);
                            }
                        } else {
                            out.write(packetArray, 0, length);
                            packetCount++;
                            
                            if (packetCount % 5000 == 0) {
                                SimpleLogger.d("VPN Service - Tráfico permitido: " + packetCount + " paquetes");
                            }
                        }
                    }
                    packet.clear();
                }
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error en el bucle de red: " + e.getMessage());
        } finally {
            stopVpn();
        }
    }

    private boolean debeBloquearPaquete(byte[] packet, int length) {
        if (sitiosBloqueados.isEmpty() || length < 10) {
            return false;
        }
        
        try {
            int analyzeLength = Math.min(length, 500);
            String packetContent = new String(packet, 0, analyzeLength).toLowerCase();
            
            if (packetContent.contains("http://") || packetContent.contains("https://") || 
                packetContent.contains("host:")) {
                
                for (String sitio : sitiosBloqueados) {
                    if (packetContent.contains(sitio)) {
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
        SimpleLogger.i("📋 Lista actualizada: " + sitios.size() + " sitios");
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
                .setContentText("Filtrado activo - " + sitiosBloqueados.size() + " sitios bloqueados")
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