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

// --- PARA BACKUP OCASIONAL A FIRESTORE ---
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

// --- PARA WEBSOCKET LOCAL ---
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

import org.json.JSONObject;
import org.json.JSONException;

import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

public class MonitorService extends AccessibilityService {
    private static final String TAG = "MonitorService";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";
    private static final String KEY_ALUMNO = "alumno_asignado";
    private static final String KEY_SERVER_MODE = "server_mode";
    private static final String KEY_SERVER_URL = "server_url";
    
    // Realtime Database
    private DatabaseReference mDatabase;
    private ValueEventListener techModeListener;
    
    // Firestore para backup (opcional)
    private FirebaseFirestore firestore;
    
    // WebSocket para servidor local
    private String serverMode = "cloud"; // cloud, local, hybrid
    private String serverUrl = "";
    private WebSocket localWebSocket;
    private OkHttpClient client;
    
    private String deviceDocId;
    private String institutoId;
    private String alumnoActual;
    private boolean isServiceActive = true;
    private boolean adminMode = false; // Modo Técnico (Acceso Total)
    
    // --- OPTIMIZACIÓN DE TIEMPO REAL ---
    private static final long HEARTBEAT_INTERVAL = 30000; // 30 SEGUNDOS
    private static final long WRITE_DELAY = 5000;        // 5 segundos entre reportes de URL
    private static final long BACKUP_INTERVAL = 86400000; // 24 horas para backup a Firestore
    private static final int MAX_ALERTAS_POR_DISPOSITIVO = 200; // Máximo 200 alertas por dispositivo
    
    private String ultimaUrlReportada = "";
    private long lastWriteTime = 0;
    private Timer heartbeatTimer;
    private long ultimoHeartbeatExitoso = 0;
    private long ultimoBackupFirestore = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        
        // Inicializar Realtime Database
        mDatabase = FirebaseDatabase.getInstance().getReference();
        
        // Inicializar Firestore para backup
        firestore = FirebaseFirestore.getInstance();
        
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        deviceDocId = prefs.getString(KEY_DEVICE_ID, null);
        institutoId = prefs.getString(KEY_INSTITUTO_ID, null);
        alumnoActual = prefs.getString(KEY_ALUMNO, "Sin asignar");
        
        Log.d(TAG, "MonitorService iniciado. Device ID: " + deviceDocId);
        
