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
import com.google.firebase.FirebaseApp;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.Query;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db;
    
    private String deviceDocId;
    private String InstitutoId;
    private String aulaId;
    private String seccion;
    private String nombreInstituto;
    private String alumnoAsignado = "";
    private String bloqueoPin = "";
    
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage"; 
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin"; 
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    private boolean cortarNavegacion = false;
    private boolean useWhitelist = false;
    private boolean useBlacklist = false;
    private List<String> whitelist = new ArrayList<>();
    private List<String> blacklist = new ArrayList<>();
    
    // Apps educativas permitidas SIEMPRE (sin Play Store)
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

    // APPS PROHIBIDAS DE NACIMIENTO (incluye Play Store)
    private List<String> appsProhibidas = Arrays.asList(
        // Play Store y tiendas de apps
        "com.android.vending",
        
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
        
        // Apps deportivas
        "espn", "foxsports", "nbcsports", "daZN", "futbol", 
        "soccer", "basketball", "nba", "nfl", "mlb", "nhl",
        "laliga", "premierleague", "championsleague",
        
        // Apps de espectáculos y entretenimiento
        "netflix", "spotify", "deezer", "amazonprime", "hulu",
        "disneyplus", "hbomax", "paramount", "peacock", "twitch",
        
        // Apps de citas
        "tinder", "badoo", "grindr", "hinge", "bumble"
    );

    private ListenerRegistration deviceListener;
    private ListenerRegistration institutionListener;
    private ListenerRegistration securityListener;

    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 30000;

    private String ultimaUrlReportada = "";
    private List<String> historialUrls = new ArrayList<>();
    private static final int MAX_HISTORIAL = 20;
    
    private BroadcastReceiver closeLockReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("ACTION_CLOSE_LOCK".equals(intent.getAction())) {
                Log.d("EDU_Monitor", "Recibida orden de cerrar LockActivity");
            }
        }
    };

    // Método para guardar logs (ultra seguro)
    private void guardarLog(String coleccion, Map<String, Object> datos) {
        try {
            if (db == null) {
                Log.e("EDU_Monitor", "Firestore no inicializado");
                return;
            }
            db.collection(coleccion).add(datos)
                .addOnFailureListener(e -> Log.e("EDU_Monitor", "Fallo guardando en " + coleccion, e));
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Excepción guardando log", e);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d("EDU_Monitor", "✅ onCreate: Servicio creado");
        
        try {
            FirebaseApp.initializeApp(this);
            db = FirebaseFirestore.getInstance();
            
            Map<String, Object> bootLog = new HashMap<>();
            bootLog.put("evento", "onCreate");
            bootLog.put("timestamp", FieldValue.serverTimestamp());
            guardarLog("service_boot", bootLog);
            
            createNotificationChannel();
            startForeground(1, getNotification());
            cargarIdentidad();
            registerReceiver(closeLockReceiver, new IntentFilter("ACTION_CLOSE_LOCK"));
            
        } catch (Exception e) {
            Log.e("EDU_Monitor", "❌ Error en onCreate", e);
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "onCreate");
            error.put("error", e.toString());
            error.put("timestamp", FieldValue.serverTimestamp());
            guardarLog("error_logs", error);
        }
    }

    private void cargarIdentidad() {
        try {
            SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            deviceDocId     = capPrefs.getString("deviceId", null);
            InstitutoId     = capPrefs.getString("InstitutoId", null);
            aulaId          = capPrefs.getString("aulaId", null);
            seccion         = capPrefs.getString("seccion", null);
            nombreInstituto = capPrefs.getString("nombreInstituto", null);
            
            Log.d("EDU_Monitor", "📱 deviceDocId: " + deviceDocId);
            
            if (deviceDocId != null) {
                db.collection("dispositivos").document(deviceDocId).get()
                    .addOnSuccessListener(doc -> {
                        try {
                            if (doc.exists()) {
                                alumnoAsignado = doc.getString("alumno_asignado");
                                if (alumnoAsignado == null) alumnoAsignado = "";
                            }
                        } catch (Exception e) {
                            Map<String, Object> error = new HashMap<>();
                            error.put("lugar", "cargarIdentidad/callback");
                            error.put("error", e.toString());
                            error.put("deviceId", deviceDocId);
                            guardarLog("error_logs", error);
                        }
                    })
                    .addOnFailureListener(e -> {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "cargarIdentidad/get");
                        error.put("error", e.toString());
                        error.put("deviceId", deviceDocId);
                        guardarLog("error_logs", error);
                    });
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "cargarIdentidad");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
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
        Log.d("EDU_Monitor", "✅ onServiceConnected: Servicio conectado");
        
        try {
            Map<String, Object> bootLog = new HashMap<>();
            bootLog.put("evento", "onServiceConnected");
            bootLog.put("deviceDocId", deviceDocId);
            bootLog.put("timestamp", FieldValue.serverTimestamp());
            guardarLog("service_boot", bootLog);
            
            if (deviceDocId != null && InstitutoId != null) {
                Log.d("EDU_Monitor", "Iniciando listeners para: " + deviceDocId);
                iniciarListeners(deviceDocId, InstitutoId);
                iniciarHeartbeat();
                reportarEstadoInicial();
            } else {
                Log.e("EDU_Monitor", "Faltan datos de identidad");
                Map<String, Object> error = new HashMap<>();
                error.put("lugar", "onServiceConnected/sinIdentidad");
                error.put("deviceDocId", deviceDocId);
                error.put("InstitutoId", InstitutoId);
                guardarLog("error_logs", error);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "onServiceConnected");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void reportarEstadoInicial() {
        if (deviceDocId == null) return;
        try {
            Map<String, Object> estadoInicial = new HashMap<>();
            estadoInicial.put("online", true);
            estadoInicial.put("ultimoAcceso", FieldValue.serverTimestamp());
            estadoInicial.put("ultimaUrl", "");
            estadoInicial.put("servicioActivo", true);
            db.collection("dispositivos").document(deviceDocId)
                .update(estadoInicial)
                .addOnFailureListener(e -> {
                    Map<String, Object> error = new HashMap<>();
                    error.put("lugar", "reportarEstadoInicial");
                    error.put("error", e.toString());
                    guardarLog("error_logs", error);
                });
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "reportarEstadoInicial");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void iniciarHeartbeat() {
        try {
            heartbeatRunnable = new Runnable() {
                @Override
                public void run() {
                    try {
                        if (deviceDocId != null) {
                            Map<String, Object> heartbeat = new HashMap<>();
                            heartbeat.put("online", true);
                            heartbeat.put("ultimoAcceso", FieldValue.serverTimestamp());
                            db.collection("dispositivos").document(deviceDocId)
                                .update(heartbeat)
                                .addOnFailureListener(e -> {
                                    Map<String, Object> error = new HashMap<>();
                                    error.put("lugar", "heartbeat");
                                    error.put("error", e.toString());
                                    guardarLog("error_logs", error);
                                });
                        }
                    } catch (Exception e) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "heartbeat/run");
                        error.put("error", e.toString());
                        guardarLog("error_logs", error);
                    } finally {
                        heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
                    }
                }
            };
            heartbeatHandler.post(heartbeatRunnable);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "iniciarHeartbeat");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void iniciarListeners(String docId, String instId) {
        try {
            deviceListener = db.collection("dispositivos").document(docId)
                .addSnapshotListener((snapshot, e) -> {
                    if (e != null) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "deviceListener");
                        error.put("error", e.toString());
                        guardarLog("error_logs", error);
                        return;
                    }
                    try {
                        if (snapshot != null && snapshot.exists()) {
                            procesarCambiosDispositivo(snapshot);
                        }
                    } catch (Exception ex) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "deviceListener/procesar");
                        error.put("error", ex.toString());
                        guardarLog("error_logs", error);
                    }
                });

            institutionListener = db.collection("institutions").document(instId)
                .addSnapshotListener((snapshot, e) -> {
                    if (e != null) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "institutionListener");
                        error.put("error", e.toString());
                        guardarLog("error_logs", error);
                        return;
                    }
                    try {
                        if (snapshot != null && snapshot.exists()) {
                            procesarCambiosInstitucion(snapshot);
                        }
                    } catch (Exception ex) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "institutionListener/procesar");
                        error.put("error", ex.toString());
                        guardarLog("error_logs", error);
                    }
                });

            securityListener = db.collection("system_config").document("security")
                .addSnapshotListener((snapshot, e) -> {
                    if (e != null) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "securityListener");
                        error.put("error", e.toString());
                        guardarLog("error_logs", error);
                        return;
                    }
                    try {
                        if (snapshot != null && snapshot.exists()) {
                            String pin = snapshot.getString("master_pin");
                            if (pin != null && !pin.isEmpty()) {
                                saveMasterPin(pin);
                            }
                        }
                    } catch (Exception ex) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "securityListener/procesar");
                        error.put("error", ex.toString());
                        guardarLog("error_logs", error);
                    }
                });
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "iniciarListeners");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void procesarCambiosDispositivo(DocumentSnapshot snapshot) {
        try {
            Boolean adminEnabled = snapshot.getBoolean("admin_mode_enable");
            Boolean cortarNavegacionCmd = snapshot.getBoolean("cortarNavegacion");
            Boolean bloquearCmd = snapshot.getBoolean("bloquear");
            String pinCmd = snapshot.getString("pinBloqueo");
            String nuevoAlumno = snapshot.getString("alumno_asignado");
            String mensajePendiente = snapshot.getString("pending_message");
            
            if (nuevoAlumno != null && !nuevoAlumno.isEmpty()) {
                alumnoAsignado = nuevoAlumno;
            }
            
            this.cortarNavegacion = (cortarNavegacionCmd != null && cortarNavegacionCmd);
            
            if (pinCmd != null && !pinCmd.isEmpty()) {
                this.bloqueoPin = pinCmd;
                saveUnlockPin(pinCmd);
                Log.d("EDU_Monitor", "PIN actualizado: " + pinCmd);
            }
            
            // 📨 Mensajería directa
            if (mensajePendiente != null && !mensajePendiente.isEmpty()) {
                Log.d("EDU_Monitor", "📨 Mensaje pendiente: " + mensajePendiente);
                mostrarAlertaMensaje(mensajePendiente);
                
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        if (deviceDocId != null) {
                            db.collection("dispositivos").document(deviceDocId)
                                .update("pending_message", FieldValue.delete());
                        }
                    } catch (Exception ex) {
                        Log.e("EDU_Monitor", "Error eliminando mensaje pendiente", ex);
                    }
                }, 5000);
            }
            
            saveUnlockState(adminEnabled != null && adminEnabled);
            
            if (bloquearCmd != null && bloquearCmd) {
                Log.d("EDU_Monitor", "Comando BLOQUEAR recibido");
                dispararBloqueoConDuracion(5000); // 5 segundos
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        if (deviceDocId != null) {
                            db.collection("dispositivos").document(deviceDocId)
                                .update("bloquear", false);
                        }
                    } catch (Exception ex) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "procesarCambiosDispositivo/reset");
                        error.put("error", ex.toString());
                        guardarLog("error_logs", error);
                    }
                }, 2000);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "procesarCambiosDispositivo");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void procesarCambiosInstitucion(DocumentSnapshot snapshot) {
        try {
            Boolean blockAll = snapshot.getBoolean("blockAllBrowsing");
            Boolean useWhitelistFlag = snapshot.getBoolean("useWhitelist");
            Boolean useBlacklistFlag = snapshot.getBoolean("useBlacklist");
            List<String> whitelistData = (List<String>) snapshot.get("whitelist");
            List<String> blacklistData = (List<String>) snapshot.get("blacklist");
            
            this.cortarNavegacion = (blockAll != null && blockAll);
            this.useWhitelist = (useWhitelistFlag != null && useWhitelistFlag);
            this.useBlacklist = (useBlacklistFlag != null && useBlacklistFlag);
            
            if (whitelistData != null) this.whitelist = whitelistData;
            if (blacklistData != null) this.blacklist = blacklistData;
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "procesarCambiosInstitucion");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void saveUnlockPin(String pin) {
        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString("bloqueo_pin", pin).apply();
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "saveUnlockPin");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void saveMasterPin(String pin) {
        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(KEY_MASTER_PIN, pin).apply();
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "saveMasterPin");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void saveUnlockState(boolean isUnlocked) {
        try {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, isUnlocked).apply();
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "saveUnlockState");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void mostrarAlertaMensaje(String mensaje) {
        Log.d("EDU_Monitor", "📢 ALERTA: " + mensaje);
    }

    private void enviarLog(String packageName) {
        if (deviceDocId == null) return;
        try {
            Map<String, Object> log = new HashMap<>();
            log.put("deviceId", deviceDocId);
            log.put("InstitutoId", InstitutoId);
            log.put("aulaId", aulaId);
            log.put("seccion", seccion);
            log.put("app", packageName);
            log.put("timestamp", FieldValue.serverTimestamp());
            db.collection("activity_logs").add(log)
                .addOnFailureListener(e -> {
                    Map<String, Object> error = new HashMap<>();
                    error.put("lugar", "enviarLog");
                    error.put("error", e.toString());
                    guardarLog("error_logs", error);
                });
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "enviarLog");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void reportarUrlActual(String url) {
        if (deviceDocId == null || url.equals(ultimaUrlReportada)) return;
        ultimaUrlReportada = url;
        try {
            // Actualizar URL en tiempo real en el documento del dispositivo
            Map<String, Object> urlData = new HashMap<>();
            urlData.put("ultimaUrl", url);
            urlData.put("ultimaUrlTimestamp", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId)
                .update(urlData)
                .addOnFailureListener(e -> {
                    Map<String, Object> error = new HashMap<>();
                    error.put("lugar", "reportarUrlActual/update");
                    error.put("error", e.toString());
                    guardarLog("error_logs", error);
                });
            
            // Guardar en historial global
            Map<String, Object> history = new HashMap<>();
            history.put("deviceId", deviceDocId);
            history.put("url", url);
            history.put("timestamp", FieldValue.serverTimestamp());
            history.put("InstitutoId", InstitutoId);
            history.put("aulaId", aulaId);
            history.put("alumno", alumnoAsignado);
            db.collection("web_history").add(history)
                .addOnSuccessListener(ref -> mantenerUltimas20Urls())
                .addOnFailureListener(e -> {
                    Map<String, Object> error = new HashMap<>();
                    error.put("lugar", "reportarUrlActual/history");
                    error.put("error", e.toString());
                    guardarLog("error_logs", error);
                });
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "reportarUrlActual");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void mantenerUltimas20Urls() {
        db.collection("dispositivos").document(deviceDocId)
            .collection("historial_web")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .get()
            .addOnSuccessListener(querySnapshot -> {
                int count = querySnapshot.size();
                if (count > MAX_HISTORIAL) {
                    for (int i = MAX_HISTORIAL; i < count; i++) {
                        querySnapshot.getDocuments().get(i).getReference().delete();
                    }
                }
            });
    }

    private void reportarIncidencia(String tipo, String descripcion, String url) {
        if (deviceDocId == null) return;
        try {
            Map<String, Object> incidencia = new HashMap<>();
            incidencia.put("tipo", tipo);
            incidencia.put("descripcion", descripcion);
            incidencia.put("url", url);
            incidencia.put("timestamp", FieldValue.serverTimestamp());
            incidencia.put("resuelta", false);
            db.collection("dispositivos").document(deviceDocId)
                .collection("incidencias")
                .add(incidencia)
                .addOnFailureListener(e -> {
                    Map<String, Object> error = new HashMap<>();
                    error.put("lugar", "reportarIncidencia");
                    error.put("error", e.toString());
                    guardarLog("error_logs", error);
                });
            
            reportarAlertaGlobal(tipo, descripcion, url);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "reportarIncidencia");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void reportarAlertaGlobal(String tipo, String descripcion, String url) {
        if (deviceDocId == null || InstitutoId == null) return;
        try {
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
                .addOnFailureListener(e -> {
                    Map<String, Object> error = new HashMap<>();
                    error.put("lugar", "reportarAlertaGlobal");
                    error.put("error", e.toString());
                    guardarLog("error_logs", error);
                });
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "reportarAlertaGlobal");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private void dispararBloqueoConDuracion(int duracionMs) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
            if (!isUnlocked) {
                Log.d("EDU_Monitor", "🔒 MOSTRANDO PANTALLA DE BLOQUEO (" + duracionMs/1000 + " segundos)");
                Intent lockIntent = new Intent(this, LockActivity.class);
                lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(lockIntent);
                
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        Intent closeIntent = new Intent("ACTION_CLOSE_LOCK");
                        sendBroadcast(closeIntent);
                        Log.d("EDU_Monitor", "🔓 PANTALLA DE BLOQUEO CERRADA AUTOMÁTICAMENTE");
                    } catch (Exception ex) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "dispararBloqueoConDuracion/cierre");
                        error.put("error", ex.toString());
                        guardarLog("error_logs", error);
                    }
                }, duracionMs);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "dispararBloqueoConDuracion");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        try {
            if (event.getPackageName() == null) return;
            String packageName = event.getPackageName().toString();
            
            if (appsSistema.contains(packageName)) return;
            
            if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                enviarLog(packageName);
            }
            
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
            if (isUnlocked) return;
            
            if (appsEducativas.contains(packageName)) return;
            
            for (String prohibida : appsProhibidas) {
                if (packageName.toLowerCase().contains(prohibida)) {
                    Log.d("EDU_Monitor", "⛔ App prohibida detectada: " + packageName);
                    reportarIncidencia("APP_PROHIBIDA", "Intento de abrir: " + packageName, packageName);
                    dispararBloqueoConDuracion(5000);
                    return;
                }
            }
            
            if (esNavegador(packageName)) {
                if (cortarNavegacion) {
                    Log.d("EDU_Monitor", "⛔ Navegador bloqueado por cortarNavegacion");
                    reportarIncidencia("NAVEGADOR_BLOQUEADO", "Navegador no permitido", packageName);
                    dispararBloqueoConDuracion(5000);
                    return;
                }
                analizarContenido(event.getSource());
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "onAccessibilityEvent");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    private boolean esNavegador(String pkg) {
        try {
            String p = pkg.toLowerCase();
            return p.contains("chrome") || p.contains("browser") || p.contains("firefox") || 
                   p.contains("opera") || p.contains("edge") || p.contains("brave") ||
                   (p.contains("samsung") && p.contains("browser"));
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "esNavegador");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
            return false;
        }
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        if (node == null) return;
        try {
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
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "analizarContenido");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            if (deviceListener != null) deviceListener.remove();
            if (institutionListener != null) institutionListener.remove();
            if (securityListener != null) securityListener.remove();
            
            if (heartbeatHandler != null && heartbeatRunnable != null) {
                heartbeatHandler.removeCallbacks(heartbeatRunnable);
            }
            
            try {
                unregisterReceiver(closeLockReceiver);
            } catch (Exception e) {
                Map<String, Object> error = new HashMap<>();
                error.put("lugar", "onDestroy/unregister");
                error.put("error", e.toString());
                guardarLog("error_logs", error);
            }
            
            if (deviceDocId != null) {
                Map<String, Object> offline = new HashMap<>();
                offline.put("online", false);
                offline.put("ultimoAcceso", FieldValue.serverTimestamp());
                db.collection("dispositivos").document(deviceDocId)
                    .update(offline)
                    .addOnFailureListener(e -> {
                        Map<String, Object> error = new HashMap<>();
                        error.put("lugar", "onDestroy/offline");
                        error.put("error", e.toString());
                        guardarLog("error_logs", error);
                    });
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("lugar", "onDestroy");
            error.put("error", e.toString());
            guardarLog("error_logs", error);
        }
    }

    @Override
    public void onInterrupt() {
        Log.d("EDU_Monitor", "Servicio interrumpido");
    }
}