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

    // Contadores para depuración
    private AtomicLong packetCount = new AtomicLong(0);
    private AtomicLong dnsQueryCount = new AtomicLong(0);

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Servicio VPN creado");
        showToast("Servicio VPN creado");
        createNotificationChannel();
        listenForBlacklistUpdates();
        listenForVpnEnabled();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP_VPN".equals(action)) {
                showToast("Deteniendo VPN por solicitud");
                stopVpn();
                return START_NOT_STICKY;
            } else if (ACTION_START_VPN.equals(action)) {
                showToast("Forzando inicio de VPN manual");
                // Forzar inicio independientemente de vpnEnabled (para pruebas)
                startVpn(true);
                return START_STICKY;
            }
        }
        showToast("Servicio iniciado, esperando configuración...");
        return START_STICKY;
    }

    /**
     * Inicia la VPN.
     * @param force Ignora el estado de vpnEnabled si es true (para pruebas manuales)
     */
    private void startVpn(boolean force) {
        if (isRunning) {
            Log.d(TAG, "VPN ya está en ejecución");
            showToast("VPN ya en ejecución");
            return;
        }
        if (!force && !vpnEnabled) {
            Log.d(TAG, "VPN no habilitada, no se inicia");
            showToast("VPN no habilitada en Firestore");
            return;
        }

        showToast("Intentando iniciar VPN...");
        try {
            Builder builder = new Builder();
            builder.setSession("EDUControlPro VPN");

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
                showToast("Error: No se pudo establecer la VPN");
                return;
            }

            startForeground(NOTIFICATION_ID, getNotification());

            isRunning = true;
            packetCount.set(0);
            dnsQueryCount.set(0);
            Log.d(TAG, "VPN iniciada correctamente");
            showToast("VPN iniciada correctamente");

            executorService = Executors.newSingleThreadExecutor();
            executorService.submit(this::processVpn);

        } catch (UnknownHostException e) {
            Log.e(TAG, "Dirección IP inválida", e);
            showToast("Error: Dirección IP inválida");
            isRunning = false;
        } catch (Exception e) {
            Log.e(TAG, "Error iniciando VPN", e);
            showToast("Error iniciando VPN: " + e.getMessage());
            isRunning = false;
        }
    }

    // Sobrecarga para mantener compatibilidad con llamadas anteriores
    private void startVpn() {
        startVpn(false);
    }

    private void processVpn() {
        Log.d(TAG, "Hilo de procesamiento VPN iniciado");
        showToast("Hilo VPN iniciado");

        FileInputStream in = null;
        FileOutputStream out = null;
        try {
            in = new FileInputStream(vpnInterface.getFileDescriptor());
            out = new FileOutputStream(vpnInterface.getFileDescriptor());
        } catch (Exception e) {
            Log.e(TAG, "Error obteniendo flujos de la interfaz VPN", e);
            showToast("Error al obtener flujos de la VPN");
            return;
        }

        byte[] packet = new byte[32767];
        java.nio.ByteBuffer buffer = java.nio.ByteBuffer.wrap(packet);

        while (isRunning) {
            try {
                int length = in.read(packet);
                if (length < 0) {
                    Log.d(TAG, "Fin del flujo de entrada, deteniendo VPN");
                    showToast("Fin del flujo VPN");
                    break;
                }

                packetCount.incrementAndGet();
                if (packetCount.get() % 100 == 0) {
                    Log.d(TAG, "Paquetes procesados: " + packetCount.get() + ", consultas DNS: " + dnsQueryCount.get());
                }

                buffer.position(0);
                buffer.limit(length);

                if (isDnsPacket(packet, length)) {
                    dnsQueryCount.incrementAndGet();
                    String domain = extractDomainFromDns(packet, length);
                    if (domain != null) {
                        String action = isBlocked(domain) ? "BLOQUEADO" : "PERMITIDO";
                        Log.d(TAG, "[" + dnsQueryCount.get() + "] Consulta DNS para: " + domain + " -> " + action);
                        showToast("DNS: " + domain + " -> " + action);
                        if (isBlocked(domain)) {
                            continue; // No reenviar el paquete
                        }
                    }
                }

                // Reenviar el paquete
                out.write(packet, 0, length);
                out.flush();

            } catch (IOException e) {
                Log.e(TAG, "Error de E/S en el bucle VPN: " + e.getMessage());
                showToast("Error de E/S en VPN: " + e.getMessage());
                try {
                    Thread.sleep(10);
                } catch (InterruptedException ignored) {}
            } catch (Exception e) {
                Log.e(TAG, "Error inesperado en el bucle VPN", e);
                showToast("Error inesperado: " + e.getMessage());
                try {
                    Thread.sleep(10);
                } catch (InterruptedException ignored) {}
            }
        }

        Log.d(TAG, "Hilo de procesamiento finalizado. Total paquetes: " + packetCount.get());
        showToast("Hilo VPN finalizado");
    }

    private boolean isDnsPacket(byte[] packet, int length) {
        if (length < 20) return false;
        int version = (packet[0] >> 4) & 0x0F;
        if (version != 4) return false;
        int protocol = packet[9] & 0xFF;
        if (protocol != 17) return false; // UDP
        int totalLength = ((packet[2] & 0xFF) << 8) | (packet[3] & 0xFF);
        if (totalLength > length) return false;
        int headerLength = (packet[0] & 0x0F) * 4;
        int udpStart = headerLength;
        if (udpStart + 3 >= length) return false;
        int destPort = ((packet[udpStart + 2] & 0xFF) << 8) | (packet[udpStart + 3] & 0xFF);
        return destPort == DNS_PORT;
    }

    private String extractDomainFromDns(byte[] packet, int length) {
        try {
            int headerLength = (packet[0] & 0x0F) * 4;
            int udpStart = headerLength;
            int dnsStart = udpStart + 8;
            if (dnsStart + 12 > length) return null;

            int flags = ((packet[dnsStart + 2] & 0xFF) << 8) | (packet[dnsStart + 3] & 0xFF);
            if ((flags & 0x8000) != 0) return null; // Es respuesta

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
                    char c = (char) (packet[pos + i] & 0xFF);
                    domain.append(c);
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
            if (lowerDomain.equals(blocked) || lowerDomain.endsWith("." + blocked)) {
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
                            showToast("Blacklist actualizada: " + blacklist.size() + " dominios");
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
                            String msg = "VPN enabled: " + vpnEnabled;
                            Log.d(TAG, msg);
                            showToast(msg);
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
        showToast("VPN detenida");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (blacklistListener != null) blacklistListener.remove();
        if (vpnEnabledListener != null) vpnEnabledListener.remove();
        stopVpn();
    }

    // Método para mostrar Toasts desde cualquier hilo
    private void showToast(final String message) {
        new Handler(Looper.getMainLooper()).post(() ->
                Toast.makeText(getApplicationContext(), message, Toast.LENGTH_SHORT).show()
        );
    }
}