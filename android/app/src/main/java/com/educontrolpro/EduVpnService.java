package com.educontrolpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.VpnService;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;

import com.google.firebase.firestore.FirebaseFirestore;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

public class EduVpnService extends VpnService {

    private static final String TAG = "EDU_Vpn";
    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final String VPN_ROUTE = "0.0.0.0";
    private static final int DNS_PORT = 53;
    private static final int NOTIFICATION_ID = 2;
    private static final String CHANNEL_ID = "VPN_CHANNEL";
    private static final String ACTION_START_VPN = "START_VPN";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private volatile boolean isRunning = false;
    private boolean vpnEnabled = false;

    private Set<String> blacklist = new HashSet<>();

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private com.google.firebase.firestore.ListenerRegistration blacklistListener;
    private com.google.firebase.firestore.ListenerRegistration vpnEnabledListener;

    private AtomicLong packetCount = new AtomicLong(0);
    private AtomicLong dnsQueryCount = new AtomicLong(0);

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Servicio VPN creado");
        createNotificationChannel();
        
        // Cargamos identidad antes de iniciar listeners
        iniciarConfiguracionFirestore();
    }

    private void iniciarConfiguracionFirestore() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        String institutoId = prefs.getString("InstitutoId", null);
        
        if (institutoId != null) {
            listenForBlacklistUpdates(institutoId);
            listenForVpnEnabled(institutoId);
        } else {
            Log.e(TAG, "No se encontró InstitutoId en SharedPreferences");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP_VPN".equals(action)) {
                stopVpn();
                return START_NOT_STICKY;
            } else if (ACTION_START_VPN.equals(action)) {
                startVpn(true);
                return START_STICKY;
            }
        }
        return START_STICKY;
    }

    private void startVpn(boolean force) {
        if (isRunning) return;
        
        // Si no es forzado y está apagado en Firestore, salimos
        if (!force && !vpnEnabled) return;

        try {
            Builder builder = new Builder();
            builder.setSession("EDUControlPro VPN");

            // Configuración crítica para que aparezca la "LLAVE"
            builder.addAddress(VPN_ADDRESS, 32);
            builder.addRoute(VPN_ROUTE, 0); // Esto captura TODO el tráfico IPv4
            
            // DNS redundante
            builder.addDnsServer("8.8.8.8");
            builder.addDnsServer("1.1.1.1");

            builder.setMtu(1280); // MTU más bajo para mayor compatibilidad
            builder.setBlocking(false);

            // Intentar establecer la interfaz
            vpnInterface = builder.establish();
            
            if (vpnInterface == null) {
                Log.e(TAG, "Fallo al establecer interfaz (Posible falta de permiso)");
                return;
            }

            startForeground(NOTIFICATION_ID, getNotification());

            isRunning = true;
            packetCount.set(0);
            dnsQueryCount.set(0);

            executorService = Executors.newSingleThreadExecutor();
            executorService.submit(this::processVpn);
            
            Log.d(TAG, "VPN Establecida - LLAVE debería ser visible");

        } catch (Exception e) {
            Log.e(TAG, "Error iniciando VPN", e);
            isRunning = false;
        }
    }

    private void startVpn() {
        startVpn(false);
    }

    private void processVpn() {
        FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
        FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());

        byte[] packet = new byte[32767];

        try {
            while (isRunning) {
                int length = in.read(packet);
                if (length > 0) {
                    packetCount.incrementAndGet();

                    if (isDnsPacket(packet, length)) {
                        dnsQueryCount.incrementAndGet();
                        String domain = extractDomainFromDns(packet, length);
                        
                        if (domain != null && isBlocked(domain)) {
                            Log.d(TAG, "🚫 DNS Bloqueado: " + domain);
                            continue; // Drop packet
                        }
                    }

                    out.write(packet, 0, length);
                    out.flush();
                }
                
                // Pequeño descanso para no saturar el CPU en el workstation
                if (length == 0) Thread.sleep(10);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en bucle VPN", e);
        } finally {
            stopVpn();
        }
    }

    private boolean isDnsPacket(byte[] packet, int length) {
        if (length < 28) return false; // IP(20) + UDP(8)
        return (packet[9] == 17) && // UDP
               (((packet[headerLen(packet) + 2] & 0xFF) << 8 | (packet[headerLen(packet) + 3] & 0xFF)) == DNS_PORT);
    }

    private int headerLen(byte[] packet) {
        return (packet[0] & 0x0F) * 4;
    }

    private String extractDomainFromDns(byte[] packet, int length) {
        try {
            int dnsStart = headerLen(packet) + 8; // IP + UDP
            int pos = dnsStart + 12; // DNS Header
            StringBuilder domain = new StringBuilder();
            
            while (pos < length) {
                int labelLen = packet[pos] & 0xFF;
                if (labelLen == 0) break;
                pos++;
                if (domain.length() > 0) domain.append('.');
                for (int i = 0; i < labelLen; i++) {
                    domain.append((char) packet[pos + i]);
                }
                pos += labelLen;
            }
            return domain.toString();
        } catch (Exception e) { return null; }
    }

    private boolean isBlocked(String domain) {
        String lower = domain.toLowerCase();
        for (String b : blacklist) {
            if (lower.equals(b) || lower.endsWith("." + b)) return true;
        }
        return false;
    }

    private void listenForBlacklistUpdates(String instId) {
        blacklistListener = db.collection("institutions").document(instId)
            .addSnapshotListener((snapshot, error) -> {
                if (snapshot != null && snapshot.exists()) {
                    List<String> list = (List<String>) snapshot.get("blacklist");
                    if (list != null) {
                        blacklist.clear();
                        blacklist.addAll(list);
                    }
                }
            });
    }

    private void listenForVpnEnabled(String instId) {
        vpnEnabledListener = db.collection("institutions").document(instId)
            .addSnapshotListener((snapshot, error) -> {
                if (snapshot != null && snapshot.exists()) {
                    Boolean enabled = snapshot.getBoolean("vpn_enabled");
                    vpnEnabled = (enabled != null && enabled);
                    if (vpnEnabled && !isRunning) startVpn();
                    else if (!vpnEnabled && isRunning) stopVpn();
                }
            });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Servicio VPN", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification getNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro VPN")
                .setContentText("Protección de red activa")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private void stopVpn() {
        isRunning = false;
        if (executorService != null) executorService.shutdownNow();
        try {
            if (vpnInterface != null) vpnInterface.close();
        } catch (Exception ignored) {}
        stopForeground(true);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (blacklistListener != null) blacklistListener.remove();
        if (vpnEnabledListener != null) vpnEnabledListener.remove();
        stopVpn();
    }
}
