// src/app/api/nextdns/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

const PROFILE_ID = '857b18';
const API_BASE_URL = 'https://api.nextdns.io';

const getApiKey = (): string => {
  const apiKey = process.env.NEXTDNS_API_KEY;
  if (!apiKey) {
    throw new Error('NEXTDNS_API_KEY no está configurada');
  }
  return apiKey;
};

// Inicializar Firebase Admin si no está
function getRtdb() {
  if (!admin.apps.length) {
    try {
      const dbUrl = process.env.FIREBASE_DATABASE_URL || 
                    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 
                    'https://studio-7637044995-2342d-default-rtdb.firebaseio.com/';
      
      console.log('📡 Inicializando Firebase con URL:', dbUrl);
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: dbUrl
      });
      
      console.log('✅ Firebase Admin inicializado');
    } catch (error) {
      console.error('❌ Error inicializando Firebase:', error);
      return null;
    }
  }
  
  try {
    return admin.database();
  } catch (error) {
    console.error('❌ Error obteniendo RTDB:', error);
    return null;
  }
}

// GET: Obtener logs manualmente
export async function GET(request: NextRequest) {
  console.log('🔍 GET /api/nextdns/logs - Iniciando...');
  try {
    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit') || '10');
    if (limit < 10) limit = 10;
    if (limit > 100) limit = 100;
    
    const url = `${API_BASE_URL}/profiles/${PROFILE_ID}/logs?limit=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': getApiKey(),
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error obteniendo logs de NextDNS:', error);
      return NextResponse.json(
        { error: 'Error al obtener logs' },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    const data = result.data || [];
    const blockedLogs = data.filter((log: any) => log.status === 'blocked');
    
    return NextResponse.json({
      success: true,
      total: data.length,
      blocked: blockedLogs.length,
      logs: blockedLogs,
    });
  } catch (error) {
    console.error('Error en GET /api/nextdns/logs:', error);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}

// POST: Sincronizar logs con RTDB
export async function POST(request: NextRequest) {
  console.log('🔍 POST /api/nextdns/logs - Iniciando sincronización...');
  
  try {
    const { limit = 50 } = await request.json();
    
    const url = `${API_BASE_URL}/profiles/${PROFILE_ID}/logs?limit=${Math.min(limit, 100)}`;
    
    console.log(`🌐 Fetching: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': getApiKey(),
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Error obteniendo logs de NextDNS');
    }
    
    const result = await response.json();
    const data = result.data || [];
    
    // LOG PARA VER QUÉ DEVUELVE LA API
    if (data.length > 0) {
      console.log('🔍 Primer log COMPLETO:', JSON.stringify(data[0], null, 2));
      console.log('🔍 device:', data[0].device);
      console.log('🔍 device?.id:', data[0].device?.id);
      console.log('🔍 device_id:', data[0].device_id);
      console.log('🔍 device_name:', data[0].device_name);
    }
    
    const blockedLogs = data.filter((log: any) => log.status === 'blocked');
    
    console.log(`📊 Encontrados: ${blockedLogs.length} logs bloqueados`);
    
    let savedCount = 0;
    
    if (blockedLogs.length > 0) {
      const rtdb = getRtdb();
      
      if (!rtdb) {
        throw new Error('RTDB no disponible - Firebase no inicializado');
      }
      
      for (const log of blockedLogs) {
        // PRIORIDAD: device?.id (de la API de NextDNS)
        let deviceId = log.device?.id || log.device_id || log.device_name || 'desconocido';
        
        console.log(`🔍 Extrayendo deviceId: log.device?.id=${log.device?.id}, log.device_id=${log.device_id}, log.device_name=${log.device_name}, resultado=${deviceId}`);
        
        const reasons = log.reasons?.map((r: any) => r.name || r.id).join(', ') || 'NextDNS';
        const alertId = `nextdns_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        const alertData = {
          tipo: 'url_prohibida',
          detalle: `🚫 NextDNS bloqueó: ${log.domain} - ${reasons}`,
          timestamp: new Date(log.timestamp).getTime(),
          deviceId: deviceId,
          leido: false,
          nextdns_info: {
            domain: log.domain,
            root: log.root,
            reasons: reasons,
            protocol: log.protocol
          }
        };
        
        await rtdb.ref(`alertas_seguridad/${alertId}`).set(alertData);
        savedCount++;
        console.log(`💾 Guardado: ${log.domain} -> ${deviceId}`);
      }
    }
    
    console.log(`✅ Sincronización completada: ${savedCount} bloqueos guardados`);
    
    return NextResponse.json({
      success: true,
      totalBlocked: blockedLogs.length,
      savedToRTDB: savedCount,
      message: `${savedCount} bloqueos de NextDNS guardados en alertas_seguridad`
    });
  } catch (error) {
    console.error('Error en POST /api/nextdns/logs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}