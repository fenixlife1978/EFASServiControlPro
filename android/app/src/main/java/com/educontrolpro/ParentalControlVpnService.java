package com.educontrolpro;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import java.io.FileInputStream;
import java.io.FileOutputStream;
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
    private static final String VPN_ADDRESS = "172.16.0.2"; // IP virtual del dispositivo
    private static final int VPN_MTU = 1500;
    private static final int DNS_PORT = 53;
    private static final int DNS_TIMEOUT = 5000; // 5 segundos

    public static final String ACTION_START_VPN = "com.educontrolpro.START_VPN";

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executorService;
    private AtomicBoolean isRunning = new AtomicBoolean(false);
    private Set<String> blacklistedDomains = new HashSet<>();

    @Override
    public void onCreate() {
        super.onCreate();
        executorService = Executors.newCachedThreadPool(); // Hilos para manejar respuestas DNS
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isRunning.get()) {
            isRunning.set(true);
            executorService.submit(this::startVpn);
            startForeground(1, createNotification());
        }
        return START_STICKY;
    }

    private void startVpn() {
        try {
            Builder builder = new Builder();
            builder.setSession(getString(R.string.app_name));
            builder.addAddress(VPN_ADDRESS, 32);
            builder.addRoute("0.0.0.0", 0); // Enrutar todo el tráfico IPv4
            builder.addDnsServer("8.8.8.8"); // DNS sugerido, pero el dispositivo usará el que tenga configurado
            builder.setMtu(VPN_MTU);

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "Error al establecer la interfaz VPN.");
                stopVpn();
                return;
            }

            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());

            ByteBuffer packet = ByteBuffer.allocate(VPN_MTU);
            while (isRunning.get()) {
                packet.clear();
                int length = in.read(packet.array());
                if (length > 0) {
                    packet.limit(length);
                    processPacket(packet, out);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en el bucle principal de la VPN", e);
        } finally {
            stopVpn();
        }
    }

    /**
     * Procesa un paquete IP entrante.
     * Si es UDP y puerto destino 53, lo tratamos como DNS.
     * En caso contrario, lo ignoramos (no hacemos nada) porque en este proxy solo manejamos DNS.
     */
    private void processPacket(ByteBuffer packet, FileOutputStream out) {
        try {
            // Posición inicial
            packet.position(0);

            // ---- Cabecera IP ----
            byte versionIhl = packet.get();
            int headerLength = (versionIhl & 0x0F) * 4; // IHL en palabras de 32 bits
            if (headerLength < 20) {
                return; // Cabecera IP inválida
            }

            // Tipo de servicio, longitud total, identificación, flags, TTL, protocolo, checksum...
            packet.position(9); // Saltamos hasta el byte del protocolo
            byte protocol = packet.get();
            if (protocol != 17) { // 17 = UDP
                return; // No es UDP, ignoramos
            }

            // Saltamos a la dirección destino (offset 16)
            packet.position(16);
            byte[] srcIp = new byte[4];
            packet.get(srcIp);
            byte[] dstIp = new byte[4];
            packet.get(dstIp);

            // ---- Cabecera UDP ----
            int udpHeaderStart = headerLength;
            packet.position(udpHeaderStart);
            int srcPort = packet.getShort() & 0xFFFF;
            int dstPort = packet.getShort() & 0xFFFF;
            int udpLength = packet.getShort() & 0xFFFF;
            // checksum ignorado

            if (dstPort != DNS_PORT) {
                return; // No es DNS, ignoramos
            }

            // ---- Payload DNS ----
            int dnsPayloadStart = udpHeaderStart + 8; // 8 bytes de cabecera UDP
            packet.position(dnsPayloadStart);
            ByteBuffer dnsQuery = packet.slice(); // Subbuffer con solo el payload DNS
            dnsQuery.limit(udpLength - 8); // Tamaño del payload

            // Extraer dominio
            String domain = extractDomainFromDnsQuery(dnsQuery.duplicate()); // duplicado para no consumir
            if (domain == null) {
                return;
            }

            Log.d(TAG, "Consulta DNS: " + domain + " -> " + (blacklistedDomains.contains(domain) ? "BLOQUEAR" : "PERMITIR"));

            if (blacklistedDomains.contains(domain)) {
                // Bloqueado: no responder, el dispositivo hará timeout
                reportBlockedDomain(domain);
                return;
            }

            // Reenviar la consulta al servidor DNS original (la IP destino)
            // Necesitamos la IP del servidor DNS (dstIp) y el puerto origen (srcPort) para la respuesta
            forwardDnsQuery(dnsQuery, dstIp, srcPort, srcIp, out);

        } catch (Exception e) {
            Log.e(TAG, "Error procesando paquete: " + e.getMessage());
        }
    }

    /**
     * Reenvía una consulta DNS al servidor original y luego inyecta la respuesta.
     */
    private void forwardDnsQuery(ByteBuffer dnsQuery, byte[] dnsServerIp, int clientPort, byte[] clientIp, FileOutputStream out) {
        executorService.submit(() -> {
            DatagramSocket socket = null;
            try {
                // Crear socket para comunicación con el DNS real
                socket = new DatagramSocket();
                socket.setSoTimeout(DNS_TIMEOUT);

                InetAddress dnsAddress = InetAddress.getByAddress(dnsServerIp);
                byte[] queryData = new byte[dnsQuery.remaining()];
                dnsQuery.get(queryData);

                DatagramPacket queryPacket = new DatagramPacket(queryData, queryData.length, dnsAddress, DNS_PORT);
                socket.send(queryPacket);

                // Recibir respuesta
                byte[] responseData = new byte[512]; // Tamaño típico de respuesta DNS
                DatagramPacket responsePacket = new DatagramPacket(responseData, responseData.length);
                socket.receive(responsePacket);

                // Construir paquete IP con la respuesta
                byte[] responsePayload = new byte[responsePacket.getLength()];
                System.arraycopy(responseData, 0, responsePayload, 0, responsePacket.getLength());

                // Construir respuesta IP (origen = servidor DNS, destino = cliente original)
                byte[] ipPacket = buildIpPacket(
                        dnsServerIp,        // IP origen (servidor DNS)
                        clientIp,           // IP destino (cliente)
                        DNS_PORT,           // Puerto origen (53)
                        clientPort,          // Puerto destino (cliente)
                        responsePayload
                );

                // Escribir en el túnel
                synchronized (out) {
                    out.write(ipPacket);
                    out.flush();
                }

                Log.v(TAG, "Respuesta DNS reenviada para consulta permitida");
            } catch (SocketTimeoutException e) {
                Log.e(TAG, "Timeout en consulta DNS");
            } catch (Exception e) {
                Log.e(TAG, "Error en forward DNS: " + e.getMessage());
            } finally {
                if (socket != null) socket.close();
            }
        });
    }

    /**
     * Construye un paquete IP completo (cabecera IP + UDP + payload) para inyectar en el túnel.
     */
    private byte[] buildIpPacket(byte[] srcIp, byte[] dstIp, int srcPort, int dstPort, byte[] payload) {
        int ipHeaderLen = 20; // Sin opciones
        int udpHeaderLen = 8;
        int totalLen = ipHeaderLen + udpHeaderLen + payload.length;

        ByteBuffer buffer = ByteBuffer.allocate(totalLen);
        buffer.order(ByteOrder.BIG_ENDIAN);

        // Cabecera IP
        buffer.put((byte) 0x45); // IPv4, IHL=5
        buffer.put((byte) 0x00); // TOS
        buffer.putShort((short) totalLen); // Longitud total
        buffer.putShort((short) 0); // Identificación
        buffer.putShort((short) 0x4000); // Flags (no fragmentar) y offset
        buffer.put((byte) 64); // TTL
        buffer.put((byte) 17); // Protocolo UDP
        buffer.putShort((short) 0); // Checksum (lo calculamos después)
        buffer.put(srcIp);
        buffer.put(dstIp);

        // Calcular checksum IP (simple)
        int ipChecksum = calculateChecksum(buffer.array(), 0, ipHeaderLen);
        buffer.putShort(10, (short) ipChecksum); // Posición del checksum

        // Cabecera UDP
        buffer.putShort((short) srcPort);
        buffer.putShort((short) dstPort);
        buffer.putShort((short) (udpHeaderLen + payload.length));
        buffer.putShort((short) 0); // Checksum UDP (opcional en IPv4, lo dejamos 0)

        // Payload
        buffer.put(payload);

        return buffer.array();
    }

    /**
     * Calcula checksum IP (suma de complemento a 1 de palabras de 16 bits).
     */
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

    /**
     * Extrae el nombre de dominio de una consulta DNS (solo la primera pregunta).
     */
    private String extractDomainFromDnsQuery(ByteBuffer buffer) {
        try {
            // Leer cabecera DNS (12 bytes)
            int id = buffer.getShort() & 0xFFFF;
            int flags = buffer.getShort() & 0xFFFF;
            int qdcount = buffer.getShort() & 0xFFFF;
            int ancount = buffer.getShort() & 0xFFFF;
            int nscount = buffer.getShort() & 0xFFFF;
            int arcount = buffer.getShort() & 0xFFFF;

            // Verificar que es una consulta (QR=0) y tiene al menos una pregunta
            if ((flags & 0x8000) != 0 || qdcount == 0) {
                return null;
            }

            // Leer QNAME (dominio)
            String domain = readDomainName(buffer);
            if (domain == null) return null;

            // Leer QTYPE y QCLASS (no necesarios)
            // buffer.getShort(); // QTYPE
            // buffer.getShort(); // QCLASS

            return domain;
        } catch (Exception e) {
            Log.e(TAG, "Error parseando DNS: " + e.getMessage());
            return null;
        }
    }

    /**
     * Lee un nombre de dominio desde un buffer DNS (con manejo de compresión).
     */
    private String readDomainName(ByteBuffer buffer) {
        StringBuilder domain = new StringBuilder();
        int position = buffer.position();
        int limit = buffer.limit();
        boolean jumped = false;
        int maxLoops = 100;

        while (maxLoops-- > 0) {
            byte len = buffer.get();
            if (len == 0) {
                break;
            }
            if ((len & 0xC0) == 0xC0) {
                int pointer = ((len & 0x3F) << 8) | (buffer.get() & 0xFF);
                if (!jumped) {
                    position = buffer.position();
                    jumped = true;
                }
                buffer.position(pointer);
                continue;
            }
            if (buffer.remaining() < len) {
                return null;
            }
            byte[] label = new byte[len];
            buffer.get(label);
            if (domain.length() > 0) {
                domain.append('.');
            }
            domain.append(new String(label));
        }
        if (jumped) {
            buffer.position(position);
        }
        return domain.toString();
    }

    private void reportBlockedDomain(String domain) {
        Log.i(TAG, "Reportando bloqueo: " + domain);
        // Aquí puedes llamar a FirebaseHelper
        // FirebaseHelper helper = new FirebaseHelper(this);
        // helper.reportBlockAttempt(domain);
    }

    private void stopVpn() {
        isRunning.set(false);
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error al cerrar interfaz VPN", e);
        }
        stopForeground(true);
        stopSelf();
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, VpnController.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, NotificationUtils.CHANNEL_ID)
                .setContentTitle("Control Parental Activo")
                .setContentText("Filtrado DNS en ejecución")
                .setSmallIcon(R.drawable.ic_vpn)
                .setContentIntent(pendingIntent)
                .build();
    }

    @Override
    public void onRevoke() {
        stopVpn();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopVpn();
    }

    public void updateBlacklist(Set<String> newBlacklist) {
        this.blacklistedDomains = new HashSet<>(newBlacklist);
        Log.d(TAG, "Lista negra actualizada. Tamaño: " + this.blacklistedDomains.size());
    }
}