package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.app.NotificationCompat;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    
    // VARIABLES DE IDENTIDAD
    private String deviceDocId;
    private String InstitutoId;
    private String aulaId;
    private String seccion;
    private String nombreInstituto;
    private String alumnoAsignado = "";
    
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage"; 
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin"; 
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    // VARIABLES DE ESTADO Y COMANDOS
    private boolean shieldMode = false;
    private boolean useBlacklist = false;
    private boolean useWhitelist = false;
    private boolean blockAllBrowsing = false;
    private boolean cortarNavegacion = false;
    private String bloqueoPin = "";
    private List<String> listaNegra = new ArrayList<>();
    private List<String> whitelist = new ArrayList<>();
    
    // Modo concentración (por aula)
    private boolean modoConcentracion = false;
    
    // Apps educativas (permitidas siempre en modo concentración)
    private List<String> appsEducativas = Arrays.asList(
        "com.microsoft.office.word",
        "com.microsoft.office.excel",
        "com.microsoft.office.powerpoint",
        "com.google.android.apps.docs",
        "com.google.android.apps.classroom",
        "com.google.android.apps.photos",
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.google.android.gm",
        "com.google.android.calendar",
        "com.google.android.apps.maps",
        "com.google.android.apps.drive",
        "com.google.android.apps.translate",
        "org.wikipedia",
        "com.duolingo",
        "com.khanacademy.android"
    );

    // Aplicaciones prohibidas de nacimiento
    private List<String> appsProhibidas = Arrays.asList(
        "com.android.vending",
        "com.google.android.gsf",
        "com.android.mms",
        "com.google.android.apps.messaging",
        "tiktok", "instagram", "facebook", "youtube", "twitter", "whatsapp", "telegram", "snapchat", "discord",
        "com.rovio.angrybirds", "com.supercell.clashofclans", "com.king.candycrushsaga", "com.mojang.minecraftpe",
        "com.epicgames.fortnite", "com.tencent.ig", "com.dts.freefireth", "com.playrix.homescapes", "com.playrix.fishdom",
        "com.netflix.mediaclient", "com.spotify.music", "com.amazon.avod.thirdpartyclient", "com.hulu.plus",
        "com.disney.disneyplus", "com.crunchyroll.crunchyroid",
        "com.mercadopago.wallet", "com.paypal.android.p2pmobile", "com.ubercab", "com.didiglobal.passenger",
        "com.alibaba.aliexpresshd", "com.amazon.mShop.android.shopping"
    );

    // Lista blanca de sistema
    private List<String> listaBlancaSistema = Arrays.asList(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.educontrolpro",
        "com.android.systemui",
        "com.google.android.googlequicksearchbox",
        "com.android.launcher3",
        "com.google.android.inputmethod.latin",
        "com.android.inputmethod.latin"
    );

    // ============================================================
    // PALABRAS PROHIBIDAS (hardcoded)
    // ============================================================
    private static final List<String> PALABRAS_PROHIBIDAS = Arrays.asList(
        "xxx",
        "porno",
        "pornos",
        "videos pornos",
        "juegos"
    );

    // Listeners
    private ListenerRegistration deviceListener;
    private ListenerRegistration institutionListener;
    private ListenerRegistration aulaListener;
    private ListenerRegistration securityListener;

    // Heartbeat
    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 30000;

    // Última URL reportada
    private String ultimaUrlReportada = "";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(1, getNotification());
        cargarIdentidad();
    }

    private void cargarIdentidad() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId     = capPrefs.getString("deviceId", null);
        InstitutoId     = capPrefs.getString("InstitutoId", null);
        aulaId          = capPrefs.getString("aulaId", null);
        seccion         = capPrefs.getString("seccion", null);
        nombreInstituto = capPrefs.getString("nombreInstituto", null);

        if (deviceDocId == null || InstitutoId == null) {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            deviceDocId = prefs.getString(KEY_DEVICE_ID, null);
        }
        
        if (deviceDocId != null) {
            db.collection("dispositivos").document(deviceDocId).get()
                .addOnSuccessListener(doc -> {
                    if (doc.exists()) {
                        alumnoAsignado = doc.getString("alumno_asignado");
                        if (alumnoAsignado == null) alumnoAsignado = "";
                    }
                });
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(CHANNEL_ID, "Monitoreo Educativo", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro Activo")
                .setContentText("Protección activa en el Instituto")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        
        if (deviceDocId != null && InstitutoId != null) {
            Log.d("EDU_Monitor", "VINCULACIÓN EXITOSA:");
            Log.d("EDU_Monitor", "Inst: " + nombreInstituto + " (" + InstitutoId + ")");
            Log.d("EDU_Monitor", "Aula/Secc: " + aulaId + " " + seccion);
            
            iniciarListeners(deviceDocId, InstitutoId);
            iniciarHeartbeat();
            reportarEstadoInicial();
            
        } else {
            Log.e("EDU_Monitor", "ERROR: Faltan datos críticos de identidad.");
        }
    }

    private void reportarEstadoInicial() {
        if (deviceDocId == null) return;
        
        Map<String, Object> estadoInicial = new HashMap<>();
        estadoInicial.put("online", true);
        estadoInicial.put("ultimoAcceso", FieldValue.serverTimestamp());
        estadoInicial.put("ultimaUrl", "");
        estadoInicial.put("servicioActivo", true);
        
        db.collection("dispositivos").document(deviceDocId)
            .update(estadoInicial)
            .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error reportando estado inicial", e));
    }

    private void iniciarHeartbeat() {
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (deviceDocId != null) {
                    Map<String, Object> heartbeat = new HashMap<>();
                    heartbeat.put("online", true);
                    heartbeat.put("ultimoAcceso", FieldValue.serverTimestamp());
                    
                    db.collection("dispositivos").document(deviceDocId)
                        .update(heartbeat)
                        .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error en heartbeat", e));
                }
                heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
            }
        };
        heartbeatHandler.post(heartbeatRunnable);
    }

    private void iniciarListeners(String docId, String instId) {
        // 1. LISTENER DEL DISPOSITIVO
        deviceListener = db.collection("dispositivos").document(docId)
            .addSnapshotListener((snapshot, e) -> {
                if (e != null) {
                    Log.e("EDU_Monitor", "Error en listener de dispositivo", e);
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    procesarCambiosDispositivo(snapshot);
                }
            });

        // 2. LISTENER DE LA INSTITUCIÓN (carga blacklist y whitelist)
        institutionListener = db.collection("institutions").document(instId)
            .addSnapshotListener((snapshot, e) -> {
                if (e != null) {
                    Log.e("EDU_Monitor", "Error en listener de institución", e);
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    procesarCambiosInstitucion(snapshot);
                }
            });

        // 3. LISTENER DEL AULA (para modo concentración)
        if (aulaId != null) {
            aulaListener = db.collection("institutions").document(instId)
                .collection("Aulas").document(aulaId)
                .addSnapshotListener((snapshot, e) -> {
                    if (e != null) {
                        Log.e("EDU_Monitor", "Error en listener de aula", e);
                        return;
                    }
                    if (snapshot != null && snapshot.exists()) {
                        Boolean concentracion = snapshot.getBoolean("modoConcentracion");
                        if (concentracion != null) {
                            modoConcentracion = concentracion;
                            Log.d("EDU_Monitor", "Modo concentración aula: " + modoConcentracion);
                        }
                    } else {
                        modoConcentracion = false;
                    }
                });
        }

        // 4. LISTENER DE SEGURIDAD GLOBAL
        securityListener = db.collection("system_config").document("security")
            .addSnapshotListener((snapshot, e) -> {
                if (e != null) {
                    Log.e("EDU_Monitor", "Error en listener de seguridad", e);
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    String pin = snapshot.getString("master_pin");
                    if (pin != null && !pin.isEmpty()) {
                        saveMasterPin(pin);
                    }
                }
            });
    }

    private void procesarCambiosDispositivo(DocumentSnapshot snapshot) {
        Boolean adminEnabled = snapshot.getBoolean("admin_mode_enable");
        Boolean shield = snapshot.getBoolean("shieldMode");
        Boolean cortarNavegacionCmd = snapshot.getBoolean("cortarNavegacion");
        Boolean bloquearCmd = snapshot.getBoolean("bloquear");
        String pinCmd = snapshot.getString("pinBloqueo");
        String nuevoAlumno = snapshot.getString("alumno_asignado");
        
        if (nuevoAlumno != null && !nuevoAlumno.isEmpty()) {
            alumnoAsignado = nuevoAlumno;
        }
        
        this.shieldMode = (shield != null && shield);
        this.cortarNavegacion = (cortarNavegacionCmd != null && cortarNavegacionCmd);
        
        if (pinCmd != null && !pinCmd.isEmpty()) {
            this.bloqueoPin = pinCmd;
            saveUnlockPin(pinCmd);
            Log.d("EDU_Monitor", "PIN de bloqueo actualizado");
        }
        
        saveUnlockState(adminEnabled != null && adminEnabled);
        
        if (bloquearCmd != null && bloquearCmd) {
            Log.d("EDU_Monitor", "Comando BLOQUEAR recibido");
            dispararBloqueoConDuracion(5000);
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (deviceDocId != null) {
                    db.collection("dispositivos").document(deviceDocId)
                        .update("bloquear", false);
                }
            }, 2000);
        }
    }

    private void procesarCambiosInstitucion(DocumentSnapshot snapshot) {
        Boolean blockAll = snapshot.getBoolean("blockAllBrowsing");
        Boolean useBlacklistFlag = snapshot.getBoolean("useBlacklist");
        Boolean useWhitelistFlag = snapshot.getBoolean("useWhitelist");
        List<String> blacklist = (List<String>) snapshot.get("blacklist");
        List<String> whitelistData = (List<String>) snapshot.get("whitelist");
        
        this.blockAllBrowsing = (blockAll != null && blockAll);
        this.useBlacklist = (useBlacklistFlag != null && useBlacklistFlag);
        this.useWhitelist = (useWhitelistFlag != null && useWhitelistFlag);
        
        if (blacklist != null) {
            this.listaNegra = blacklist;
        } else {
            this.listaNegra = new ArrayList<>();
        }
        
        if (whitelistData != null) {
            this.whitelist = whitelistData;
        } else {
            this.whitelist = new ArrayList<>();
        }
    }

    private void saveUnlockPin(String pin) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putString("bloqueo_pin", pin)
            .apply();
    }

    private void saveMasterPin(String pin) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(KEY_MASTER_PIN, pin).apply();
    }

    private void saveUnlockState(boolean isUnlocked) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, isUnlocked).apply();
    }

    private void enviarLog(String packageName) {
        if (deviceDocId == null) return;
        
        Map<String, Object> log = new HashMap<>();
        log.put("deviceId", deviceDocId);
        log.put("InstitutoId", InstitutoId);
        log.put("aulaId", aulaId);
        log.put("seccion", seccion);
        log.put("app", packageName);
        log.put("timestamp", FieldValue.serverTimestamp());
        
        db.collection("dispositivos").document(deviceDocId)
            .collection("logs")
            .add(log)
            .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error enviando log", e));
    }

    private void reportarUrlActual(String url) {
        if (deviceDocId == null || url.equals(ultimaUrlReportada)) return;
        
        ultimaUrlReportada = url;
        
        Map<String, Object> urlData = new HashMap<>();
        urlData.put("ultimaUrl", url);
        urlData.put("ultimaUrlTimestamp", FieldValue.serverTimestamp());
        
        db.collection("dispositivos").document(deviceDocId)
            .update(urlData)
            .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error reportando URL", e));
        
        Map<String, Object> history = new HashMap<>();
        history.put("deviceId", deviceDocId);
        history.put("url", url);
        history.put("timestamp", FieldValue.serverTimestamp());
        history.put("InstitutoId", InstitutoId);
        history.put("aulaId", aulaId);
        history.put("alumno", alumnoAsignado);
        
        db.collection("web_history").add(history)
            .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error guardando historial", e));
    }

    private void reportarIncidencia(String tipo, String descripcion, String url) {
        if (deviceDocId == null) return;
        
        Map<String, Object> incidencia = new HashMap<>();
        incidencia.put("tipo", tipo);
        incidencia.put("descripcion", descripcion);
        incidencia.put("url", url);
        incidencia.put("timestamp", FieldValue.serverTimestamp());
        incidencia.put("resuelta", false);
        
        db.collection("dispositivos").document(deviceDocId)
            .collection("incidencias")
            .add(incidencia)
            .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error reportando incidencia", e));
        
        reportarAlertaGlobal(tipo, descripcion, url);
    }

    private void reportarAlertaGlobal(String tipo, String descripcion, String url) {
        if (deviceDocId == null || InstitutoId == null) return;
        
        Map<String, Object> alerta = new HashMap<>();
        alerta.put("tipo", tipo);
        alerta.put("descripcion", descripcion);
        alerta.put("url", url);
        alerta.put("urlIntentada", url);
        alerta.put("timestamp", FieldValue.serverTimestamp());
        alerta.put("deviceId", deviceDocId);
        alerta.put("InstitutoId", InstitutoId);
        alerta.put("aulaId", aulaId);
        alerta.put("alumno_asignado", alumnoAsignado);
        alerta.put("estudianteNombre", alumnoAsignado);
        alerta.put("status", "nuevo");
        
        db.collection("alertas").add(alerta)
            .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error reportando alerta global", e));
    }

    private void dispararBloqueoConDuracion(int duracionMs) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
        
        if (!isUnlocked) {
            Log.d("EDU_Monitor", "🔒 MOSTRANDO PANTALLA DE BLOQUEO (" + duracionMs/1000 + " segundos)");
            
            Intent lockIntent = new Intent(this, LockActivity.class);
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(lockIntent);
            
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                Intent closeIntent = new Intent("ACTION_CLOSE_LOCK");
                sendBroadcast(closeIntent);
                Log.d("EDU_Monitor", "🔓 PANTALLA DE BLOQUEO CERRADA AUTOMÁTICAMENTE");
            }, duracionMs);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Solo procesamos eventos de cambio de ventana (cuando se abre una nueva app)
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }

        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString();
        
        // Apps del sistema siempre permitidas
        if (listaBlancaSistema.contains(packageName)) {
            return;
        }
        
        // Registrar cada ventana nueva
        enviarLog(packageName);
        
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
        
        // Si está desbloqueado y no en blindaje, no bloquear
        if (isUnlocked && !shieldMode) {
            return;
        }

        // ============================================================
        // MODO CONCENTRACIÓN (por aula): si está activo, solo permitir apps educativas y de la whitelist
        // ============================================================
        if (modoConcentracion) {
            // Permitir si la app está en appsEducativas O en la whitelist
            if (appsEducativas.contains(packageName) || whitelist.contains(packageName)) {
                return; // No bloquear
            } else {
                // No está permitida, bloquear
                reportarIncidencia("MODO_CONCENTRACION", "App no permitida en modo concentración: " + packageName, packageName);
                dispararBloqueoConDuracion(5000);
                return;
            }
        }

        // ============================================================
        // BLOQUEO DE APPS PROHIBIDAS DE NACIMIENTO (solo si no está en modo concentración)
        // ============================================================
        for (String prohibida : appsProhibidas) {
            if (packageName.toLowerCase().contains(prohibida.toLowerCase())) {
                reportarIncidencia("APP_PROHIBIDA", "Intento de abrir app prohibida: " + packageName, packageName);
                dispararBloqueoConDuracion(5000);
                return;
            }
        }

        // Verificar si debe bloquear por ajustes
        if (packageName.equals("com.android.settings") || packageName.equals("com.google.android.settings")) {
            if (!isUnlocked) {
                dispararBloqueoConDuracion(5000);
            }
            return;
        }
        
        // Verificar blindaje
        if (shieldMode && !packageName.contains("educontrolpro")) {
            dispararBloqueoConDuracion(5000);
            return;
        }
        
        // Verificar bloqueo de navegación
        if ((cortarNavegacion || blockAllBrowsing) && esNavegador(packageName)) {
            dispararBloqueoConDuracion(5000);
            return;
        }
        
        // Si es navegador, analizar contenido
        if (esNavegador(packageName)) {
            analizarContenido(event.getSource());
        }
    }

    private boolean esNavegador(String pkg) {
        String p = pkg.toLowerCase();
        return p.contains("chrome") || p.contains("browser") || p.contains("firefox") || 
               p.contains("opera") || p.contains("edge") || p.contains("brave") ||
               (p.contains("samsung") && p.contains("browser"));
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        if (node == null) return;
        
        if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
            CharSequence texto = node.getText();
            if (texto != null) {
                String contenido = texto.toString();
                
                // ============================================================
                // Verificar palabras prohibidas (antes de considerar URL)
                // ============================================================
                String contenidoLower = contenido.toLowerCase();
                for (String palabra : PALABRAS_PROHIBIDAS) {
                    if (contenidoLower.contains(palabra)) {
                        Log.d("EDU_Monitor", "🔒 Palabra prohibida detectada: " + palabra);
                        reportarIncidencia("PALABRA_PROHIBIDA", "Búsqueda con término prohibido: " + palabra, contenido);
                        dispararBloqueoConDuracion(5000);
                        return;
                    }
                }
                
                // Si parece una URL, reportar y verificar lista negra
                if (contenido.startsWith("http") || contenido.contains(".")) {
                    reportarUrlActual(contenido);
                    
                    if (useBlacklist && listaNegra != null && !listaNegra.isEmpty()) {
                        for (String sitio : listaNegra) {
                            if (contenido.toLowerCase().contains(sitio.toLowerCase())) {
                                reportarIncidencia("BLOQUEO_LISTA_NEGRA", "Intento de acceso a sitio bloqueado", contenido);
                                dispararBloqueoConDuracion(5000);
                                return;
                            }
                        }
                    }
                }
            }
        }
        
        for (int i = 0; i < node.getChildCount(); i++) {
            analizarContenido(node.getChild(i));
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        
        if (deviceListener != null) deviceListener.remove();
        if (institutionListener != null) institutionListener.remove();
        if (aulaListener != null) aulaListener.remove();
        if (securityListener != null) securityListener.remove();
        
        if (heartbeatHandler != null && heartbeatRunnable != null) {
            heartbeatHandler.removeCallbacks(heartbeatRunnable);
        }
        
        if (deviceDocId != null) {
            Map<String, Object> offline = new HashMap<>();
            offline.put("online", false);
            offline.put("ultimoAcceso", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId)
                .update(offline)
                .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error reportando offline", e));
        }
    }

    @Override
    public void onInterrupt() { }
}
