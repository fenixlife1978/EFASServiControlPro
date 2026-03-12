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

    private static final String VPN_ADDRESS = "10.0.0.2";
    private static final int VPN_MTU = 1280;
    private static final int DNS_PORT = 53;
    private static final String DNS_SERVER = "8.8.8.8"; // DNS de Google

    public static final String ACTION_START_VPN = "com.educontrolpro.START_VPN";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private AtomicBoolean isRunning = new AtomicBoolean(false);
    private Set<String> blacklistedDomains = new HashSet<>();
    private Thread vpnThread;

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
            vpnThread = new Thread(this::runVpn, "VpnThread");
            vpnThread.start();
            startForeground(1, createNotification());
        }
        return START_STICKY;
    }

    private void runVpn() {
        SimpleLogger.i("VPN Service - Configurando interfaz con Filtrado DNS Selectivo");
        
        try {
            Builder builder = new Builder();
            builder.setSession("EDUControl VPN");
            builder.addAddress(VPN_ADDRESS, 32);
            
            // CRÍTICO: Solo capturar tráfico hacia el servidor DNS específico
            builder.addRoute(DNS_SERVER, 32);
            
            // Añadir servidor DNS
            builder.addDnsServer(DNS_SERVER);
            
            // EXCLUIR nuestra app para que pueda acceder a internet
            try {
                builder.addDisallowedApplication(getPackageName());
                SimpleLogger.i("VPN Service - App excluida del túnel: " + getPackageName());
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

            SimpleLogger.i("VPN Service - Interfaz establecida correctamente");
            SimpleLogger.i("VPN Service - Modo: Filtrado DNS Selectivo (solo 8.8.8.8)");
            
            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            
            ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
            int packetCount = 0;
            
            while (isRunning.get() && !Thread.interrupted()) {
                packet.clear();
                int length = in.read(packet.array());
                if (length <= 0) continue;
                
                packet.limit(length);
                packetCount++;
                
                // Procesar paquete DNS
                processDnsPacket(packet);
                
                if (packetCount % 50 == 0) {
                    SimpleLogger.d("VPN Service - Consultas DNS procesadas: " + packetCount);
                }
                
                // Pequeña pausa para no saturar CPU
                Thread.sleep(10);
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
            
            if (headerLen < 20) {
                return;
            }
            
            packet.position(9);
            byte protocol = packet.get();
            
            // Solo nos interesa UDP
            if (protocol != 17) {
                return;
            }
            
            packet.position(12);
            byte[] srcIp = new byte[4];
            packet.get(srcIp);
            byte[] dstIp = new byte[4];
            packet.get(dstIp);
            
            // Cabecera UDP
            packet.position(headerLen);
            int srcPort = packet.getShort() & 0xFFFF;
            int dstPort = packet.getShort() & 0xFFFF;
            int udpLen = packet.getShort() & 0xFFFF;
            
            // Verificar que es DNS (puerto 53)
            if (dstPort != DNS_PORT) {
                return;
            }
            
            // Payload DNS
            packet.position(headerLen + 8);
            ByteBuffer dnsPayload = packet.slice();
            dnsPayload.limit(udpLen - 8);
            
            // Extraer dominio
            String domain = extractDomainFromDnsQuery(dnsPayload);
            if (domain == null) {
                // Si no podemos extraer dominio, permitimos
                forwardDnsQuery(packet, srcIp, srcPort, dstIp);
                return;
            }
            
            SimpleLogger.i("📡 DNS Consulta: " + domain);
            
            if (blacklistedDomains.contains(domain)) {
                SimpleLogger.i("🚫 BLOQUEADO: " + domain);
                reportBlockedDomain(domain);
                // NO reenviar = sitio bloqueado
                return;
            }
            
            // Dominio permitido - reenviar al DNS real
            SimpleLogger.d("✅ PERMITIDO: " + domain);
            forwardDnsQuery(packet, srcIp, srcPort, dstIp);
            
        } catch (Exception e) {
            SimpleLogger.e("Error processDnsPacket: " + e.getMessage());
        }
    }

    private void forwardDnsQuery(ByteBuffer originalPacket, byte[] clientIp, int clientPort, byte[] dnsServerIp) {
        executorService.submit(() -> {
            DatagramSocket socket = null;
            try {
                socket = new DatagramSocket();
                socket.setSoTimeout(5000);
                
                // Extraer solo el payload DNS del paquete original
                ByteBuffer tempBuffer = originalPacket.duplicate();
                tempBuffer.position(0);
                
                // Saltar cabeceras IP y UDP
                byte versionIhl = tempBuffer.get();
                int headerLen = (versionIhl & 0x0F) * 4;
                tempBuffer.position(headerLen + 8);
                
                byte[] dnsQueryData = new byte[tempBuffer.remaining()];
                tempBuffer.get(dnsQueryData);
                
                // Enviar al DNS real
                InetAddress dnsAddress = InetAddress.getByName(DNS_SERVER);
                DatagramPacket queryPacket = new DatagramPacket(dnsQueryData, dnsQueryData.length, dnsAddress, DNS_PORT);
                socket.send(queryPacket);
                
                // Recibir respuesta
                byte[] responseData = new byte[512];
                DatagramPacket responsePacket = new DatagramPacket(responseData, responseData.length);
                socket.receive(responsePacket);
                
                // Construir respuesta IP/UDP
                byte[] responsePayload = new byte[responsePacket.getLength()];
                System.arraycopy(responseData, 0, responsePayload, 0, responsePacket.getLength());
                
                byte[] ipResponse = buildDnsResponse(
                    dnsAddress.getAddress(),  // IP origen (DNS real)
                    clientIp,                  // IP destino (cliente)
                    DNS_PORT,                  // Puerto origen (53)
                    clientPort,                // Puerto destino (cliente)
                    responsePayload
                );
                
                // Escribir respuesta en el túnel
                if (vpnInterface != null) {
                    FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
                    synchronized (out) {
                        out.write(ipResponse);
                        out.flush();
                    }
                    SimpleLogger.d("✅ Respuesta DNS enviada al cliente");
                }
                
            } catch (Exception e) {
                SimpleLogger.e("Error forward DNS: " + e.getMessage());
            } finally {
                if (socket != null) socket.close();
            }
        });
    }

    private byte[] buildDnsResponse(byte[] srcIp, byte[] dstIp, int srcPort, int dstPort, byte[] payload) {
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
        buffer.put(srcIp);
        buffer.put(dstIp);
        
        // Cabecera UDP
        buffer.putShort((short) srcPort);
        buffer.putShort((short) dstPort);
        buffer.putShort((short) (udpHeaderLen + payload.length));
        buffer.putShort((short) 0); // Checksum UDP
        
        // Payload
        buffer.put(payload);
        
        return buffer.array();
    }

    private String extractDomainFromDnsQuery(ByteBuffer buffer) {
        try {
            // ID (2 bytes)
            buffer.getShort();
            
            // Flags (2 bytes)
            int flags = buffer.getShort() & 0xFFFF;
            
            // Verificar que es una consulta (QR=0)
            if ((flags & 0x8000) != 0) {
                return null;
            }
            
            // QDCOUNT (número de preguntas)
            int qdcount = buffer.getShort() & 0xFFFF;
            if (qdcount == 0) {
                return null;
            }
            
            // Saltar ANCOUNT, NSCOUNT, ARCOUNT
            buffer.getShort();
            buffer.getShort();
            buffer.getShort();
            
            // Leer el dominio de la primera pregunta
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
        // Aquí puedes guardar en Firebase
    }

    private void stopVpn() {
        SimpleLogger.i("VPN Service - Deteniendo");
        isRunning.set(false);
        
        if (vpnThread != null) {
            vpnThread.interrupt();
            try {
                vpnThread.join(1000);
            } catch (InterruptedException e) {
                // Ignorar
            }
            vpnThread = null;
        }
        
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
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
                .setContentText("Filtrado DNS activo - Internet fluido")
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
        SimpleLogger.i("📋 Lista negra actualizada: " + newBlacklist.size() + " dominios");
    }
}