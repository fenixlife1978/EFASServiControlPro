// src/app/api/nextdns/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminRtdb } from '@/lib/firebase-admin';

const PROFILE_ID = '857b18';
const API_BASE_URL = 'https://api.nextdns.io';

const getApiKey = (): string => {
  const apiKey = process.env.NEXTDNS_API_KEY;
  if (!apiKey) {
    throw new Error('NEXTDNS_API_KEY no está configurada');
  }
  return apiKey;
};

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

// POST: Sincronizar logs con RTDB (usado por cron-job.org)
export async function POST(request: NextRequest) {
  console.log('🔍 POST /api/nextdns/logs - Iniciando sincronización...');
  
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ Token no autorizado');
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    );
  }
  
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
    const blockedLogs = data.filter((log: any) => log.status === 'blocked');
    
    console.log(`📊 Encontrados: ${blockedLogs.length} logs bloqueados`);
    
    let savedCount = 0;
    
    if (blockedLogs.length > 0) {
      const rtdb = adminRtdb.database;
      
      if (!rtdb) {
        throw new Error('RTDB no disponible');
      }
      
      for (const log of blockedLogs) {
        let deviceId = log.device_name || log.device_id || 'desconocido';
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
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}