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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Servicio VPN – Versión mínima que solo reenvía todo el tráfico.
 * Sin filtros, para diagnosticar problemas de conectividad.
 */
public class ParentalControlVpnService extends VpnService {

    private static final String TAG = "VpnService";
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_MTU = 1500;

    private static final String DNS1 = "8.8.8.8";
    private static final String DNS2 = "1.1.1.1";

    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private Thread vpnThread;
    private String packageName;

    @Override
    public void onCreate() {
        super.onCreate();
        packageName = getPackageName();
        NotificationUtils.createNotificationChannel(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_VPN.equals(intent.getAction())) {
            stopVpn();
            return START_NOT_STICKY;
        }

        if (!isRunning.get()) {
            isRunning.set(true);
            vpnThread = new Thread(this::runVpn, "VpnThread");
            vpnThread.start();
            startForeground(101, createNotification());
        }
        return START_STICKY;
    }

    private void runVpn() {
        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro VPN");
            builder.setMtu(VPN_MTU);
            builder.addAddress(VPN_ADDRESS, 32);
            builder.addRoute("0.0.0.0", 0);
            builder.addDnsServer(DNS1);
            builder.addDnsServer(DNS2);

            // Excluir nuestra app (opcional, puede causar bug)
            try {
                builder.addDisallowedApplication(packageName);
            } catch (PackageManager.NameNotFoundException e) {
                // ignorar
            }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                return;
            }

            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());

            byte[] packet = new byte[32767];

            while (isRunning.get() && !Thread.interrupted()) {
                int length = in.read(packet);
                if (length > 0) {
                    // REENVÍO PURO – SIN FILTROS
                    out.write(packet, 0, length);
                    out.flush();
                }
            }
        } catch (IOException e) {
            // Error de E/S, probablemente túnel cerrado
        } catch (Exception e) {
            // Otros errores
        } finally {
            stopVpn();
        }
    }

    private void stopVpn() {
        if (!isRunning.getAndSet(false) && vpnInterface == null) return;

        if (vpnThread != null) {
            vpnThread.interrupt();
            try {
                vpnThread.join(1000);
            } catch (InterruptedException ignored) {}
            vpnThread = null;
        }

        if (vpnInterface != null) {
            try {
                vpnInterface.close();
            } catch (IOException ignored) {}
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
                .setContentTitle("EduControlPro")
                .setContentText("VPN activa (modo diagnóstico)")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    @Override
    public void onRevoke() {
        stopVpn();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }
}