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

    private static final String VPN_ADDRESS = "172.16.0.2"; // IP local del cliente VPN
    private static final String DNS_SERVER_VPN = "172.16.0.1"; // IP ficticia para capturar DNS
    private static final String REAL_DNS_SERVER = "8.8.8.8"; // DNS real de Google
    private static final int VPN_MTU = 1500;
    private static final int DNS_PORT = 53;

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
            
            // SOLO capturar tráfico hacia nuestro DNS ficticio
            builder.addRoute(DNS_SERVER_VPN, 32);
            
            // Opcional: excluir nuestra app del túnel
            try {
                builder.addDisallowedApplication(getPackageName());
            } catch (Exception e) {
                // Ignorar
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
            
            ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
            int packetCount = 0;
            
            while (isRunning.get()) {
                packet.clear();
                int length = in.read(packet.array());
                if (length <= 0) continue;
                
                packet.limit(length);
                packetCount++;
                
                // Procesar paquete DNS
                processDnsPacket(packet);
                
                if (packetCount % 100 == 0) {
                    SimpleLogger.i("VPN Service - Paquetes DNS procesados: " + packetCount);
                }
            }
            
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Error: " + e.getMessage());
        } finally {
            stopVpn();
        }
    }

    private void processDnsPacket(ByteBuffer packet) {
        try {
            packet.position(0);
            
            // Cabecera IP
            byte versionIhl = packet.get();
            int headerLen = (versionIhl & 0x0F) * 4;
            
            packet.position(16);
            byte[] srcIp = new byte[4];
            packet.get(srcIp);
            byte[] dstIp = new byte[4];
            packet.get(dstIp);
            
            // Cabecera UDP
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
                return;
            }
            
            SimpleLogger.i("DNS Consulta: " + domain);
            
            if (blacklistedDomains.contains(domain)) {
                SimpleLogger.i("BLOQUEADO: " + domain);
                reportBlockedDomain(domain);
                // No responder = bloqueo
                return;
            }
            
            // Dominio permitido, reenviar a DNS real
            forwardDnsQuery(dnsPayload, srcIp, srcPort);
            
        } catch (Exception e) {
            SimpleLogger.e("Error processDnsPacket: " + e.getMessage());
        }
    }

    private void forwardDnsQuery(ByteBuffer dnsQuery, byte[] clientIp, int clientPort) {
        executorService.submit(() -> {
            DatagramSocket socket = null;
            try {
                socket = new DatagramSocket();
                socket.setSoTimeout(5000);
                
                InetAddress dnsAddress = InetAddress.getByName(REAL_DNS_SERVER);
                
                byte[] queryData = new byte[dnsQuery.remaining()];
                dnsQuery.get(queryData);
                
                DatagramPacket queryPacket = new DatagramPacket(queryData, queryData.length, dnsAddress, DNS_PORT);
                socket.send(queryPacket);
                
                byte[] responseData = new byte[512];
                DatagramPacket responsePacket = new DatagramPacket(responseData, responseData.length);
                socket.receive(responsePacket);
                
                // Construir respuesta IP/UDP
                byte[] responsePayload = new byte[responsePacket.getLength()];
                System.arraycopy(responseData, 0, responsePayload, 0, responsePacket.getLength());
                
                byte[] ipResponse = buildDnsResponse(
                    REAL_DNS_SERVER,    // IP origen (DNS real)
                    clientIp,           // IP destino (cliente)
                    DNS_PORT,           // Puerto origen (53)
                    clientPort,         // Puerto destino (cliente)
                    responsePayload
                );
                
                // Escribir respuesta en el túnel
                FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
                synchronized (out) {
                    out.write(ipResponse);
                    out.flush();
                }
                
                SimpleLogger.i("DNS Respuesta enviada al cliente");
                
            } catch (Exception e) {
                SimpleLogger.e("Error forward DNS: " + e.getMessage());
            } finally {
                if (socket != null) socket.close();
            }
        });
    }

    private byte[] buildDnsResponse(String srcIpStr, byte[] dstIp, int srcPort, int dstPort, byte[] payload) {
        try {
            InetAddress srcIp = InetAddress.getByName(srcIpStr);
            byte[] srcIpBytes = srcIp.getAddress();
            
            int ipHeaderLen = 20;
            int udpHeaderLen = 8;
            int totalLen = ipHeaderLen + udpHeaderLen + payload.length;
            
            ByteBuffer buffer = ByteBuffer.allocate(totalLen);
            buffer.order(ByteOrder.BIG_ENDIAN);
            
            // Cabecera IP
            buffer.put((byte) 0x45);
            buffer.put((byte) 0x00);
            buffer.putShort((short) totalLen);
            buffer.putShort((short) 0);
            buffer.putShort((short) 0x4000);
            buffer.put((byte) 64);
            buffer.put((byte) 17); // UDP
            buffer.putShort((short) 0); // Checksum
            buffer.put(srcIpBytes);
            buffer.put(dstIp);
            
            // Cabecera UDP
            buffer.putShort((short) srcPort);
            buffer.putShort((short) dstPort);
            buffer.putShort((short) (udpHeaderLen + payload.length));
            buffer.putShort((short) 0); // Checksum UDP
            
            // Payload
            buffer.put(payload);
            
            return buffer.array();
            
        } catch (Exception e) {
            SimpleLogger.e("Error buildDnsResponse: " + e.getMessage());
            return new byte[0];
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
            SimpleLogger.e("Error parseando DNS: " + e.getMessage());
            return null;
        }
    }

    private String readDomainName(ByteBuffer buffer) {
        StringBuilder domain = new StringBuilder();
        
        while (true) {
            byte len = buffer.get();
            if (len == 0) break;
            
            if ((len & 0xC0) == 0xC0) {
                // Compresión DNS (simplificado)
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
                .setContentText("Filtrado DNS activo")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
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