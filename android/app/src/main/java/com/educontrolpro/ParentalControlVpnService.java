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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Servicio de VPN en modo puente para EduControlPro.
 * Excluye la propia aplicación para permitir reportes a Firestore sin bucles.
 */
public class ParentalControlVpnService extends VpnService {
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_MTU = 1280;
    
    // Acciones para el Intent
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private Thread vpnThread;

    @Override
    public void onCreate() {
        super.onCreate();
        // Creamos el canal de notificación (obligatorio para Android 8+)
        NotificationUtils.createNotificationChannel(this);
        SimpleLogger.i("VPN Service - Inicializado");
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
            
            // Iniciamos como servicio de primer plano
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
            builder.addRoute("0.0.0.0", 0); // Captura todo el tráfico saliente
            builder.setMtu(VPN_MTU);

            // --- EXCLUSIÓN DE LA APP (CRÍTICO) ---
            try {
                builder.addDisallowedApplication(getPackageName());
                SimpleLogger.i("VPN Service - Exclusión exitosa: " + getPackageName());
            } catch (PackageManager.NameNotFoundException e) {
                SimpleLogger.e("VPN Service - Error al excluir paquete: " + e.getMessage());
            }

            // Establecer la interfaz
            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - No se pudo establecer la interfaz (posible conflicto)");
                return;
            }

            // Flujo de datos (Puente Simple)
            try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
                 FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {
                
                ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
                int packetCount = 0;

                while (isRunning.get() && !Thread.interrupted()) {
                    int length = in.read(packet.array());
                    if (length > 0) {
                        // Reenvío de datos sin inspección (Modo Puente)
                        out.write(packet.array(), 0, length);
                        packetCount++;
                        
                        if (packetCount % 5000 == 0) {
                            SimpleLogger.d("VPN Service - Tráfico activo: " + packetCount + " paquetes procesados");
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

    private void stopVpn() {
        if (!isRunning.get() && vpnInterface == null) return;

        isRunning.set(false);
        SimpleLogger.i("VPN Service - Cerrando túnel y deteniendo servicio");

        if (vpnThread != null) {
            vpnThread.interrupt();
            vpnThread = null;
        }

        if (vpnInterface != null) {
            try {
                vpnInterface.close();
            } catch (IOException e) {
                SimpleLogger.e("VPN Service - Error al cerrar ParcelFileDescriptor: " + e.getMessage());
            }
            vpnInterface = null;
        }

        stopForeground(true);
        stopSelf();
    }

    private Notification createNotification() {
        // El intent ahora apunta a MainActivity para que al tocar la notificación abra la app
        Intent intent = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_IMMUTABLE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_UPDATE_CURRENT;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("EduControlPro Activo")
                .setContentText("Filtrado de contenido en ejecución")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
    }

    @Override
    public void onRevoke() {
        SimpleLogger.w("VPN Service - El usuario o el sistema revocó el permiso de VPN");
        stopVpn();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }
}