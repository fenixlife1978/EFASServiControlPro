package com.educontrolpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.firestore.FirebaseFirestore;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class EduVpnService extends VpnService {

    private static final String TAG = "EDU_Vpn";
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final String VPN_ROUTE = "0.0.0.0";
    private static final int DNS_PORT = 53;
    private static final int NOTIFICATION_ID = 2;
    private static final String CHANNEL_ID = "VPN_CHANNEL";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private boolean isRunning = false;
    private boolean vpnEnabled = false;

    private Set<String> blacklist = new HashSet<>();

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private com.google.firebase.firestore.ListenerRegistration blacklistListener;
    private com.google.firebase.firestore.ListenerRegistration vpnEnabledListener;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Servicio VPN creado");
        createNotificationChannel();
        listenForBlacklistUpdates();
        listenForVpnEnabled();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP_VPN".equals(intent.getAction())) {
            stopVpn();
            return START_NOT_STICKY;
        }
        // No iniciar automáticamente, esperar a que el listener lo haga
        return START_STICKY;
    }

    private void startVpn() {
        if (isRunning) return;
        if (!vpnEnabled) {
            Log.d(TAG, "VPN no habilitada, no se inicia");
            return;
        }

        try {
            Builder builder = new Builder();
            builder.setSession("EDUControlPro VPN");

            // Convertir direcciones a InetAddress
            InetAddress vpnAddr = InetAddress.getByName(VPN_ADDRESS);
            builder.addAddress(vpnAddr, 32);

            InetAddress routeAddr = InetAddress.getByName(VPN_ROUTE);
            builder.addRoute(routeAddr, 0);

            builder.addDnsServer(InetAddress.getByName("8.8.8.8"));
            builder.addDnsServer(InetAddress.getByName("1.1.1.1"));

            builder.setBlocking(true);
            builder.setMtu(1500);

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "Error: No se pudo establecer la VPN");
                return;
            }

            startForeground(NOTIFICATION_ID, getNotification());

            isRunning = true;
            Log.d(TAG, "VPN iniciada correctamente");

            executorService = Executors.newSingleThreadExecutor();
            executorService.submit(this::processVpn);

        } catch (UnknownHostException e) {
            Log.e(TAG, "Dirección IP inválida", e);
            isRunning = false;
        } catch (Exception e) {
            Log.e(TAG, "Error iniciando VPN", e);
            isRunning = false;
        }
    }

    private void processVpn() {
        Log.d(TAG, "Hilo de procesamiento VPN iniciado");

        FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
        FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());

        byte[] packet = new byte[32767];
        java.nio.ByteBuffer buffer = java.nio.ByteBuffer.wrap(packet);

        while (isRunning) {
            try {
                int length = in.read(packet);
                if (length < 0) break;

                buffer.position(0);
                buffer.limit(length);

                if (isDnsPacket(packet, length)) {
                    String domain = extractDomainFromDns(packet, length);
                    if (domain != null) {
                        Log.d(TAG, "Consulta DNS para: " + domain);
                        if (isBlocked(domain)) {
                            Log.d(TAG, "⛔ Dominio bloqueado: " + domain);
                            continue;
                        } else {
                            Log.d(TAG, "✅ Dominio permitido: " + domain);
                        }
                    }
                }

                out.write(packet, 0, length);

            } catch (Exception e) {
                Log.e(TAG, "Error procesando paquete", e);
                break;
            }
        }
    }

    private boolean isDnsPacket(byte[] packet, int length) {
        if (length < 20) return false;
        int version = (packet[0] >> 4) & 0x0F;
        if (version != 4) return false;
        int protocol = packet[9] & 0xFF;
        if (protocol != 17) return false;
        int totalLength = ((packet[2] & 0xFF) << 8) | (packet[3] & 0xFF);
        if (totalLength > length) return false;
        int headerLength = (packet[0] & 0x0F) * 4;
        int udpStart = headerLength;
        int destPort = ((packet[udpStart + 2] & 0xFF) << 8) | (packet[udpStart + 3] & 0xFF);
        return destPort == DNS_PORT;
    }

    private String extractDomainFromDns(byte[] packet, int length) {
        try {
            int headerLength = (packet[0] & 0x0F) * 4;
            int udpStart = headerLength;
            int dnsStart = udpStart + 8;
            int flags = ((packet[dnsStart + 2] & 0xFF) << 8) | (packet[dnsStart + 3] & 0xFF);
            if ((flags & 0x8000) != 0) return null;
            int qdcount = ((packet[dnsStart + 4] & 0xFF) << 8) | (packet[dnsStart + 5] & 0xFF);
            if (qdcount == 0) return null;
            int pos = dnsStart + 12;
            StringBuilder domain = new StringBuilder();
            while (pos < length) {
                int len = packet[pos] & 0xFF;
                if (len == 0) break;
                pos++;
                if (pos + len > length) return null;
                if (domain.length() > 0) domain.append('.');
                for (int i = 0; i < len; i++) {
                    domain.append((char) packet[pos + i]);
                }
                pos += len;
            }
            return domain.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error extrayendo dominio", e);
            return null;
        }
    }

    private boolean isBlocked(String domain) {
        String lowerDomain = domain.toLowerCase();
        for (String blocked : blacklist) {
            if (lowerDomain.endsWith("." + blocked) || lowerDomain.equals(blocked)) {
                return true;
            }
        }
        return false;
    }

    private void listenForBlacklistUpdates() {
        String institutoId = getSharedPreferences("CapacitorStorage", MODE_PRIVATE)
                .getString("InstitutoId", null);
        if (institutoId == null) return;

        blacklistListener = db.collection("institutions").document(institutoId)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        Log.e(TAG, "Error escuchando blacklist", error);
                        return;
                    }
                    if (snapshot != null && snapshot.exists()) {
                        List<String> newBlacklist = (List<String>) snapshot.get("blacklist");
                        if (newBlacklist != null) {
                            blacklist.clear();
                            blacklist.addAll(newBlacklist);
                            Log.d(TAG, "Lista negra actualizada: " + blacklist.size() + " dominios");
                        }
                    }
                });
    }

    private void listenForVpnEnabled() {
        String institutoId = getSharedPreferences("CapacitorStorage", MODE_PRIVATE)
                .getString("InstitutoId", null);
        if (institutoId == null) return;

        vpnEnabledListener = db.collection("institutions").document(institutoId)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        Log.e(TAG, "Error escuchando vpn_enabled", error);
                        return;
                    }
                    if (snapshot != null && snapshot.exists()) {
                        Boolean enabled = snapshot.getBoolean("vpn_enabled");
                        if (enabled != null) {
                            vpnEnabled = enabled;
                            Log.d(TAG, "VPN enabled: " + vpnEnabled);
                            if (vpnEnabled && !isRunning) {
                                startVpn();
                            } else if (!vpnEnabled && isRunning) {
                                stopVpn();
                            }
                        }
                    }
                });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Servicio VPN",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification getNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro VPN")
                .setContentText("Protegiendo la navegación")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    private void stopVpn() {
        isRunning = false;
        if (executorService != null) {
            executorService.shutdown();
        }
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error cerrando interfaz VPN", e);
        }
        stopForeground(true);
        Log.d(TAG, "VPN detenida");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (blacklistListener != null) blacklistListener.remove();
        if (vpnEnabledListener != null) vpnEnabledListener.remove();
        stopVpn();
    }
}