        if (deviceDocId != null) {
            cargarConfiguracionLocal(); // Cargar modo de conexión
            iniciarListenerControl();
            startHeartbeat();
            limpiarAlertasAntiguas(); // Limpiar al iniciar
        }
    }

    // ============================================================
    // CONFIGURACIÓN LOCAL (para servidor propio)
    // ============================================================
    private void cargarConfiguracionLocal() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        
        // Leer configuración guardada por el selector web
        String appConfig = prefs.getString("app_config", null);
        if (appConfig != null) {
            try {
                JSONObject config = new JSONObject(appConfig);
                serverMode = config.optString("mode", "cloud");
                serverUrl = config.optString("url", "");
                
                Log.d(TAG, "📡 Configuración cargada: modo=" + serverMode + ", url=" + serverUrl);
                
                // Si es modo local, conectar WebSocket
                if (serverMode.equals("local") && !serverUrl.isEmpty()) {
                    conectarWebSocketLocal();
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error parseando app_config: " + e.getMessage());
            }
        }
    }

    private void conectarWebSocketLocal() {
        if (serverUrl.isEmpty() || deviceDocId == null) return;
        
        // Limpiar URL (quitar http://, dejar solo IP:puerto)
        String wsUrl = serverUrl.replace("http://", "ws://").replace("https://", "wss://");
        String fullUrl = wsUrl + "?deviceId=" + deviceDocId;
        
        client = new OkHttpClient();
        Request request = new Request.Builder().url(fullUrl).build();
        
        localWebSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, okhttp3.Response response) {
                Log.d(TAG, "✅ WebSocket local conectado: " + wsUrl);
                
                // Enviar heartbeat inicial
                try {
                    JSONObject hello = new JSONObject();
                    hello.put("type", "register");
                    hello.put("deviceId", deviceDocId);
                    hello.put("alumno", alumnoActual);
                    webSocket.send(hello.toString());
                } catch (JSONException e) {
                    Log.e(TAG, "Error en registro WebSocket: " + e.getMessage());
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                Log.d(TAG, "📨 Mensaje recibido: " + text);
                
                // Procesar comandos desde el servidor local
                try {
                    JSONObject msg = new JSONObject(text);
                    String type = msg.optString("type");
                    
                    if ("comando".equals(type)) {
                        String comando = msg.optString("comando");
                        if ("bloquear".equals(comando)) {
                            ejecutarBloqueoLocal();
                        } else if ("desbloquear".equals(comando)) {
                            adminMode = true;
                        }
                    }
                } catch (JSONException e) {
                    Log.e(TAG, "Error procesando mensaje: " + e.getMessage());
                }
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                Log.d(TAG, "WebSocket cerrado: " + reason);
                // Reintentar después de 5 segundos
                new android.os.Handler().postDelayed(() -> {
                    if (serverMode.equals("local")) {
                        conectarWebSocketLocal();
                    }
                }, 5000);
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, okhttp3.Response response) {
                Log.e(TAG, "❌ Error WebSocket: " + t.getMessage());
                // Reintentar después de 10 segundos
                new android.os.Handler().postDelayed(() -> {
                    if (serverMode.equals("local")) {
                        conectarWebSocketLocal();
                    }
                }, 10000);
            }
        });
    }

    private void ejecutarBloqueoLocal() {
        adminMode = false;
        
        // Notificar al servidor local
        if (localWebSocket != null && serverMode.equals("local")) {
            try {
                JSONObject notif = new JSONObject();
                notif.put("type", "bloqueado");
                notif.put("deviceId", deviceDocId);
                localWebSocket.send(notif.toString());
            } catch (JSONException e) {
                Log.e(TAG, "Error notificando bloqueo: " + e.getMessage());
            }
        }
    }

    // ============================================================
    // LISTENER DE CONTROL TÉCNICO
    // ============================================================
    private void iniciarListenerControl() {
        DatabaseReference controlRef = mDatabase.child("dispositivos").child(deviceDocId).child("admin_mode_enable");
        
        techModeListener = new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                Boolean enabled = snapshot.getValue(Boolean.class);
                adminMode = (enabled != null && enabled);
                Log.d(TAG, "ESTADO TÉCNICO: " + (adminMode ? "LIBERADO" : "PROTEGIDO"));
                
                // Registrar cambio de modo como alerta
                if (enabled != null && enabled) {
                    registrarAlertaConLimite("MODO_TECNICO", "Acceso técnico activado", "");
                }
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error en listener RTDB: " + error.getMessage());
            }
        };
        
        controlRef.addValueEventListener(techModeListener);
    }

    // ============================================================
    // GESTIÓN DE ALERTAS (HÍBRIDO: RTDB + WebSocket Local)
    // ============================================================
    private void registrarAlertaConLimite(String tipo, String descripcion, String detalle) {
        if (deviceDocId == null) return;
        
        long timestamp = System.currentTimeMillis();
        
        // 1. Si está en modo local, enviar por WebSocket
        if (serverMode.equals("local") && localWebSocket != null) {
            try {
                JSONObject alertaWS = new JSONObject();
                alertaWS.put("type", "alerta");
                alertaWS.put("deviceId", deviceDocId);
                alertaWS.put("tipo", tipo);
                alertaWS.put("descripcion", descripcion);
                alertaWS.put("detalle", detalle);
                alertaWS.put("timestamp", timestamp);
                alertaWS.put("alumno", alumnoActual);
                
                localWebSocket.send(alertaWS.toString());
                Log.d(TAG, "📤 Alerta enviada por WebSocket local");
            } catch (JSONException e) {
                Log.e(TAG, "Error enviando alerta por WebSocket: " + e.getMessage());
            }
        }
        
        // 2. SIEMPRE guardar en RTDB (backup)
        String key = String.valueOf(timestamp);
        DatabaseReference alertaRef = mDatabase
            .child("alertas")
            .child(deviceDocId)
            .child(key);
        
        Map<String, Object> alerta = new HashMap<>();
        alerta.put("tipo", tipo);
        alerta.put("descripcion", descripcion);
        alerta.put("detalle", detalle);
        alerta.put("timestamp", timestamp);
        alerta.put("estado", "nuevo");
        alerta.put("InstitutoId", institutoId != null ? institutoId : "");
        alerta.put("alumno", alumnoActual != null ? alumnoActual : "Sin asignar");
        alerta.put("leida", false);
        
        alertaRef.setValue(alerta)
            .addOnSuccessListener(aVoid -> {
                Log.d(TAG, "Alerta registrada en RTDB: " + tipo);
                mantenerUltimasNAlertas(MAX_ALERTAS_POR_DISPOSITIVO);
            })
            .addOnFailureListener(e -> Log.e(TAG, "Error registrando alerta: " + e.getMessage()));
        
        // 3. Backup a Firestore (solo una vez al día)
        long ahora = System.currentTimeMillis();
        if (ahora - ultimoBackupFirestore > BACKUP_INTERVAL) {
            backupAlertasFirestore();
            ultimoBackupFirestore = ahora;
        }
    }

    private void mantenerUltimasNAlertas(int maxAlertas) {
        DatabaseReference alertasRef = mDatabase.child("alertas").child(deviceDocId);
        
        alertasRef.orderByChild("timestamp").addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                long totalAlertas = snapshot.getChildrenCount();
                
                if (totalAlertas > maxAlertas) {
                    long aBorrar = totalAlertas - maxAlertas;
                    long contador = 0;
                    
                    for (DataSnapshot child : snapshot.getChildren()) {
                        if (contador < aBorrar) {
                            child.getRef().removeValue()
                                .addOnSuccessListener(aVoid -> 
                                    Log.d(TAG, "Alerta antigua eliminada: " + child.getKey()))
                                .addOnFailureListener(e -> 
                                    Log.e(TAG, "Error eliminando alerta: " + e.getMessage()));
                            contador++;
                        } else {
                            break;
                        }
                    }
                    Log.d(TAG, "Limpieza completada: " + aBorrar + " alertas eliminadas");
                }
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error en limpieza de alertas: " + error.getMessage());
            }
        });
    }

    private void limpiarAlertasAntiguas() {
        DatabaseReference alertasRef = mDatabase.child("alertas").child(deviceDocId);
        
        // Eliminar alertas de más de 7 días
        long hace7Dias = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000);
        
        alertasRef.orderByChild("timestamp").addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                int eliminadas = 0;
                
                for (DataSnapshot child : snapshot.getChildren()) {
                    Long timestamp = child.child("timestamp").getValue(Long.class);
                    if (timestamp != null && timestamp < hace7Dias) {
                        child.getRef().removeValue();
                        eliminadas++;
                    }
                }
                
                if (eliminadas > 0) {
                    Log.d(TAG, "Limpieza por antigüedad: " + eliminadas + " alertas eliminadas");
                }
                
                // Luego aplicar límite de cantidad
                mantenerUltimasNAlertas(MAX_ALERTAS_POR_DISPOSITIVO);
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error en limpieza por antigüedad: " + error.getMessage());
            }
        });
    }

    private void backupAlertasFirestore() {
        if (deviceDocId == null || firestore == null) return;
        
        DatabaseReference alertasRef = mDatabase.child("alertas").child(deviceDocId);
        alertasRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                for (DataSnapshot alertaSnap : snapshot.getChildren()) {
                    Map<String, Object> alerta = (Map<String, Object>) alertaSnap.getValue();
                    if (alerta != null) {
                        alerta.put("backupTimestamp", FieldValue.serverTimestamp());
                        
                        firestore.collection("alertas_historicas")
                            .add(alerta)
                            .addOnFailureListener(e -> Log.e(TAG, "Error backup Firestore: " + e.getMessage()));
                    }
                }
                Log.d(TAG, "Backup de alertas completado");
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error leyendo alertas para backup: " + error.getMessage());
            }
        });
    }

    // ============================================================
    // PROCESAMIENTO DE EVENTOS DE ACCESIBILIDAD
    // ============================================================
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!isServiceActive || deviceDocId == null || adminMode) return;

        int type = event.getEventType();
        
        // Detectar intentos de abrir Configuración
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence packageName = event.getPackageName();
            if (packageName != null && packageName.toString().contains("settings")) {
                registrarAlertaConLimite(
                    "INTENTO_AJUSTES",
                    "Acceso denegado a configuración",
                    packageName.toString()
                );
            }
        }
        
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
            
            // Filtro de navegadores
            if (packageStr.contains("chrome") || packageStr.contains("browser") ||
                packageStr.contains("firefox") || packageStr.contains("opera") ||
                packageStr.contains("edge") || packageStr.contains("samsung.android.app.sbrowser")) {
                
                url = extraerUrl(event);
            }
            
            if (url != null && !url.isEmpty()) {
                actualizarUrlActual(url);
                
                // Detectar sitios bloqueados
                if (url.contains("facebook") || url.contains("tiktok") || url.contains("instagram")) {
                    registrarAlertaConLimite(
                        "SITIO_BLOQUEADO",
                        "Intento de acceso a sitio restringido",
                        url
                    );
                }
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
        }, 5000, HEARTBEAT_INTERVAL);
    }

    private void enviarHeartbeat() {
        if (deviceDocId == null || !isServiceActive) return;
        
        long ahora = System.currentTimeMillis();
        
        if (ahora - ultimoHeartbeatExitoso < 20000) return; 
        
        Map<String, Object> heartbeat = new HashMap<>();
        heartbeat.put("ultimoHeartbeat", ServerValue.TIMESTAMP);
        heartbeat.put("online", true);
        
        mDatabase.child("dispositivos").child(deviceDocId)
            .updateChildren(heartbeat)
            .addOnSuccessListener(aVoid -> {
                ultimoHeartbeatExitoso = ahora;
                Log.d(TAG, "Heartbeat OK");
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
        
        if (techModeListener != null && deviceDocId != null) {
            mDatabase.child("dispositivos").child(deviceDocId).child("admin_mode_enable")
                .removeEventListener(techModeListener);
        }
        
        if (heartbeatTimer != null) {
            heartbeatTimer.cancel();
            heartbeatTimer = null;
        }
        
        // Cerrar WebSocket local
        if (localWebSocket != null) {
            localWebSocket.close(1000, "Service destroyed");
            localWebSocket = null;
        }
        
        if (client != null) {
            client.dispatcher().executorService().shutdown();
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
        Log.d(TAG, "Accesibilidad configurada");
    }
}