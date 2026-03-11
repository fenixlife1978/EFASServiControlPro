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
import com.google.firebase.firestore.ListenerRegistration;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class EduVpnService extends VpnService {

    private static final String TAG = "EDU_Vpn";
    private static final String VPN_ADDRESS = "10.0.0.2"; 
    private static final int DNS_PORT = 53;
    private static final int NOTIFICATION_ID = 2;
    private static final String CHANNEL_ID = "VPN_CHANNEL";
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private volatile boolean isRunning = false;

    private Set<String> blacklist = new HashSet<>();
    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private ListenerRegistration blacklistListener;
    private ListenerRegistration vpnEnabledListener;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        iniciarConfiguracionFirestore();
    }

    private void iniciarConfiguracionFirestore() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        String institutoId = prefs.getString("InstitutoId", null);
        
        if (institutoId != null) {
            listenForBlacklistUpdates(institutoId);
            listenForVpnEnabled(institutoId);
        }
    }

    private synchronized void startVpn() {
        if (isRunning) return;

        try {
            Builder builder = new Builder();
            builder.setSession("EDUControlPro Protection");
            builder.addAddress(VPN_ADDRESS, 32); 
            
            // --- LA CLAVE PARA QUE NO SE CORTE EL INTERNET ---
            // Solo interceptamos las peticiones DNS (8.8.8.8)
            // El resto del tráfico (WhatsApp, YouTube, etc.) irá por la red normal
            builder.addRoute("8.8.8.8", 32);
            builder.addRoute("1.1.1.1", 32);
            builder.addDnsServer("8.8.8.8");

            // Evitar conflictos con Firebase
            builder.addDisallowedApplication(getPackageName());
            // Permitir WhatsApp fuera de la VPN para que no se corte
            try { builder.addDisallowedApplication("com.whatsapp"); } catch (Exception ignored) {}

            builder.setMtu(1500);
            builder.setBlocking(false); // Cambiado a false para evitar lags

            vpnInterface = builder.establish();
            
            if (vpnInterface != null) {
                startForeground(NOTIFICATION_ID, getNotification());
                isRunning = true;
                executorService = Executors.newSingleThreadExecutor();
                executorService.submit(this::runVpnLoop);
                Log.d(TAG, "🛡️ VPN DNS-Filter Iniciada");
            }

        } catch (Exception e) {
            Log.e(TAG, "Error al iniciar VPN", e);
            stopVpn();
        }
    }

    private void runVpnLoop() {
        try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor())) {
            ByteBuffer buffer = ByteBuffer.allocate(32767);

            while (isRunning) {
                buffer.clear();
                int length = in.read(buffer.array());
                
                if (length > 0) {
                    if (isDnsPacket(buffer.array(), length)) {
                        String domain = extractDomainFromDns(buffer.array(), length);
                        if (domain != null && isBlocked(domain)) {
                            Log.w(TAG, "🚫 BLOQUEADO: " + domain);
                            // Al no escribir el paquete de vuelta, la petición muere aquí.
                            continue; 
                        }
                    }
                    // NOTA: No escribimos de vuelta en 'out' porque solo capturamos DNS
                    // El SO se encarga del resto del tráfico al no estar en las rutas.
                }
                Thread.sleep(10); // Evitar consumo excesivo de CPU
            }
        } catch (Exception e) {
            Log.e(TAG, "Loop error", e);
        } finally {
            stopVpn();
        }
    }

    private boolean isDnsPacket(byte[] data, int length) {
        if (length < 28) return false;
        int ipHeaderLen = (data[0] & 0x0F) * 4;
        return data[9] == 17; // Es UDP
    }

    private String extractDomainFromDns(byte[] data, int length) {
        try {
            int ipHeaderLen = (data[0] & 0x0F) * 4;
            int pos = ipHeaderLen + 8 + 12; // Saltamos IP, UDP y Header DNS
            StringBuilder domain = new StringBuilder();
            
            while (pos < length) {
                int labelLen = data[pos] & 0xFF;
                if (labelLen == 0) break;
                pos++;
                if (domain.length() > 0) domain.append('.');
                for (int i = 0; i < labelLen; i++) {
                    domain.append((char) data[pos + i]);
                }
                pos += labelLen;
            }
            return domain.toString();
        } catch (Exception e) { return null; }
    }

    private boolean isBlocked(String domain) {
        for (String b : blacklist) {
            if (domain.toLowerCase().contains(b.toLowerCase())) return true;
        }
        return false;
    }

    // ... (Mantén tus métodos de Listeners, Notifications y stopVpn igual)
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_START_VPN.equals(intent.getAction())) {
            startVpn();
        } else if (intent != null && ACTION_STOP_VPN.equals(intent.getAction())) {
            stopVpn();
        }
        return START_STICKY;
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
                    if (enabled != null) {
                        if (enabled && !isRunning) startVpn();
                        else if (!enabled && isRunning) stopVpn();
                    }
                }
            });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Protección de Red", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification getNotification() {
        PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro activo")
                .setContentText("Filtrado DNS en ejecución")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private synchronized void stopVpn() {
        isRunning = false;
        if (executorService != null) executorService.shutdownNow();
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
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
