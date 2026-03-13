package com.educontrolpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import org.xbill.DNS.Message;
import org.xbill.DNS.Record;
import org.xbill.DNS.Section;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class ParentalControlVpnService extends VpnService implements Runnable {

    private static final String TAG = "ParentalControlVpn";
    private static final String CHANNEL_ID = "vpn_service_channel";
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private Thread vpnThread;
    private ParcelFileDescriptor vpnInterface;
    private final HashSet<String> blacklist = new HashSet<>();
    private final List<String> urlHistory = new ArrayList<>();
    private FirebaseHelper firebaseHelper;

    @Override
    public void onCreate() {
        super.onCreate();
        // Inicializar Helper de Firebase pasando este servicio como contexto
        firebaseHelper = new FirebaseHelper(this);
        
        // Bloqueos de emergencia iniciales
        synchronized (blacklist) {
            blacklist.add("facebook.com");
            blacklist.add("tiktok.com");
            blacklist.add("instagram.com");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_START_VPN.equals(action)) {
                createNotificationChannel();
                startForeground(1, getNotification());
                SimpleLogger.i("VPN: Iniciando servicio en primer plano");
                setupVpn();
            } else if (ACTION_STOP_VPN.equals(action)) {
                SimpleLogger.w("VPN: Deteniendo servicio");
                stopVpn();
            }
        }
        return START_STICKY;
    }

    private void setupVpn() {
        if (vpnInterface != null) return;

        // Disparar sincronización con Firestore
        firebaseHelper.syncBlacklist();

        try {
            Builder builder = new Builder();
            builder.setSession("EduControlPro")
                   .addAddress("10.0.0.2", 32)
                   .addDnsServer("1.1.1.3") // DNS Cloudflare Families
                   .addDnsServer("1.0.0.3")
                   .addRoute("0.0.0.0", 0) 
                   .setBlocking(true);

            vpnInterface = builder.establish();
            
            if (vpnInterface != null) {
                SimpleLogger.i("VPN: Túnel establecido correctamente.");
                vpnThread = new Thread(this, "ParentalControlVpnThread");
                vpnThread.start();
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN Error: " + e.getMessage());
        }
    }

    // Método que llama FirebaseHelper tras bajar los datos de Firestore
    public void updateBlacklist(Set<String> newDomains) {
        synchronized (blacklist) {
            blacklist.clear();
            blacklist.addAll(newDomains);
            // Re-añadir críticos por seguridad
            blacklist.add("facebook.com");
            blacklist.add("tiktok.com");
        }
        SimpleLogger.i("VPN: Memoria actualizada con " + newDomains.size() + " dominios de la nube.");
    }

    private void stopVpn() {
        if (vpnThread != null) vpnThread.interrupt();
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (IOException e) {
            SimpleLogger.e("VPN Stop Error: " + e.getMessage());
        }
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void run() {
        try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
             FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {

            byte[] packet = new byte[32767];
            while (!Thread.interrupted()) {
                int length = in.read(packet);
                if (length > 0) {
                    String domain = extractDomain(packet, length);

                    if (domain != null) {
                        updateUrlHistory(domain);

                        if (isDomainBlocked(domain)) {
                            SimpleLogger.w("BLOQUEO DNS: " + domain);
                            firebaseHelper.reportBlockAttempt(domain);
                            continue; // Descarta el paquete (bloquea el acceso)
                        }
                    }
                    out.write(packet, 0, length);
                }
            }
        } catch (IOException e) {
            SimpleLogger.e("VPN Loop Error: " + e.getMessage());
        }
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

    private String extractDomain(byte[] packet, int length) {
        try {
            int dnsOffset = 28; 
            if (length <= dnsOffset) return null;

            byte[] dnsData = new byte[length - dnsOffset];
            System.arraycopy(packet, dnsOffset, dnsData, 0, dnsData.length);

            Message msg = new Message(dnsData);
            Record[] records = msg.getSectionArray(Section.QUESTION);
            if (records.length > 0) {
                return records[0].getName().toString(true).toLowerCase();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private void updateUrlHistory(String domain) {
        synchronized (urlHistory) {
            if (!urlHistory.isEmpty() && urlHistory.get(0).equals(domain)) return;
            urlHistory.add(0, domain);
            if (urlHistory.size() > 20) urlHistory.remove(urlHistory.size() - 1);
            Log.d(TAG, "Tráfico: " + domain);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID, "Servicio de Protección", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EduControlPro Activo")
                .setContentText("Filtrado de contenido en ejecución")
                .setSmallIcon(android.R.drawable.ic_lock_lock) // Icono estándar de candado
                .setOngoing(true)
                .build();
    }
    
    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
        
    }
}