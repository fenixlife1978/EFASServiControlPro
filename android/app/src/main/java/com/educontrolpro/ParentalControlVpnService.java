package com.educontrolpro;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import androidx.core.app.NotificationCompat;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class ParentalControlVpnService extends VpnService {

    private static final String TAG = "ParentalControlVpn";
    private static final String VPN_ADDRESS = "172.16.0.2";
    private static final int VPN_MTU = 1500;
    private static final int DNS_PORT = 53;
    private static final int DNS_TIMEOUT = 5000;

    public static final String ACTION_START_VPN = "com.educontrolpro.START_VPN";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private AtomicBoolean isRunning = new AtomicBoolean(false);
    private Set<String> blacklistedDomains = new HashSet<>();

    @Override
    public void onCreate() {
        super.onCreate();
        SimpleLogger.i("VPN Service - onCreate() - Iniciando servicio VPN");
        executorService = Executors.newCachedThreadPool();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SimpleLogger.i("VPN Service - onStartCommand() recibido");
        
        if (!isRunning.get()) {
            SimpleLogger.i("VPN Service - Iniciando VPN por primera vez");
            isRunning.set(true);
            executorService.submit(this::startVpn);
            startForeground(1, createNotification());
            SimpleLogger.i("VPN Service - startForeground completado");
        } else {
            SimpleLogger.i("VPN Service - ya estaba en ejecución");
        }
        return START_STICKY;
    }

    private void startVpn() {
        SimpleLogger.i("VPN Service - startVpn() - Intentando establecer interfaz");
        
        try {
            Builder builder = new Builder();
            builder.setSession(getString(R.string.app_name));
            builder.addAddress(VPN_ADDRESS, 32);
            
            // Enrutar todo el tráfico IPv4
            builder.addRoute("0.0.0.0", 0);
            
            // Excluir nuestra propia app para evitar loops
            try {
                builder.addDisallowedApplication(getPackageName());
                SimpleLogger.i("VPN Service - App excluida del túnel: " + getPackageName());
            } catch (Exception e) {
                SimpleLogger.e("Error excluyendo app: " + e.getMessage());
            }
            
            builder.setMtu(VPN_MTU);

            SimpleLogger.i("VPN Service - Builder configurado, llamando a establish()");
            vpnInterface = builder.establish();
            
            if (vpnInterface == null) {
                SimpleLogger.e("VPN Service - ERROR CRÍTICO: builder.establish() devolvió NULL");
                stopVpn();
                return;
            }
            
            SimpleLogger.i("VPN Service - ÉXITO: Interfaz VPN establecida correctamente");

            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());

            ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
            int packetCount = 0;
            
            SimpleLogger.i("VPN Service - Entrando en bucle principal de lectura");
            
            while (isRunning.get()) {
                packet.clear();
                int length = in.read(packet.array());
                if (length > 0) {
                    packetCount++;
                    packet.limit(length);
                    
                    // Procesar el paquete (DNS o reenviar)
                    processPacket(packet, out);
                    
                    if (packetCount % 1000 == 0) {
                        SimpleLogger.i("VPN Service - Paquetes procesados: " + packetCount);
                    }
                }
            }
        } catch (Exception e) {
            SimpleLogger.e("VPN Service - Excepción: " + e.getMessage());
            StringWriter sw = new StringWriter();
            e.printStackTrace(new PrintWriter(sw));
            SimpleLogger.e("VPN Service - Stacktrace: " + sw.toString());
        } finally {
            SimpleLogger.i("VPN Service - Saliendo de startVpn()");
            stopVpn();
        }
    }

    private void processPacket(ByteBuffer packet, FileOutputStream out) {
        try {
            // Guardar una copia del paquete original para reenviarlo si no es DNS
            byte[] originalPacket = new byte[packet.limit()];
            packet.position(0);
            packet.get(originalPacket);
            
            // Analizar el paquete
            packet.position(0);
            
            // Cabecera IP
            byte versionIhl = packet.get();
            int headerLength = (versionIhl & 0x0F) * 4;
            if (headerLength < 20) {
                // Paquete inválido, reenviar original
                forwardPacket(out, originalPacket);
                return;
            }

            packet.position(9);
            byte protocol = packet.get();
            
            // Si no es UDP, reenviar sin procesar
            if (protocol != 17) {
                forwardPacket(out, originalPacket);
                return;
            }

            // Verificar si es DNS (puerto 53)
            packet.position(headerLength + 2); // Offset al puerto destino en UDP
            int dstPort = packet.getShort() & 0xFFFF;
            
            if (dstPort != DNS_PORT) {
                // No es DNS, reenviar sin procesar
                forwardPacket(out, originalPacket);
                return;
            }

            // Es un paquete DNS, procesarlo
            packet.position(0); // Reiniciar para el procesamiento DNS
            processDnsPacket(packet, out, originalPacket);
            
        } catch (Exception e) {
            SimpleLogger.e("Error en processPacket: " + e.getMessage());
            // En caso de error, intentar reenviar el paquete original
            try {
                forwardPacket(out, packet.array());
            } catch (Exception ex) {
                SimpleLogger.e("Error fatal: " + ex.getMessage());
            }
        }
    }

    private void forwardPacket(FileOutputStream out, byte[] packet) {
        try {
            synchronized (out) {
                out.write(packet);
                out.flush();
            }
        } catch (Exception e) {
            SimpleLogger.e("Error reenviando paquete: " + e.getMessage());
        }
    }

    private void processDnsPacket(ByteBuffer packet, FileOutputStream out, byte[] originalPacket) {
        try {
            packet.position(0);

            // Cabecera IP
            byte versionIhl = packet.get();
            int headerLength = (versionIhl & 0x0F) * 4;

            packet.position(16);
            byte[] srcIp = new byte[4];
            packet.get(srcIp);
            byte[] dstIp = new byte[4];

            // Cabecera UDP
            int udpHeaderStart = headerLength;
            packet.position(udpHeaderStart);
            int srcPort = packet.getShort() & 0xFFFF;
            int dstPort = packet.getShort() & 0xFFFF;
            int udpLength = packet.getShort() & 0xFFFF;

            // Payload DNS
            int dnsPayloadStart = udpHeaderStart + 8;
            packet.position(dnsPayloadStart);
            ByteBuffer dnsQuery = packet.slice();
            dnsQuery.limit(udpLength - 8);

            // Extraer dominio
            String domain = extractDomainFromDnsQuery(dnsQuery.duplicate());
            if (domain == null) {
                // No se pudo extraer dominio, reenviar original
                forwardPacket(out, originalPacket);
                return;
            }

            SimpleLogger.i("DNS Query: " + domain);

            if (blacklistedDomains.contains(domain)) {
                SimpleLogger.i("BLOQUEADO: " + domain);
                reportBlockedDomain(domain);
                // NO reenviar = bloqueo efectivo
                return;
            }

            // Dominio permitido, reenviar consulta
            SimpleLogger.i("PERMITIDO: " + domain);
            forwardDnsQuery(dnsQuery, dstIp, srcPort, srcIp, out);

        } catch (Exception e) {
            SimpleLogger.e("Error processDnsPacket: " + e.getMessage());
            // En caso de error, reenviar original
            forwardPacket(out, originalPacket);
        }
    }

    private void forwardDnsQuery(ByteBuffer dnsQuery, byte[] dnsServerIp, int clientPort, byte[] clientIp, FileOutputStream out) {
        executorService.submit(() -> {
            DatagramSocket socket = null;
            try {
                socket = new DatagramSocket();
                socket.setSoTimeout(DNS_TIMEOUT);

                InetAddress dnsAddress = InetAddress.getByAddress(dnsServerIp);
                byte[] queryData = new byte[dnsQuery.remaining()];
                dnsQuery.get(queryData);

                DatagramPacket queryPacket = new DatagramPacket(queryData, queryData.length, dnsAddress, DNS_PORT);
                socket.send(queryPacket);
                SimpleLogger.i("DNS reenviado a " + dnsAddress.getHostAddress());

                byte[] responseData = new byte[512];
                DatagramPacket responsePacket = new DatagramPacket(responseData, responseData.length);
                socket.receive(responsePacket);

                byte[] responsePayload = new byte[responsePacket.getLength()];
                System.arraycopy(responseData, 0, responsePayload, 0, responsePacket.getLength());

                byte[] ipPacket = buildIpPacket(
                        dnsServerIp,
                        clientIp,
                        DNS_PORT,
                        clientPort,
                        responsePayload
                );

                synchronized (out) {
                    out.write(ipPacket);
                    out.flush();
                }

                SimpleLogger.i("Respuesta DNS inyectada al cliente");

            } catch (SocketTimeoutException e) {
                SimpleLogger.e("Timeout en consulta DNS");
            } catch (Exception e) {
                SimpleLogger.e("Error en forward DNS: " + e.getMessage());
            } finally {
                if (socket != null) socket.close();
            }
        });
    }

    private byte[] buildIpPacket(byte[] srcIp, byte[] dstIp, int srcPort, int dstPort, byte[] payload) {
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
        buffer.put((byte) 17);
        buffer.putShort((short) 0);
        buffer.put(srcIp);
        buffer.put(dstIp);

        int ipChecksum = calculateChecksum(buffer.array(), 0, ipHeaderLen);
        buffer.putShort(10, (short) ipChecksum);

        // Cabecera UDP
        buffer.putShort((short) srcPort);
        buffer.putShort((short) dstPort);
        buffer.putShort((short) (udpHeaderLen + payload.length));
        buffer.putShort((short) 0);

        // Payload
        buffer.put(payload);

        return buffer.array();
    }

    private int calculateChecksum(byte[] data, int offset, int length) {
        int sum = 0;
        int i = offset;
        while (length > 1) {
            sum += ((data[i] & 0xFF) << 8) | (data[i + 1] & 0xFF);
            i += 2;
            length -= 2;
        }
        if (length > 0) {
            sum += (data[i] & 0xFF) << 8;
        }
        while ((sum >> 16) > 0) {
            sum = (sum & 0xFFFF) + (sum >> 16);
        }
        return ~sum & 0xFFFF;
    }

    private String extractDomainFromDnsQuery(ByteBuffer buffer) {
        try {
            int id = buffer.getShort() & 0xFFFF;
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
        int position = buffer.position();
        boolean jumped = false;
        int maxLoops = 100;

        while (maxLoops-- > 0) {
            byte len = buffer.get();
            if (len == 0) break;
            
            if ((len & 0xC0) == 0xC0) {
                int pointer = ((len & 0x3F) << 8) | (buffer.get() & 0xFF);
                if (!jumped) {
                    position = buffer.position();
                    jumped = true;
                }
                buffer.position(pointer);
                continue;
            }
            
            if (buffer.remaining() < len) return null;
            
            byte[] label = new byte[len];
            buffer.get(label);
            if (domain.length() > 0) domain.append('.');
            domain.append(new String(label));
        }
        
        if (jumped) buffer.position(position);
        return domain.toString();
    }

    private void reportBlockedDomain(String domain) {
        SimpleLogger.i("Reportando bloqueo: " + domain);
    }

    private void stopVpn() {
        SimpleLogger.i("VPN Service - Deteniendo VPN");
        isRunning.set(false);
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                SimpleLogger.i("VPN Service - Interfaz cerrada");
            }
        } catch (Exception e) {
            SimpleLogger.e("Error al cerrar interfaz VPN: " + e.getMessage());
        }
        stopForeground(true);
        stopSelf();
        SimpleLogger.i("VPN Service - Detenido completamente");
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, VpnController.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);
        
        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("Control Parental Activo")
                .setContentText("Filtrado DNS en ejecución")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pendingIntent)
                .build();
    }

    @Override
    public void onRevoke() {
        SimpleLogger.i("VPN Service - Permisos revocados por el sistema");
        stopVpn();
    }

    @Override
    public void onDestroy() {
        SimpleLogger.i("VPN Service - onDestroy() llamado");
        super.onDestroy();
        stopVpn();
    }

    public void updateBlacklist(Set<String> newBlacklist) {
        this.blacklistedDomains = new HashSet<>(newBlacklist);
        SimpleLogger.i("Lista negra actualizada. Tamaño: " + this.blacklistedDomains.size());
    }
}