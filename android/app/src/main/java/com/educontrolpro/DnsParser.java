package com.educontrolpro;

import java.nio.ByteBuffer;

public class DnsParser {

    public static String parseDomain(ByteBuffer buffer, int ipHeaderLength, int udpHeaderLength) {
        try {
            int offset = ipHeaderLength + udpHeaderLength;
            
            // Saltar cabecera DNS (12 bytes)
            offset += 12;
            
            StringBuilder domain = new StringBuilder();
            
            // Leer primer label
            int length = buffer.get(offset) & 0xFF;
            offset++;

            while (length > 0) {
                for (int i = 0; i < length; i++) {
                    domain.append((char) buffer.get(offset++));
                }
                length = buffer.get(offset) & 0xFF;
                offset++;
                if (length > 0) domain.append(".");
            }

            return domain.toString();
        } catch (Exception e) {
            return "";
        }
    }
    
    public static boolean esConsultaDns(ByteBuffer buffer, int ipHeaderLength, int udpHeaderLength) {
        try {
            int offset = ipHeaderLength + udpHeaderLength;
            
            // Verificar que sea una consulta (primer byte indica tipo de mensaje)
            // 0x00 = Query
            int qr = (buffer.get(offset) >> 7) & 0x01;
            return qr == 0; // 0 = consulta, 1 = respuesta
        } catch (Exception e) {
            return false;
        }
    }
}
