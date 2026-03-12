package com.educontrolpro;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.os.Build;
import androidx.core.app.NotificationCompat;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class ParentalControlVpnService extends VpnService {

    private static final String VPN_ADDRESS = "172.16.0.2";
    private static final int VPN_MTU = 1500;
    private static final int DNS_PORT = 53;
    private static final String REAL_DNS_SERVER = "8.8.8.8";

    public static final String ACTION_START_VPN = "com.educontrolpro.START_VPN";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private AtomicBoolean isRunning = new AtomicBoolean(false);
    private Set<String> blacklistedDomains = new HashSet<>();

    @Override
    public void onCreate() {
        super.onCreate();
        executorService = Executors.newCachedThreadPool();
        SimpleLogger.i("VPN Service - Creado");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SimpleLogger.i("VPN Service - Iniciando");
        
        if (!isRunning.get()) {
            isRunning.set(true);
            executorService.submit(this::runVpn);
            startForeground(1, createNotification());
        }
        return START_STICKY;
    }

    private void runVpn() {
        SimpleLogger.i("VPN Service - Configurando interfaz");
        
        try {
            Builder builder = new Builder();
            builder.setSession("EDUControl VPN");
            builder.addAddress(VPN_ADDRESS, 32);
            
            // CAPTURAR TODO EL TRÁFICO (para que funcione "bloquear conexiones sin VPN")
            builder.addRoute("0.0.0.0", 0);
            
            // Excluir nuestra app del túnel para evitar loops
            try {
                builder.addDisallowedApplication(getPackageName());
                SimpleLogger.i("VPN Service - App excluida del túnel");
            } catch (Exception e) {
                SimpleLogger.e("Error excluyendo app: " + e.getMessage());
            }
            
            builder.setMtu(VPN_MTU);
            
            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - No se pudo establecer interfaz");
                stopVpn();
                return;
            }

            SimpleLogger.i("VPN Service - Interfaz establecida");
            
            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
            
            ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
            int packetCount = 0;
            
            while (isRunning.get()) {
                packet.clear();
                int length = in.read(packet.array());
                if (length <= 0) continue;
                
                packet.limit(length);
                packetCount++;
                
                // Procesar cada paquete - AHORA MANEJA TODO
                processPacket(packet, out);
                
                if (packetCount % 1000 == 0) {
                    SimpleLogger.i("VPN Service - Paquetes totales procesados: " + packetCount);
                }
            }
            
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error: " + e.getMessage());
        } finally {
            stopVpn();
        }
    }

    private void processPacket(ByteBuffer packet, FileOutputStream out) {
        try {
            packet.position(0);
            
            // Cabecera IP
            byte versionIhl = packet.get();
            int headerLen = (versionIhl & 0x0F) * 4;
            
            if (headerLen < 20) {
                forwardPacket(out, packet);
                return;
            }
            
            packet.position(9);
            byte protocol = packet.get();
            
            packet.position(12);
            byte[] srcIp = new byte[4];
            packet.get(srcIp);
            byte[] dstIp = new byte[4];
            packet.get(dstIp);
            
            // Verificar si es UDP y puerto 53 (DNS)
            if (protocol == 17) { // UDP
                packet.position(headerLen + 2);
                int dstPort = packet.getShort() & 0xFFFF;
                
                if (dstPort == DNS_PORT) {
                    // Es DNS - procesar para filtrado
                    processDnsPacket(packet, out, srcIp, dstIp, srcIp, headerLen);
                    return;
                }
            }
            
            // No es DNS - reenviar directamente
            forwardPacket(out, packet);
            
        } catch (Exception e) {
            SimpleLogger.e("Error processPacket: " + e.getMessage());
            forwardPacket(out, packet);
        }
    }

    private void forwardPacket(FileOutputStream out, ByteBuffer packet) {
        try {
            synchronized (out) {
                out.write(packet.array(), 0, packet.limit());
                out.flush();
            }
        } catch (IOException e) {
            SimpleLogger.e("Error forwardPacket: " + e.getMessage());
        }
    }

    private void processDnsPacket(ByteBuffer packet, FileOutputStream out, byte[] srcIp, byte[] dstIp, byte[] clientIp, int headerLen) {
        try {
            packet.position(headerLen);
            int srcPort = packet.getShort() & 0xFFFF;
            int dstPort = packet.getShort() & 0xFFFF;
            int udpLen = packet.getShort() & 0xFFFF;
            
            // Payload DNS
            packet.position(headerLen + 8);
            ByteBuffer dnsPayload = packet.slice();
            dnsPayload.limit(udpLen - 8);
            
            // Extraer dominio
            String domain = extractDomainFromDnsQuery(dnsPayload);
            if (domain == null) {
                forwardPacket(out, packet);
                return;
            }
            
            SimpleLogger.i("DNS Consulta: " + domain);
            
            if (blacklistedDomains.contains(domain)) {
                SimpleLogger.i("BLOQUEADO: " + domain);
                reportBlockedDomain(domain);
                // No responder = bloqueo
                return;
            }
            
            // Dominio permitido - reenviar la consulta original
            forwardPacket(out, packet);
            
        } catch (Exception e) {
            SimpleLogger.e("Error processDnsPacket: " + e.getMessage());
            forwardPacket(out, packet);
        }
    }

    private String extractDomainFromDnsQuery(ByteBuffer buffer) {
        try {
            buffer.getShort(); // ID
            int flags = buffer.getShort() & 0xFFFF;
            int qdcount = buffer.getShort() & 0xFFFF;
            
            if ((flags & 0x8000) != 0 || qdcount == 0) {
                return null;
            }
            
            buffer.getShort(); // ancount
            buffer.getShort(); // nscount
            buffer.getShort(); // arcount
            
            return readDomainName(buffer);
            
        } catch (Exception e) {
            return null;
        }
    }

    private String readDomainName(ByteBuffer buffer) {
        StringBuilder domain = new StringBuilder();
        
        while (true) {
            byte len = buffer.get();
            if (len == 0) break;
            
            if ((len & 0xC0) == 0xC0) {
                // Compresión DNS
                int pointer = ((len & 0x3F) << 8) | (buffer.get() & 0xFF);
                int currentPos = buffer.position();
                buffer.position(pointer);
                String compressed = readDomainName(buffer);
                buffer.position(currentPos);
                return compressed;
            }
            
            if (buffer.remaining() < len) return null;
            
            byte[] label = new byte[len];
            buffer.get(label);
            if (domain.length() > 0) domain.append('.');
            domain.append(new String(label));
        }
        
        return domain.toString();
    }

    private void reportBlockedDomain(String domain) {
        SimpleLogger.i("Reportando bloqueo: " + domain);
    }

    private void stopVpn() {
        SimpleLogger.i("VPN Service - Deteniendo");
        isRunning.set(false);
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
            }
        } catch (Exception e) {
            SimpleLogger.e("Error cerrando interfaz: " + e.getMessage());
        }
        stopForeground(true);
        stopSelf();
    }

    private Notification createNotification() {
        Intent intent = new Intent(this, VpnController.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        
        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("EDUControl VPN")
                .setContentText("Protección activa - Bloqueando contenido")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onRevoke() {
        SimpleLogger.i("VPN Service - Permisos revocados");
        stopVpn();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopVpn();
    }

    public void updateBlacklist(Set<String> newBlacklist) {
        this.blacklistedDomains = new HashSet<>(newBlacklist);
        SimpleLogger.i("Lista negra actualizada: " + newBlacklist.size() + " dominios");
    }
}