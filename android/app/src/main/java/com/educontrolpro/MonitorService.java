package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    // Modos de navegación
    private boolean cortarNavegacion = false;
    private boolean useWhitelist = false;
    private boolean useBlacklist = false;
    private List<String> whitelist = new ArrayList<>();
    private List<String> blacklist = new ArrayList<>();
    
    // Apps educativas permitidas SIEMPRE
    private List<String> appsEducativas = Arrays.asList(
        "com.microsoft.office.word",
        "com.microsoft.office.excel",
        "com.microsoft.office.powerpoint",
        "com.google.android.apps.docs",
        "com.google.android.apps.classroom",
        "com.google.android.apps.photos",
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.android.vending",
        "com.google.android.gm",
        "com.google.android.calendar",
        "com.google.android.apps.maps",
        "com.google.android.apps.drive",
        "com.google.android.apps.translate",
        "com.google.android.apps.books",
        "com.google.android.apps.kids",
        "org.wikipedia",
        "com.duolingo",
        "com.khanacademy.android"
    );

    // Apps del sistema permitidas SIEMPRE
    private List<String> appsSistema = Arrays.asList(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.educontrolpro",
        "com.android.systemui",
        "com.google.android.googlequicksearchbox",
        "com.android.settings",
        "com.android.dialer",
        "com.android.contacts",
        "com.android.mms",
        "com.android.documentsui",
        "com.android.providers.downloads"
    );

    // ========================================================
    // APPS PROHIBIDAS DE NACIMIENTO (lista ampliada)
    // ========================================================
    private List<String> appsProhibidas = Arrays.asList(
        // Redes sociales
        "tiktok", "instagram", "facebook", "youtube", "twitter", 
        "whatsapp", "telegram", "snapchat", "messenger", "discord",
        "linkedin", "pinterest", "reddit", "tumblr", "wechat",
        "line", "viber", "signal", "skype", "zoom",
        
        // Juegos
        "game", "candy", "subway", "clash", "among", "minecraft", 
        "roblox", "fortnite", "pokemon", "freefire", "pubg",
        "callofduty", "cod", "gta", "fifa", "pes", "nfl",
        "madden", "sims", "simulator", "racing", "asphalt",
        "angrybirds", "plantsvszombies", "templerun", "jetpack",
        
        // Apuestas y casino
        "bet", "casino", "poker", "slot", "ruleta", "blackjack",
        "lotería", "loteria", "apuesta", "betting", "gambling",
        
        // Pornografía y contenido adulto
        "porn", "xxx", "adult", "hentai", "onlyfans", "sex",
        "erotic", "cam", "playboy", "desnudo", "nude",
        
        // Apps deportivas (bloqueadas por defecto)
        "espn", "foxsports", "nbcsports", "daZN", "futbol", 
        "soccer", "basketball", "nba", "nfl", "mlb", "nhl",
        "laliga", "premierleague", "championsleague",
        
        // Apps de espectáculos y entretenimiento
        "netflix", "spotify", "deezer", "amazonprime", "hulu",
        "disneyplus", "hbomax", "paramount", "peacock", "twitch",
        "tinder", "badoo", "grindr", "hinge", "bumble"
    );

    private ListenerRegistration deviceListener;
    private ListenerRegistration institutionListener;
    private ListenerRegistration securityListener;

    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 30000;

    private String ultimaUrlReportada = "";
    
    private BroadcastReceiver closeLockReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("ACTION_CLOSE_LOCK".equals(intent.getAction())) {
                Log.d("EDU_Monitor", "Recibida orden de cerrar LockActivity");
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(1, getNotification());
        cargarIdentidad();
        registerReceiver(closeLockReceiver, new IntentFilter("ACTION_CLOSE_LOCK"));
    }

    private void cargarIdentidad() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId     = capPrefs.getString("deviceId", null);
        InstitutoId     = capPrefs.getString("InstitutoId", null);
        aulaId          = capPrefs.getString("aulaId", null);
        seccion         = capPrefs.getString("seccion", null);
        nombreInstituto = capPrefs.getString("nombreInstituto", null);
        
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
            Log.d("EDU_Monitor", "Servicio iniciado para: " + deviceDocId);
            iniciarListeners(deviceDocId, InstitutoId);
            iniciarHeartbeat();
            reportarEstadoInicial();
        } else {
            Log.e("EDU_Monitor", "ERROR: Faltan datos de identidad");
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
        Boolean cortarNavegacionCmd = snapshot.getBoolean("cortarNavegacion");
        Boolean bloquearCmd = snapshot.getBoolean("bloquear");
        String pinCmd = snapshot.getString("pinBloqueo");
        String nuevoAlumno = snapshot.getString("alumno_asignado");
        
        if (nuevoAlumno != null && !nuevoAlumno.isEmpty()) {
            alumnoAsignado = nuevoAlumno;
        }
        
        this.cortarNavegacion = (cortarNavegacionCmd != null && cortarNavegacionCmd);
        
        if (pinCmd != null && !pinCmd.isEmpty()) {
            this.bloqueoPin = pinCmd;
            saveUnlockPin(pinCmd);
            Log.d("EDU_Monitor", "PIN actualizado: " + pinCmd);
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
        Boolean useWhitelistFlag = snapshot.getBoolean("useWhitelist");
        Boolean useBlacklistFlag = snapshot.getBoolean("useBlacklist");
        List<String> whitelistData = (List<String>) snapshot.get("whitelist");
        List<String> blacklistData = (List<String>) snapshot.get("blacklist");
        
        this.cortarNavegacion = (blockAll != null && blockAll);
        this.useWhitelist = (useWhitelistFlag != null && useWhitelistFlag);
        this.useBlacklist = (useBlacklistFlag != null && useBlacklistFlag);
        
        if (whitelistData != null) {
            this.whitelist = whitelistData;
        }
        
        if (blacklistData != null) {
            this.blacklist = blacklistData;
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
        
        db.collection("activity_logs").add(log)
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
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString();
        
        // 1. Apps del sistema siempre permitidas
        if (appsSistema.contains(packageName)) {
            return;
        }
        
        // 2. Registrar cada ventana nueva
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            enviarLog(packageName);
        }
        
        // 3. Verificar estado de desbloqueo
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
        
        if (isUnlocked) {
            return;
        }
        
        // ========================================================
        // REGLAS DE BLOQUEO DE NACIMIENTO (siempre activas)
        // ========================================================
        
        // 4. Apps educativas siempre permitidas
        if (appsEducativas.contains(packageName)) {
            return;
        }
        
        // 5. Verificar apps prohibidas (lista de nacimiento + dashboard)
        for (String prohibida : appsProhibidas) {
            if (packageName.toLowerCase().contains(prohibida)) {
                Log.d("EDU_Monitor", "⛔ App prohibida detectada: " + packageName);
                reportarIncidencia("APP_PROHIBIDA", "Intento de abrir: " + packageName, packageName);
                dispararBloqueoConDuracion(5000);
                return;
            }
        }
        
        // 6. Control de navegación
        if (esNavegador(packageName)) {
            if (cortarNavegacion) {
                Log.d("EDU_Monitor", "⛔ Navegador bloqueado por cortarNavegacion");
                reportarIncidencia("NAVEGADOR_BLOQUEADO", "Navegador no permitido", packageName);
                dispararBloqueoConDuracion(5000);
                return;
            }
            
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
                String url = texto.toString();
                if (url.startsWith("http") || url.contains(".")) {
                    reportarUrlActual(url);
                    
                    if (useWhitelist && whitelist != null && !whitelist.isEmpty()) {
                        boolean permitido = false;
                        for (String sitio : whitelist) {
                            if (url.toLowerCase().contains(sitio.toLowerCase())) {
                                permitido = true;
                                break;
                            }
                        }
                        if (!permitido) {
                            Log.d("EDU_Monitor", "⛔ Sitio no permitido por whitelist: " + url);
                            reportarIncidencia("SITIO_NO_PERMITIDO", "Acceso a sitio no autorizado", url);
                            dispararBloqueoConDuracion(5000);
                            return;
                        }
                    }
                    
                    if (useBlacklist && blacklist != null && !blacklist.isEmpty()) {
                        for (String sitio : blacklist) {
                            if (url.toLowerCase().contains(sitio.toLowerCase())) {
                                Log.d("EDU_Monitor", "⛔ Sitio bloqueado por blacklist: " + sitio);
                                reportarIncidencia("BLOQUEO_LISTA_NEGRA", "Intento de acceso a sitio bloqueado", url);
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
        if (securityListener != null) securityListener.remove();
        
        if (heartbeatHandler != null && heartbeatRunnable != null) {
            heartbeatHandler.removeCallbacks(heartbeatRunnable);
        }
        
        try {
            unregisterReceiver(closeLockReceiver);
        } catch (Exception e) {}
        
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

