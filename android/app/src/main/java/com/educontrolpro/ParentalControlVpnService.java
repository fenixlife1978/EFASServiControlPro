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
        
        // Listener en tiempo real desde Firebase
        firebaseHelper.listenForConfigChanges(new FirebaseHelper.ConfigListener() {
            @Override
            public void onBlacklistUpdated(Set<String> newBlacklist) {
                updateBlacklist(newBlacklist);
            }
        });

        // Bloqueos de seguridad persistentes
        synchronized (blacklist) {
            blacklist.add("facebook.com");
            blacklist.add("tiktok.com");
            blacklist.add("instagram.com");
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
            stopSelf();
        }
        return START_STICKY;
    }

    private void setupVpn() {
        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro")
                    .setMtu(1500) // MTU estándar para evitar fragmentación de paquetes
                    .addAddress("10.0.0.2", 32);

            // Ruteamos SOLAMENTE el tráfico DNS (puerto 53) para no ralentizar la tablet
            // Al agregar estas rutas específicas, el tráfico normal (HTTP/Video) no pasa por el túnel
            builder.addRoute("8.8.8.8", 32);
            builder.addRoute("1.1.1.1", 32);
            builder.addDnsServer("8.8.8.8");
            builder.addDnsServer("1.1.1.1");

            // Excluir la app para que Firebase y el Logger funcionen fuera del túnel
            builder.addDisallowedApplication(getPackageName());

            vpnInterface = builder.establish();
            
            if (vpnInterface != null) {
                isRunning.set(true);
                vpnThread = new Thread(this, "VpnThread");
                vpnThread.start();
                SimpleLogger.i("VPN: Escudo DNS levantado.");
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN: Error crítico en setup: " + e.getMessage());
        }
    }

    @Override
    public void run() {
        // Usamos descriptores de archivo para lectura/escritura nativa
        try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
             FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {

            byte[] packet = new byte[32767];
            
            while (isRunning.get() && !Thread.interrupted()) {
                int length = in.read(packet);
                if (length > 0) {
                    String domain = extractDomain(packet, length);

                    if (domain != null && isDomainBlocked(domain)) {
                        SimpleLogger.w("Bloqueo DNS: " + domain);
                        firebaseHelper.reportBlockAttempt(domain);
                        // No escribimos el paquete en 'out', matando la solicitud
                        continue; 
                    }
                    
                    // Reenviar paquete legítimo
                    out.write(packet, 0, length);
                }
            }
        } catch (IOException e) {
            if (isRunning.get()) {
                SimpleLogger.e("VPN: Error de flujo: " + e.getMessage());
            }
        } finally {
            cleanup();
        }
    }

    private String extractDomain(byte[] packet, int length) {
        try {
            // Verificación rápida: ¿Es IPv4?
            if ((packet[0] & 0xf0) != 0x40) return null;

            int ipHeaderLength = (packet[0] & 0x0f) * 4;
            // ¿Es UDP?
            if (packet[9] != 17) return null;

            // ¿Es Puerto 53?
            int destPort = ((packet[ipHeaderLength + 2] & 0xff) << 8) | (packet[ipHeaderLength + 3] & 0xff);
            if (destPort != 53) return null;

            int dnsOffset = ipHeaderLength + 8;
            int dnsLength = length - dnsOffset;
            if (dnsLength <= 0) return null;

            byte[] dnsData = new byte[dnsLength];
            System.arraycopy(packet, dnsOffset, dnsData, 0, dnsLength);

            Message msg = new Message(dnsData);
            Record[] records = msg.getSectionArray(Section.QUESTION);
            if (records != null && records.length > 0) {
                return records[0].getName().toString(true).toLowerCase();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean isDomainBlocked(String domain) {
        if (domain == null) return false;
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
                    CHANNEL_ID, "Servicio de Red", NotificationManager.IMPORTANCE_MIN);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Protección de Red")
                .setContentText("Filtrado de contenido educativo activo")
                .setSmallIcon(android.R.drawable.ic_lock_power_off) // Icono discreto
                .setPriority(NotificationCompat.PRIORITY_MIN) // Silenciosa
                .setOngoing(true)
                .build();

        startForeground(2, notification); // ID 2 para no chocar con MonitorService
    }

    public void updateBlacklist(Set<String> newDomains) {
        synchronized (blacklist) {
            blacklist.clear();
            blacklist.addAll(newDomains);
        }
    }

    private void cleanup() {
        isRunning.set(false);
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception e) {
            SimpleLogger.e("Error cerrando VPN: " + e.getMessage());
        }
    }

    private void stopVpn() {
        cleanup();
        if (vpnThread != null) vpnThread.interrupt();
        stopForeground(true);
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }
}