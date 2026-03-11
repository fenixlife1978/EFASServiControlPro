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
import java.io.IOException; // Importación corregida
import java.nio.ByteBuffer;
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
    public static final String ACTION_START_VPN = "START_VPN";
    public static final String ACTION_STOP_VPN = "STOP_VPN";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private volatile boolean isRunning = false;
    private boolean vpnEnabledFromFirestore = false;

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
        } else {
            Log.e(TAG, "Error: No se encontró InstitutoId");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP_VPN.equals(action)) {
                stopVpn();
                return START_NOT_STICKY;
            } else if (ACTION_START_VPN.equals(action)) {
                startVpn();
            }
        }
        return START_STICKY;
    }

    private synchronized void startVpn() {
        if (isRunning) return;

        try {
            Builder builder = new Builder();
            builder.setSession("EDUControlPro Protection");

            builder.addAddress(VPN_ADDRESS, 24); 
            builder.addRoute(VPN_ROUTE, 0); 
            
            builder.addDnsServer("8.8.8.8");
            builder.addDnsServer("1.1.1.1");

            // Evitar que la app se filtre a sí misma
            builder.addDisallowedApplication(getPackageName());

            builder.setMtu(1500);
            builder.setBlocking(true); 

            vpnInterface = builder.establish();
            
            if (vpnInterface == null) {
                Log.e(TAG, "No se pudo establecer la interfaz VPN");
                return;
            }

            startForeground(NOTIFICATION_ID, getNotification());

            isRunning = true;
            executorService = Executors.newSingleThreadExecutor();
            executorService.submit(this::runVpnLoop);
            
            Log.d(TAG, "🛡️ VPN Iniciada correctamente");

        } catch (Exception e) {
            Log.e(TAG, "Error crítico al iniciar VPN", e);
            stopVpn();
        }
    }

    private void runVpnLoop() {
        // Usamos try-with-resources para asegurar el cierre de descriptores
        try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
             FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {
            
            ByteBuffer buffer = ByteBuffer.allocate(32767);

            while (isRunning) {
                buffer.clear();
                int length = in.read(buffer.array());
                
                if (length > 0) {
                    if (isDnsPacket(buffer.array(), length)) {
                        String domain = extractDomainFromDns(buffer.array(), length);
                        if (domain != null && isBlocked(domain)) {
                            Log.d(TAG, "🚫 Bloqueando dominio: " + domain);
                            continue; 
                        }
                    }
                    out.write(buffer.array(), 0, length);
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "Error en el flujo de datos VPN", e);
        } finally {
            stopVpn();
        }
    }

    private boolean isDnsPacket(byte[] data, int length) {
        if (length < 28) return false;
        int ipHeaderLen = (data[0] & 0x0F) * 4;
        boolean isUdp = data[9] == 17;
        int destPort = ((data[ipHeaderLen + 2] & 0xFF) << 8) | (data[ipHeaderLen + 3] & 0xFF);
        return isUdp && destPort == DNS_PORT;
    }

    private String extractDomainFromDns(byte[] data, int length) {
        try {
            int ipHeaderLen = (data[0] & 0x0F) * 4;
            int pos = ipHeaderLen + 8 + 12; 
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
        String host = domain.toLowerCase();
        for (String b : blacklist) {
            if (host.contains(b.toLowerCase())) return true;
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
                    vpnEnabledFromFirestore = (enabled != null && enabled);
                    if (vpnEnabledFromFirestore && !isRunning) startVpn();
                    else if (!vpnEnabledFromFirestore && isRunning) stopVpn();
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
                .setContentText("Filtrado de contenido en ejecución")
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
        Log.d(TAG, "VPN Detenida");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (blacklistListener != null) blacklistListener.remove();
        if (vpnEnabledListener != null) vpnEnabledListener.remove();
        stopVpn();
    }
}
