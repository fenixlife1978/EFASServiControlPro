package com.educontrolpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import androidx.core.app.NotificationCompat;

import org.xbill.DNS.Message;
import org.xbill.DNS.Record;
import org.xbill.DNS.Section;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

public class ParentalControlVpnService extends VpnService implements Runnable {

    private static final String TAG = "ParentalControlVpn";
    private static final String CHANNEL_ID = "vpn_service_channel";
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private Thread vpnThread;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final Set<String> blacklist = new HashSet<>();
    private FirebaseHelper firebaseHelper;

    @Override
    public void onCreate() {
        super.onCreate();
        firebaseHelper = new FirebaseHelper(this);
        // Bloqueos de prueba iniciales
        synchronized (blacklist) {
            blacklist.add("facebook.com");
            blacklist.add("tiktok.com");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_START_VPN.equals(intent.getAction())) {
            if (!isRunning.get()) {
                iniciarForeground();
                setupVpn();
            }
        } else if (intent != null && ACTION_STOP_VPN.equals(intent.getAction())) {
            stopVpn();
        }
        return START_STICKY;
    }

    private void setupVpn() {
        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro")
                   .setMtu(1280)
                   .addAddress("10.0.0.2", 32);

            // LA CLAVE DEL ÉXITO: Solo interceptamos el tráfico DNS (8.8.8.8)
            // Esto permite que el resto del internet (YouTube, Google, etc) 
            // funcione por fuera del túnel, evitando que la app se quede sin red.
            builder.addRoute("8.8.8.8", 32);
            builder.addDnsServer("8.8.8.8");

            // Excluir la propia app para que pueda hablar con Firebase
            try {
                builder.addDisallowedApplication(getPackageName());
            } catch (Exception e) {
                SimpleLogger.e("Error excluyendo app: " + e.getMessage());
            }

            vpnInterface = builder.establish();
            
            if (vpnInterface != null) {
                isRunning.set(true);
                vpnThread = new Thread(this, "VpnThread");
                vpnThread.start();
                SimpleLogger.i("VPN: Túnel establecido (Modo Selectivo)");
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN: Error al establecer: " + e.getMessage());
        }
    }

    @Override
    public void run() {
        try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
             FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {

            byte[] packet = new byte[32767];
            while (isRunning.get() && !Thread.interrupted()) {
                int length = in.read(packet);
                if (length > 0) {
                    String domain = extractDomain(packet, length);

                    if (domain != null && isDomainBlocked(domain)) {
                        SimpleLogger.i("🚫 BLOQUEADO: " + domain);
                        firebaseHelper.reportBlockAttempt(domain);
                        continue; // No devolvemos el paquete = Bloqueo
                    }
                    
                    // Si no es bloqueado, lo dejamos pasar
                    out.write(packet, 0, length);
                }
            }
        } catch (IOException e) {
            SimpleLogger.e("VPN: Error en el hilo: " + e.getMessage());
        } finally {
            stopVpn();
        }
    }

    private String extractDomain(byte[] packet, int length) {
        try {
            // Offset DNS estándar (IP 20 + UDP 8)
            int dnsOffset = 28;
            if (length <= dnsOffset) return null;

            byte[] dnsData = new byte[length - dnsOffset];
            System.arraycopy(packet, dnsOffset, dnsData, 0, dnsData.length);

            // Usamos dnsjava 3.5.3 que ya está en tu carpeta libs
            Message msg = new Message(dnsData);
            Record[] records = msg.getSectionArray(Section.QUESTION);
            if (records != null && records.length > 0) {
                return records[0].getName().toString(true).toLowerCase();
            }
        } catch (Exception e) {
            // No es un paquete DNS válido, se ignora
        }
        return null;
    }

    private boolean isDomainBlocked(String domain) {
        synchronized (blacklist) {
            for (String blocked : blacklist) {
                if (domain.equals(blocked) || domain.endsWith("." + blocked)) {
                    return true;
                }
            }
        }
        return false;
    }

    private void iniciarForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Seguridad EduControl", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EduControlPro Activo")
                .setContentText("Protección de navegación habilitada")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setOngoing(true)
                .build();

        startForeground(1, notification);
    }

    public void updateBlacklist(Set<String> newDomains) {
        synchronized (blacklist) {
            blacklist.clear();
            blacklist.addAll(newDomains);
        }
        SimpleLogger.i("Lista negra actualizada: " + newDomains.size() + " sitios.");
    }

    private void stopVpn() {
        isRunning.set(false);
        if (vpnThread != null) vpnThread.interrupt();
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception e) {
            SimpleLogger.e("Error cerrando VPN: " + e.getMessage());
        }
        stopForeground(true);
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
        
    }
}