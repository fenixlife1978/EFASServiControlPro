package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

// --- MIGRACIÓN A REALTIME DATABASE ---
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.google.firebase.database.ValueEventListener;

import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

public class MonitorService extends AccessibilityService {
    private static final String TAG = "MonitorService";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";
    
    private DatabaseReference mDatabase;
    private ValueEventListener techModeListener;
    
    private String deviceDocId;
    private boolean isServiceActive = true;
    private boolean adminMode = false; // Modo Técnico (Acceso Total)
    
    // --- OPTIMIZACIÓN DE TIEMPO REAL ---
    private static final long HEARTBEAT_INTERVAL = 30000; // 30 SEGUNDOS (Ilimitado en RTDB)
    private static final long WRITE_DELAY = 5000;        // 5 segundos entre reportes de URL
    
    private String ultimaUrlReportada = "";
    private long lastWriteTime = 0;
    private Timer heartbeatTimer;
    private long ultimoHeartbeatExitoso = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        
        // Inicializar Realtime Database
        mDatabase = FirebaseDatabase.getInstance().getReference();
        
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        deviceDocId = prefs.getString(KEY_DEVICE_ID, null);
        
        Log.d(TAG, "MonitorService iniciado en RTDB. Device ID: " + deviceDocId);
        
        if (deviceDocId != null) {
            iniciarListenerControl(); // Escuchar cambios en el switch del dashboard (RTDB)
            startHeartbeat();         // Iniciar pulso cada 30 segundos
        }
    }

    // LISTENER EN TIEMPO REAL: Responde al switch "Acceso Técnico" casi al instante
    private void iniciarListenerControl() {
        DatabaseReference controlRef = mDatabase.child("dispositivos").child(deviceDocId).child("admin_mode_enable");
        
        techModeListener = new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                Boolean enabled = snapshot.getValue(Boolean.class);
                adminMode = (enabled != null && enabled);
                Log.d(TAG, "ESTADO TÉCNICO ACTUALIZADO: " + (adminMode ? "LIBERADO" : "PROTEGIDO"));
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error en listener RTDB: " + error.getMessage());
            }
        };
        
        controlRef.addValueEventListener(techModeListener);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Si el admin activó el Modo Técnico, el servicio ignora la navegación
        if (!isServiceActive || deviceDocId == null || adminMode) return;

        int type = event.getEventType();
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || 
            type == AccessibilityEvent.TYPE_VIEW_CLICKED ||
            type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            
            procesarEvento(event);
        }
    }

    private void procesarEvento(AccessibilityEvent event) {
        try {
            CharSequence packageName = event.getPackageName();
            if (packageName == null) return;
            
            String packageStr = packageName.toString();
            String url = null;
            
            // Filtro de navegadores compatibles
            if (packageStr.contains("chrome") || packageStr.contains("browser") ||
                packageStr.contains("firefox") || packageStr.contains("opera") ||
                packageStr.contains("edge") || packageStr.contains("samsung.android.app.sbrowser")) {
                
                url = extraerUrl(event);
            }
            
            if (url != null && !url.isEmpty()) {
                actualizarUrlActual(url);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error procesando navegación: " + e.getMessage());
        }
    }

    private String extraerUrl(AccessibilityEvent event) {
        AccessibilityNodeInfo nodeInfo = event.getSource();
        if (nodeInfo != null) {
            String url = buscarUrlEnNodos(nodeInfo);
            nodeInfo.recycle();
            return url;
        }
        return null;
    }

    private String buscarUrlEnNodos(AccessibilityNodeInfo node) {
        if (node == null) return null;
        
        if (node.getClassName() != null) {
            String className = node.getClassName().toString();
            if (className.contains("EditText") || className.contains("UrlBar") || 
                className.contains("SearchBox") || className.contains("AutoCompleteTextView")) {
                
                CharSequence text = node.getText();
                if (text != null && text.length() > 0 && esUrlValida(text.toString())) {
                    return text.toString();
                }
            }
        }
        
        // Escaneo de nodos hijos (limitado a 5 niveles para optimizar CPU)
        for (int i = 0; i < Math.min(node.getChildCount(), 5); i++) {
            String result = buscarUrlEnNodos(node.getChild(i));
            if (result != null) return result;
        }
        return null;
    }

    private boolean esUrlValida(String texto) {
        if (texto == null || texto.isEmpty()) return false;
        String t = texto.toLowerCase();
        return t.contains("http") || t.contains(".") || t.contains("www");
    }

    private void actualizarUrlActual(String url) {
        String urlLimpia = limpiarUrl(url);
        if (urlLimpia.isEmpty() || urlLimpia.equals(ultimaUrlReportada)) return;
        
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastWriteTime < WRITE_DELAY) return;
        
        ultimaUrlReportada = urlLimpia;
        lastWriteTime = currentTime;
        
        // Reporte a RTDB
        Map<String, Object> updates = new HashMap<>();
        updates.put("url_actual", urlLimpia);
        updates.put("ultimoAcceso", ServerValue.TIMESTAMP);
        updates.put("online", true);

        mDatabase.child("dispositivos").child(deviceDocId).updateChildren(updates);
    }

    private String limpiarUrl(String url) {
        if (url == null) return "";
        url = url.toLowerCase().trim();
        if (url.startsWith("http://")) url = url.substring(7);
        if (url.startsWith("https://")) url = url.substring(8);
        if (url.startsWith("www.")) url = url.substring(4);
        
        int queryIndex = url.indexOf('?');
        if (queryIndex > 0) url = url.substring(0, queryIndex);
        
        if (url.length() > 100) url = url.substring(0, 100);
        return url;
    }

    private void startHeartbeat() {
        if (heartbeatTimer != null) heartbeatTimer.cancel();
        
        heartbeatTimer = new Timer();
        heartbeatTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                enviarHeartbeat();
            }
        }, 5000, HEARTBEAT_INTERVAL); // Inicia a los 5 seg, luego cada 30 seg
    }

    private void enviarHeartbeat() {
        if (deviceDocId == null || !isServiceActive) return;
        
        long ahora = System.currentTimeMillis();
        
        // Evita duplicados en menos de 20 segundos
        if (ahora - ultimoHeartbeatExitoso < 20000) return; 
        
        Map<String, Object> heartbeat = new HashMap<>();
        heartbeat.put("ultimoHeartbeat", ServerValue.TIMESTAMP);
        heartbeat.put("online", true);
        
        mDatabase.child("dispositivos").child(deviceDocId)
            .updateChildren(heartbeat)
            .addOnSuccessListener(aVoid -> {
                ultimoHeartbeatExitoso = ahora;
                Log.d(TAG, "Pulse OK (30s)");
            });
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "MonitorService interrumpido");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isServiceActive = false;
        
        // Limpieza de listeners para no dejar procesos abiertos
        if (techModeListener != null && deviceDocId != null) {
            mDatabase.child("dispositivos").child(deviceDocId).child("admin_mode_enable")
                .removeEventListener(techModeListener);
        }
        
        if (heartbeatTimer != null) {
            heartbeatTimer.cancel();
            heartbeatTimer = null;
        }
        Log.d(TAG, "MonitorService detenido");
    }

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                         AccessibilityEvent.TYPE_VIEW_CLICKED |
                         AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        info.notificationTimeout = 100;
        setServiceInfo(info);
        Log.d(TAG, "Configuración de accesibilidad cargada.");
    }
}