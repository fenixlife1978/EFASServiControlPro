package com.educontrolpro;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
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

public class ParentalControlVpnService extends VpnService {

    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_MTU = 1280;

    public static final String ACTION_START_VPN = "com.educontrolpro.START_VPN";

    private ParcelFileDescriptor vpnInterface;
    private AtomicBoolean isRunning = new AtomicBoolean(false);
    private Thread vpnThread;

    @Override
    public void onCreate() {
        super.onCreate();
        SimpleLogger.i("VPN Service - Modo puente simple (sin inspección)");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SimpleLogger.i("VPN Service - Iniciando modo puente");
        
        if (!isRunning.get()) {
            isRunning.set(true);
            vpnThread = new Thread(this::runVpn, "VpnThread");
            vpnThread.start();
            startForeground(1, createNotification());
        }
        return START_STICKY;
    }

    private void runVpn() {
        SimpleLogger.i("VPN Service - Configurando túnel");
        
        try {
            Builder builder = new Builder();
            builder.setSession("EDUControl VPN");
            builder.addAddress(VPN_ADDRESS, 32);
            
            // Capturar TODO el tráfico (necesario para "bloquear conexiones sin VPN")
            builder.addRoute("0.0.0.0", 0);
            
            // Excluir nuestra app para evitar bucles
            try {
                builder.addDisallowedApplication(getPackageName());
                SimpleLogger.i("VPN Service - App excluida del túnel: " + getPackageName());
            } catch (Exception e) {
                SimpleLogger.e("Error excluyendo app: " + e.getMessage());
            }
            
            builder.setMtu(VPN_MTU);
            
            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - No se pudo establecer interfaz");
                stopVpn();
                return;
            }

            SimpleLogger.i("VPN Service - Túnel establecido, reenviando TODO el tráfico sin inspeccionar");
            
            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
            
            ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
            int packetCount = 0;
            
            while (isRunning.get() && !Thread.interrupted()) {
                packet.clear();
                int length = in.read(packet.array());
                if (length <= 0) continue;
                
                // REENVIAR TODO SIN INSPECCIONAR NI FILTRAR
                // El MonitorService (accesibilidad) se encarga de detectar y bloquear URLs
                out.write(packet.array(), 0, length);
                out.flush();
                
                packetCount++;
                if (packetCount % 5000 == 0) {
                    SimpleLogger.d("VPN Service - Paquetes reenviados: " + packetCount);
                }
            }
            
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error: " + e.getMessage());
        } finally {
            stopVpn();
        }
    }

    private void stopVpn() {
        SimpleLogger.i("VPN Service - Deteniendo");
        isRunning.set(false);
        
        if (vpnThread != null) {
            vpnThread.interrupt();
            try {
                vpnThread.join(1000);
            } catch (InterruptedException e) {
                // Ignorar
            }
            vpnThread = null;
        }
        
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception e) {
            SimpleLogger.e("Error cerrando interfaz: " + e.getMessage());
        }
        
        stopForeground(true);
        stopSelf();
    }

    private Notification createNotification() {
        Intent intent = new Intent(this, VpnController.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        
        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("EDUControl VPN")
                .setContentText("Modo puente - Bloqueo por MonitorService")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onRevoke() {
        SimpleLogger.i("VPN Service - Permisos revocados");
        stopVpn();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopVpn();
    }

    // Mantenemos este método por compatibilidad, pero ya no hace nada relevante
    public void updateBlacklist(Set<String> newBlacklist) {
        SimpleLogger.i("VPN Service - Lista negra ignorada (la maneja MonitorService)");
    }
}