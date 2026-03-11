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
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
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
    private boolean vpnEnabledFromFirestore = false;

    private final Set<String> blacklist = new HashSet<>();
    private final FirebaseFirestore db = FirebaseFirestore.getInstance();
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

            // IP virtual del túnel
            builder.addAddress(VPN_ADDRESS, 24);

            // Solo enrutar tráfico hacia los DNS que definimos (no todo el tráfico)
            builder.addDnsServer("8.8.8.8");
            builder.addDnsServer("1.1.1.1");
            builder.addRoute("8.8.8.8", 32);
            builder.addRoute("1.1.1.1", 32);

            try {
                // Evitar que la app se filtre a sí misma
                builder.addDisallowedApplication(getPackageName());
            } catch (Exception e) {
                Log.w(TAG, "No se pudo excluir la propia app del túnel", e);
            }

            builder.setMtu(1500);

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
        try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
             FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {

            ByteBuffer buffer = ByteBuffer.allocate(32767);

            while (isRunning) {
                buffer.clear();
                int length = in.read(buffer.array());
                if (length <= 0) continue;

                byte[] packetData = buffer.array();

                if (isDnsPacket(packetData, length)) {
                    String domain = extractDomainFromDns(packetData, length);

                    if (domain != null) {
                        if (isBlocked(domain)) {
                            Log.d(TAG, "🚫 Bloqueando dominio: " + domain);
                            // No reenviamos la consulta → el dominio no se resuelve
                            continue;
                        } else {
                            Log.d(TAG, "✅ Permitido dominio: " + domain);
                        }
                    }

                    // Reenviar DNS permitido al servidor real y devolver respuesta
                    byte[] response = forwardDns(packetData, length);
                    if (response != null) {
                        out.write(response, 0, response.length);
                    } else {
                        // Si no hay respuesta, no escribimos nada (timeout o error)
                        Log.w(TAG, "Sin respuesta DNS del servidor upstream");
                    }
                } else {
                    // Paquetes que no son DNS hacia esos IPs casi no deberían aparecer,
                    // pero si llegan, los dejamos pasar tal cual.
                    out.write(packetData, 0, length);
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "Error en el flujo de datos VPN", e);
        } finally {
            stopVpn();
        }
    }

    private byte[] forwardDns(byte[] data, int length) {
        DatagramSocket socket = null;
        try {
            socket = new DatagramSocket();
            // Muy importante: proteger el socket para que no pase por la VPN
            if (!protect(socket)) {
                Log.e(TAG, "No se pudo proteger el socket DNS");
                return null;
            }

            socket.setSoTimeout(3000);

            // Enviamos la consulta al DNS real (8.8.8.8)
            InetAddress dnsServer = InetAddress.getByName("8.8.8.8");
            DatagramPacket request = new DatagramPacket(data, length, dnsServer, DNS_PORT);
            socket.send(request);

            // Recibimos la respuesta
            byte[] respBuffer = new byte[32767];
            DatagramPacket response = new DatagramPacket(respBuffer, respBuffer.length);
            socket.receive(response);

            byte[] finalResp = new byte[response.getLength()];
            System.arraycopy(respBuffer, 0, finalResp, 0, response.getLength());
            return finalResp;

        } catch (SocketTimeoutException e) {
            Log.w(TAG, "Timeout esperando respuesta DNS", e);
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Error reenviando DNS", e);
            return null;
        } finally {
            if (socket != null) {
                socket.close();
            }
        }
    }

    private boolean isDnsPacket(byte[] data, int length) {
        if (length < 28) return false;
        int ipHeaderLen = (data[0] & 0x0F) * 4;
        if (ipHeaderLen < 20 || length < ipHeaderLen + 8) return false;

        boolean isUdp = data[9] == 17;
        if (!isUdp) return false;

        int destPort = ((data[ipHeaderLen + 2] & 0xFF) << 8) | (data[ipHeaderLen + 3] & 0xFF);
        return destPort == DNS_PORT;
    }

    private String extractDomainFromDns(byte[] data, int length) {
        try {
            int ipHeaderLen = (data[0] & 0x0F) * 4;
            int udpHeaderLen = 8;
            int dnsHeaderLen = 12;
            int pos = ipHeaderLen + udpHeaderLen + dnsHeaderLen;

            if (pos >= length) return null;

            StringBuilder domain = new StringBuilder();

            while (pos < length) {
                int labelLen = data[pos] & 0xFF;
                if (labelLen == 0) break;
                pos++;
                if (pos + labelLen > length) break;

                if (domain.length() > 0) domain.append('.');
                for (int i = 0; i < labelLen; i++) {
                    domain.append((char) data[pos + i]);
                }
                pos += labelLen;
            }
            return domain.length() > 0 ? domain.toString() : null;
        } catch (Exception e) {
            Log.e(TAG, "Error extrayendo dominio DNS", e);
            return null;
        }
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
                    if (error != null) {
                        Log.e(TAG, "Error escuchando blacklist", error);
                        return;
                    }
                    if (snapshot != null && snapshot.exists()) {
                        List<String> list = (List<String>) snapshot.get("blacklist");
                        if (list != null) {
                            blacklist.clear();
                            blacklist.addAll(list);
                            Log.d(TAG, "Blacklist actualizada: " + blacklist.size() + " entradas");
                        }
                    }
                });
    }

    private void listenForVpnEnabled(String instId) {
        vpnEnabledListener = db.collection("institutions").document(instId)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        Log.e(TAG, "Error escuchando vpn_enabled", error);
                        return;
                    }
                    if (snapshot != null && snapshot.exists()) {
                        Boolean enabled = snapshot.getBoolean("vpn_enabled");
                        vpnEnabledFromFirestore = (enabled != null && enabled);
                        if (vpnEnabledFromFirestore && !isRunning) {
                            Log.d(TAG, "Firestore: activar VPN");
                            startVpn();
                        } else if (!vpnEnabledFromFirestore && isRunning) {
                            Log.d(TAG, "Firestore: desactivar VPN");
                            stopVpn();
                        }
                    }
                });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel =
                    new NotificationChannel(CHANNEL_ID, "Protección de Red", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification getNotification() {
        PendingIntent pi = PendingIntent.getActivity(
                this,
                0,
                new Intent(this, MainActivity.class),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_IMMUTABLE
                        : 0
        );

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
        if (executorService != null) {
            executorService.shutdownNow();
            executorService = null;
        }
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception ignored) {
        }
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
