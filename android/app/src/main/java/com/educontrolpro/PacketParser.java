package com.educontrolpro;

import java.nio.ByteBuffer;

public class PacketParser {

    public static class IpHeader {
        public int version;
        public int headerLength;
        public int totalLength;
        public int protocol;
        public String sourceIp;
        public String destIp;
    }

    public static class TcpHeader {
        public int sourcePort;
        public int destPort;
    }

    public static class UdpHeader {
        public int sourcePort;
        public int destPort;
    }

    public static IpHeader parseIpHeader(ByteBuffer buffer) {
        IpHeader ip = new IpHeader();

        int versionAndHeaderLength = buffer.get(0) & 0xFF;
        ip.version = versionAndHeaderLength >> 4;
        ip.headerLength = (versionAndHeaderLength & 0x0F) * 4;

        ip.totalLength = ((buffer.getShort(2)) & 0xFFFF);
        ip.protocol = buffer.get(9) & 0xFF;

        ip.sourceIp = String.format("%d.%d.%d.%d",
                buffer.get(12) & 0xFF,
                buffer.get(13) & 0xFF,
                buffer.get(14) & 0xFF,
                buffer.get(15) & 0xFF);

        ip.destIp = String.format("%d.%d.%d.%d",
                buffer.get(16) & 0xFF,
                buffer.get(17) & 0xFF,
                buffer.get(18) & 0xFF,
                buffer.get(19) & 0xFF);

        return ip;
    }

    public static TcpHeader parseTcpHeader(ByteBuffer buffer, int ipHeaderLength) {
        TcpHeader tcp = new TcpHeader();
        int offset = ipHeaderLength;

        tcp.sourcePort = buffer.getShort(offset) & 0xFFFF;
        tcp.destPort = buffer.getShort(offset + 2) & 0xFFFF;

        return tcp;
    }

    public static UdpHeader parseUdpHeader(ByteBuffer buffer, int ipHeaderLength) {
        UdpHeader udp = new UdpHeader();
        int offset = ipHeaderLength;

        udp.sourcePort = buffer.getShort(offset) & 0xFFFF;
        udp.destPort = buffer.getShort(offset + 2) & 0xFFFF;

        return udp;
    }
}
