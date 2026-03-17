package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

import org.json.JSONObject;
import org.json.JSONException;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.Timer;
import java.util.TimerTask;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class MonitorService extends AccessibilityService {
    private static final String TAG = "MonitorService";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";
    private static final String KEY_ALUMNO = "alumno_asignado";
    private static final String KEY_SERVER_MODE = "server_mode";
    private static final String KEY_SERVER_URL = "server_url";

    private DatabaseReference mDatabase;
    private ValueEventListener techModeListener;
    private FirebaseFirestore firestore;

    // WebSocket local (selector de base de datos)
    private String serverMode = "cloud";
    private String serverUrl = "";
    private WebSocket localWebSocket;
    private OkHttpClient client;

    private String deviceDocId;
    private String institutoId;
    private String alumnoActual;
    private boolean isServiceActive = true;
    private boolean adminMode = false;

    // Listas prohibidas
    private Set<String> palabrasProhibidas = new HashSet<>();
    private Set<String> sitiosProhibidos = new HashSet<>();
    private Set<String> appsProhibidas = new HashSet<>();

    // Control de búsquedas
    private String ultimoTextoIngresado = "";
    private String paqueteNavegadorActual = "";
    private long ultimaExpulsionTime = 0;
    private static final long EXPULSION_COOLDOWN = 2000;

    // Optimización
    private static final long HEARTBEAT_INTERVAL = 30000;
    private static final long WRITE_DELAY = 5000;
    private static final long BACKUP_INTERVAL = 86400000;
    private static final int MAX_ALERTAS_POR_DISPOSITIVO = 200;

    private String ultimaUrlReportada = "";
    private long lastWriteTime = 0;
    private Timer heartbeatTimer;
    private long ultimoHeartbeatExitoso = 0;
    private long ultimoBackupFirestore = 0;

    // Timer para recargar listas cada 5 minutos
    private Timer recargaListasTimer;

    @Override
    public void onCreate() {
        super.onCreate();

        mDatabase = FirebaseDatabase.getInstance().getReference();
        firestore = FirebaseFirestore.getInstance();

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        deviceDocId = prefs.getString(KEY_DEVICE_ID, null);
        institutoId = prefs.getString(KEY_INSTITUTO_ID, null);
        alumnoActual = prefs.getString(KEY_ALUMNO, "Sin asignar");

        Log.d(TAG, "MonitorService iniciado. Device ID: " + deviceDocId);

        if (deviceDocId != null) {
            cargarConfiguracionLocal();
            iniciarListenerControl();
            cargarListasProhibidas();
            // Recargar listas cada 5 minutos para reflejar cambios en la blacklist
            iniciarRecargaPeriodica();
            startHeartbeat();
            limpiarAlertasAntiguas();
        }
    }

    private void iniciarRecargaPeriodica() {
        recargaListasTimer = new Timer();
        recargaListasTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                cargarListasProhibidas();
            }
        }, 300000, 300000); // 5 minutos
    }

    // ============================================================
    // CONFIGURACIÓN LOCAL
    // ============================================================
    private void cargarConfiguracionLocal() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String appConfig = prefs.getString("app_config", null);

        if (appConfig != null) {
            try {
                JSONObject config = new JSONObject(appConfig);
                serverMode = config.optString("mode", "cloud");
                serverUrl = config.optString("url", "");

                Log.d(TAG, "📡 Configuración: modo=" + serverMode + ", url=" + serverUrl);

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

        String wsUrl = serverUrl.replace("http://", "ws://").replace("https://", "wss://");
        String fullUrl = wsUrl + "?deviceId=" + deviceDocId;

        client = new OkHttpClient();
        Request request = new Request.Builder().url(fullUrl).build();

        localWebSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, okhttp3.Response response) {
                Log.d(TAG, "✅ WebSocket local conectado");
                try {
                    JSONObject hello = new JSONObject();
                    hello.put("type", "register");
                    hello.put("deviceId", deviceDocId);
                    hello.put("alumno", alumnoActual);
                    webSocket.send(hello.toString());
                } catch (JSONException e) {
                    Log.e(TAG, "Error en registro: " + e.getMessage());
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                Log.d(TAG, "📨 Mensaje: " + text);
                try {
                    JSONObject msg = new JSONObject(text);
                    if ("comando".equals(msg.optString("type"))) {
                        String comando = msg.optString("comando");
                        if ("bloquear".equals(comando)) {
                            adminMode = false;
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
                Log.d(TAG, "WebSocket cerrado, reconectando...");
                new android.os.Handler().postDelayed(() -> {
                    if (serverMode.equals("local")) conectarWebSocketLocal();
                }, 5000);
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, okhttp3.Response response) {
                Log.e(TAG, "❌ Error WebSocket: " + t.getMessage());
                new android.os.Handler().postDelayed(() -> {
                    if (serverMode.equals("local")) conectarWebSocketLocal();
                }, 10000);
            }
        });
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

                if (adminMode) {
                    Log.w(TAG, "🔓 MODO TÉCNICO ACTIVADO - TODAS LAS FUNCIONES SUSPENDIDAS");
                    Toast.makeText(MonitorService.this,
                            "🔓 MODO TÉCNICO - Monitor suspendido", Toast.LENGTH_SHORT).show();
                } else {
                    Log.i(TAG, "🔒 MODO TÉCNICO DESACTIVADO - Monitor activo");
                    Toast.makeText(MonitorService.this,
                            "🔒 Monitor de seguridad activado", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error en listener: " + error.getMessage());
            }
        };

        controlRef.addValueEventListener(techModeListener);
    }

    // ============================================================
    // CARGAR LISTAS PROHIBIDAS (con logs mejorados)
    // ============================================================
    private void cargarListasProhibidas() {
        if (institutoId == null) return;

        DatabaseReference instRef = mDatabase.child("instituciones").child(institutoId).child("config");

        instRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                palabrasProhibidas.clear();
                sitiosProhibidos.clear();
                appsProhibidas.clear();

                // 1. Palabras prohibidas (array específico)
                DataSnapshot palabrasSnap = snapshot.child("palabras_prohibidas");
                if (palabrasSnap.exists()) {
                    for (DataSnapshot palabra : palabrasSnap.getChildren()) {
                        String valor = palabra.getValue(String.class);
                        if (valor != null) {
                            palabrasProhibidas.add(valor.toLowerCase());
                        }
                    }
                    Log.d(TAG, "📋 Palabras prohibidas (específicas): " + palabrasProhibidas.size());
                } else {
                    Log.d(TAG, "⚠️ No hay campo 'palabras_prohibidas'");
                }

                // 2. Apps prohibidas (array específico)
                DataSnapshot appsSnap = snapshot.child("apps_prohibidas");
                if (appsSnap.exists()) {
                    for (DataSnapshot app : appsSnap.getChildren()) {
                        String valor = app.getValue(String.class);
                        if (valor != null) {
                            appsProhibidas.add(valor.toLowerCase());
                        }
                    }
                    Log.d(TAG, "📋 Apps prohibidas: " + appsProhibidas);
                } else {
                    Log.d(TAG, "⚠️ No hay campo 'apps_prohibidas'");
                }

                // 3. Blacklist (sitios) - también la usaremos para palabras y sitios
                DataSnapshot sitiosSnap = snapshot.child("blacklist");
                if (sitiosSnap.exists()) {
                    for (DataSnapshot sitio : sitiosSnap.getChildren()) {
                        String valor = sitio.getValue(String.class);
                        if (valor != null) {
                            String valorLower = valor.toLowerCase();
                            sitiosProhibidos.add(valorLower);
                            // Además, para búsquedas, añadimos cada elemento como palabra prohibida
                            // (para bloquear búsquedas que contengan "facebook", "porno", etc.)
                            palabrasProhibidas.add(valorLower);
                        }
                    }
                    Log.d(TAG, "📋 Blacklist cargada: " + sitiosProhibidos.size() + " sitios");
                } else {
                    Log.d(TAG, "⚠️ No hay campo 'blacklist'");
                }

                Log.d(TAG, "📋 TOTAL: Palabras=" + palabrasProhibidas.size() +
                        ", Sitios=" + sitiosProhibidos.size() +
                        ", Apps=" + appsProhibidas.size());

                // Mostrar algunos ejemplos para depuración
                if (!palabrasProhibidas.isEmpty()) {
                    Log.d(TAG, "Ejemplos palabras: " + palabrasProhibidas.iterator().next());
                }
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error cargando listas: " + error.getMessage());
            }
        });
    }

    // ============================================================
    // PROCESAMIENTO DE EVENTOS
    // ============================================================
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (adminMode || !isServiceActive || deviceDocId == null) return;

        int type = event.getEventType();
        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";

        // Log para depuración (opcional, comentar en producción)
        // Log.d(TAG, "Evento: " + type + " paquete: " + packageName);

        // ========================================================
        // DETECTAR APPS PROHIBIDAS Y CONFIGURACIÓN
        // ========================================================
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            // Configuración - siempre prohibida
            if (packageName.contains("settings") ||
                    packageName.contains("configuración") ||
                    packageName.contains("com.android.settings")) {
                Log.i(TAG, "🔴 Intento de abrir Configuración: " + packageName);
                expulsarConMensaje("INTENTO_AJUSTES",
                        "Acceso a configuración bloqueado - Contacte al administrador");
                return;
            }

            // Apps prohibidas
            for (String appProhibida : appsProhibidas) {
                // Usamos startsWith para evitar falsos positivos (ej. "com.facebook.katana" vs "com.facebook.orca")
                if (packageName.startsWith(appProhibida)) {
                    Log.i(TAG, "🔴 App prohibida detectada: " + packageName + " (coincide con " + appProhibida + ")");
                    expulsarConMensaje("APP_PROHIBIDA",
                            "App no permitida: " + appProhibida);
                    return;
                }
            }
        }

        // ========================================================
        // CAPTURAR TEXTO INGRESADO (solo en navegadores)
        // ========================================================
        if (type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED && esNavegador(packageName)) {
            capturarTextoIngresado(event, packageName);
        }

        // ========================================================
        // DETECTAR ACCIÓN DE BÚSQUEDA (CLICK O ENTER)
        // ========================================================
        if (type == AccessibilityEvent.TYPE_VIEW_CLICKED && esNavegador(packageName)) {
            procesarBusqueda(packageName);
        }

        // ========================================================
        // REPORTAR URL ACTUAL (cuando cambia la ventana en navegador)
        // ========================================================
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && esNavegador(packageName)) {
            String url = extraerUrl(event);
            if (url != null && !url.isEmpty()) {
                actualizarUrlActual(url);
            }
        }
    }

    // ============================================================
    // CAPTURAR TEXTO INGRESADO
    // ============================================================
    private void capturarTextoIngresado(AccessibilityEvent event, String packageName) {
        AccessibilityNodeInfo source = event.getSource();
        if (source != null) {
            CharSequence text = source.getText();
            if (text != null && text.length() > 0) {
                ultimoTextoIngresado = text.toString();
                paqueteNavegadorActual = packageName;
                Log.d(TAG, "📝 Texto capturado: " + ultimoTextoIngresado);
            }
            source.recycle();
        }
    }

    // ============================================================
    // PROCESAR BÚSQUEDA (SOLO AL HACER CLICK)
    // ============================================================
    private void procesarBusqueda(String packageName) {
        if (ultimoTextoIngresado.isEmpty()) {
            Log.d(TAG, "⚠️ Búsqueda sin texto previo, ignorando");
            return;
        }

        long ahora = System.currentTimeMillis();
        if (ahora - ultimaExpulsionTime < EXPULSION_COOLDOWN) {
            Log.d(TAG, "⏳ Cooldown activo, ignorando búsqueda");
            return;
        }

        String textoLower = ultimoTextoIngresado.toLowerCase();
        Log.d(TAG, "🔍 Procesando búsqueda: \"" + textoLower + "\"");

        // Verificar palabras prohibidas
        for (String palabra : palabrasProhibidas) {
            if (textoLower.contains(palabra)) {
                Log.i(TAG, "🚫 Palabra prohibida detectada: \"" + palabra + "\" en \"" + textoLower + "\"");
                ultimaExpulsionTime = ahora;
                expulsarConMensaje("PALABRA_PROHIBIDA",
                        "Búsqueda con término prohibido: " + palabra);
                return;
            }
        }

        // Verificar sitios prohibidos (para búsquedas que son URLs)
        for (String sitio : sitiosProhibidos) {
            if (textoLower.contains(sitio)) {
                Log.i(TAG, "🚫 Sitio prohibido detectado: \"" + sitio + "\" en búsqueda");
                ultimaExpulsionTime = ahora;
                expulsarConMensaje("SITIO_BLOQUEADO",
                        "Intento de acceso a sitio restringido");
                return;
            }
        }

        Log.d(TAG, "✅ Búsqueda permitida");
    }

    // ============================================================
    // EXPULSIÓN CON MENSAJE
    // ============================================================
    private void expulsarConMensaje(String tipo, String descripcion) {
        Log.w(TAG, "🚫 EXPULSIÓN: " + tipo + " - " + descripcion);

        Toast.makeText(this, "🚫 ACCESO PROHIBIDO - EDUControlPro", Toast.LENGTH_SHORT).show();

        registrarAlertaConLimite(tipo, descripcion, "");

        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(homeIntent);

        new android.os.Handler().postDelayed(this::limpiarCampoBusqueda, 500);
    }

    // ============================================================
    // LIMPIAR CAMPO DE BÚSQUEDA
    // ============================================================
    private void limpiarCampoBusqueda() {
        if (paqueteNavegadorActual.isEmpty()) return;

        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                limpiarNodos(root);
                root.recycle();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error limpiando campo: " + e.getMessage());
        }

        ultimoTextoIngresado = "";
        Log.d(TAG, "🧹 Campo de búsqueda limpiado");
    }

    private void limpiarNodos(AccessibilityNodeInfo node) {
        if (node == null) return;

        if (node.getClassName() != null &&
                (node.getClassName().toString().contains("EditText") ||
                        node.getClassName().toString().contains("UrlBar") ||
                        node.getClassName().toString().contains("SearchBox"))) {
            node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, null);
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            limpiarNodos(node.getChild(i));
        }
    }

    // ============================================================
    // REGISTRO DE ALERTAS
    // ============================================================
    private void registrarAlertaConLimite(String tipo, String descripcion, String detalle) {
        if (deviceDocId == null) return;

        long timestamp = System.currentTimeMillis();

        // 1. WebSocket local si aplica
        if (serverMode.equals("local") && localWebSocket != null) {
            try {
                JSONObject alertaWS = new JSONObject();
                alertaWS.put("type", "alerta");
                alertaWS.put("deviceId", deviceDocId);
                alertaWS.put("tipo", tipo);
                alertaWS.put("descripcion", descripcion);
                alertaWS.put("timestamp", timestamp);
                alertaWS.put("alumno", alumnoActual);
                localWebSocket.send(alertaWS.toString());
                Log.d(TAG, "📤 Alerta enviada por WebSocket");
            } catch (JSONException e) {
                Log.e(TAG, "Error en WebSocket: " + e.getMessage());
            }
        }

        // 2. RTDB
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
                    Log.d(TAG, "Alerta registrada: " + tipo);
                    mantenerUltimasNAlertas(MAX_ALERTAS_POR_DISPOSITIVO);
                })
                .addOnFailureListener(e -> Log.e(TAG, "Error registrando alerta: " + e.getMessage()));

        // 3. Backup diario a Firestore
        long ahora = System.currentTimeMillis();
        if (ahora - ultimoBackupFirestore > BACKUP_INTERVAL) {
            backupAlertasFirestore();
            ultimoBackupFirestore = ahora;
        }
    }

    // ============================================================
    // MANTENER SOLO LAS ÚLTIMAS N ALERTAS
    // ============================================================
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
                            child.getRef().removeValue();
                            contador++;
                        } else break;
                    }
                    Log.d(TAG, "Limpieza: " + aBorrar + " alertas eliminadas");
                }
            }
            @Override public void onCancelled(DatabaseError error) {}
        });
    }

    // ============================================================
    // LIMPIAR ALERTAS ANTIGUAS (MÁS DE 7 DÍAS)
    // ============================================================
    private void limpiarAlertasAntiguas() {
        DatabaseReference alertasRef = mDatabase.child("alertas").child(deviceDocId);
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
                    Log.d(TAG, "Limpieza antigüedad: " + eliminadas + " alertas");
                }
                mantenerUltimasNAlertas(MAX_ALERTAS_POR_DISPOSITIVO);
            }
            @Override public void onCancelled(DatabaseError error) {}
        });
    }

    // ============================================================
    // BACKUP A FIRESTORE (UNA VEZ AL DÍA)
    // ============================================================
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
                        firestore.collection("alertas_historicas").add(alerta);
                    }
                }
                Log.d(TAG, "Backup completado");
            }
            @Override public void onCancelled(DatabaseError error) {}
        });
    }

    // ============================================================
    // EXTRACCIÓN DE URL
    // ============================================================
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

    // ============================================================
    // ACTUALIZAR URL ACTUAL
    // ============================================================
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

    // ============================================================
    // HEARTBEAT
    // ============================================================
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

    // ============================================================
    // UTILIDADES
    // ============================================================
    private boolean esNavegador(String packageName) {
        return packageName.contains("chrome") ||
                packageName.contains("browser") ||
                packageName.contains("firefox") ||
                packageName.contains("opera") ||
                packageName.contains("edge") ||
                packageName.contains("samsung.android.app.sbrowser");
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

        if (recargaListasTimer != null) {
            recargaListasTimer.cancel();
            recargaListasTimer = null;
        }

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
                AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED |
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        info.notificationTimeout = 100;
        setServiceInfo(info);
        Log.d(TAG, "MonitorService configurado");
    }
}