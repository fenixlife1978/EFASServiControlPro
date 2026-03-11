package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.ActivityManager;
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

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private static final String TAG = "EDU_Monitor";
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
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    private boolean shieldMode = false;
    private boolean useBlacklist = false;
    private boolean useWhitelist = false;
    private boolean blockAllBrowsing = false;
    private boolean cortarNavegacion = false;
    private String bloqueoPin = "";

    private List<String> listaNegra = new ArrayList<>();
    private List<String> whitelist = new ArrayList<>();
    private boolean whitelistOnly = false;
    private boolean modoConcentracion = false;

    // Eliminamos GRACE_PERIOD para evitar vulnerabilidades
    private long lastBlockTime = 0;
    private static final long BLOCK_COOLDOWN = 2000; // Cooldown reducido para mayor firmeza

    private List<String> appsEducativas = Arrays.asList(
            "com.microsoft.office.word", "com.microsoft.office.excel", "com.microsoft.office.powerpoint",
            "com.google.android.apps.docs", "com.google.android.apps.classroom", "com.google.android.apps.photos",
            "com.android.chrome", "org.mozilla.firefox", "com.google.android.gm", "com.google.android.calendar",
            "com.google.android.apps.maps", "com.google.android.apps.drive", "com.google.android.apps.translate",
            "org.wikipedia", "com.duolingo", "com.khanacademy.android"
    );

    private List<String> appsProhibidas = Arrays.asList(
            "com.android.vending", "com.google.android.gsf", "com.android.mms", "com.google.android.apps.messaging",
            "tiktok", "instagram", "facebook", "youtube", "twitter", "whatsapp", "telegram", "snapchat", "discord",
            "com.rovio.angrybirds", "com.supercell.clashofclans", "com.king.candycrushsaga", "com.mojang.minecraftpe",
            "com.epicgames.fortnite", "com.tencent.ig", "com.dts.freefireth", "com.playrix.homescapes", "com.playrix.fishdom",
            "com.netflix.mediaclient", "spotify", "com.amazon.avod.thirdpartyclient", "com.hulu.plus",
            "com.disney.disneyplus", "com.crunchyroll.crunchyroid", "com.mercadopago.wallet", "com.paypal.android.p2pmobile",
            "com.ubercab", "com.didiglobal.passenger", "com.alibaba.aliexpresshd", "com.amazon.mShop.android.shopping",
            "com.android.vpndialogs" // CRÍTICO: Bloquea el permiso de otras VPN
    );

    private List<String> listaBlancaSistema = Arrays.asList(
            "com.android.packageinstaller", "com.google.android.packageinstaller", "com.educontrolpro",
            "com.android.systemui", "com.google.android.googlequicksearchbox", "com.android.launcher3",
            "com.google.android.inputmethod.latin"
    );

    private static final List<String> PALABRAS_PROHIBIDAS = Arrays.asList(
            "xxx", "porno", "videos pornos", "juegos", "proxy", "vpn", "unblock",
            "bypass", "casino", "bet", "poker", "slot", "torrent", "piratebay"
    );

    private ListenerRegistration deviceListener;
    private ListenerRegistration institutionListener;
    private ListenerRegistration aulaListener;
    private ListenerRegistration securityListener;

    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 15000; // Intervalo más frecuente para monitoreo real

    private String ultimaUrlReportada = "";

    // Receptor para cuando la VPN es revocada
    private final BroadcastReceiver vpnStatusReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("ACTION_VPN_REVOKED".equals(intent.getAction())) {
                reportarIncidencia("SEGURIDAD_VPN", "VPN Desactivada externamente", "Sistema");
                dispararBloqueoInmediato("VPN_REVOKED");
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(1, getNotification());
        cargarIdentidad();
        
        // Registrar el receptor de estatus de VPN
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(vpnStatusReceiver, new IntentFilter("ACTION_VPN_REVOKED"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(vpnStatusReceiver, new IntentFilter("ACTION_VPN_REVOKED"));
        }
    }

    private void cargarIdentidad() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);
        InstitutoId = capPrefs.getString("InstitutoId", null);
        aulaId = capPrefs.getString("aulaId", null);
        seccion = capPrefs.getString("seccion", null);
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
            NotificationChannel serviceChannel = new NotificationChannel(CHANNEL_ID, "Monitoreo Educativo", NotificationManager.IMPORTANCE_HIGH);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro Protegido")
                .setContentText("Sistema de supervisión activo")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setOngoing(true)
                .build();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        if (deviceDocId != null && InstitutoId != null) {
            iniciarListeners(deviceDocId, InstitutoId);
            iniciarHeartbeat();
            reportarEstadoInicial();
        }
    }

    private void reportarEstadoInicial() {
        if (deviceDocId == null) return;
        Map<String, Object> estadoInicial = new HashMap<>();
        estadoInicial.put("online", true);
        estadoInicial.put("ultimoAcceso", FieldValue.serverTimestamp());
        estadoInicial.put("servicioActivo", true);
        db.collection("dispositivos").document(deviceDocId).update(estadoInicial);
    }

    private void iniciarHeartbeat() {
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (deviceDocId != null) {
                    db.collection("dispositivos").document(deviceDocId)
                            .update("online", true, "ultimoAcceso", FieldValue.serverTimestamp());
                    
                    // Verificación de salud de la VPN
                    if (cortarNavegacion) {
                        verificarYReactivarVPN();
                    }
                }
                heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
            }
        };
        heartbeatHandler.post(heartbeatRunnable);
    }

    private void verificarYReactivarVPN() {
        // Lógica para asegurar que el servicio VPN no esté detenido
        Intent vpnIntent = new Intent(this, EduVpnService.class);
        vpnIntent.setAction(EduVpnService.ACTION_START_VPN);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(vpnIntent);
        } else {
            startService(vpnIntent);
        }
    }

    private void iniciarListeners(String docId, String instId) {
        deviceListener = db.collection("dispositivos").document(docId)
                .addSnapshotListener((snapshot, e) -> {
                    if (snapshot != null && snapshot.exists()) procesarCambiosDispositivo(snapshot);
                });

        institutionListener = db.collection("institutions").document(instId)
                .addSnapshotListener((snapshot, e) -> {
                    if (snapshot != null && snapshot.exists()) procesarCambiosInstitucion(snapshot);
                });

        if (aulaId != null) {
            aulaListener = db.collection("institutions").document(instId)
                    .collection("Aulas").document(aulaId)
                    .addSnapshotListener((snapshot, e) -> {
                        if (snapshot != null && snapshot.exists()) {
                            Boolean concentracion = snapshot.getBoolean("modoConcentracion");
                            modoConcentracion = (concentracion != null && concentracion);
                        }
                    });
        }

        securityListener = db.collection("system_config").document("security")
                .addSnapshotListener((snapshot, e) -> {
                    if (snapshot != null && snapshot.exists()) {
                        String pin = snapshot.getString("master_pin");
                        if (pin != null) saveMasterPin(pin);
                    }
                });
    }

    private void procesarCambiosDispositivo(DocumentSnapshot snapshot) {
        Boolean adminEnabled = snapshot.getBoolean("admin_mode_enable");
        Boolean shield = snapshot.getBoolean("shieldMode");
        Boolean cortarNav = snapshot.getBoolean("cortarNavegacion");
        Boolean bloquearCmd = snapshot.getBoolean("bloquear");

        this.shieldMode = (shield != null && shield);
        this.cortarNavegacion = (cortarNav != null && cortarNav);

        String pinCmd = snapshot.getString("pinBloqueo");
        if (pinCmd != null && !pinCmd.isEmpty()) {
            this.bloqueoPin = pinCmd;
            saveUnlockPin(pinCmd);
        }

        saveUnlockState(adminEnabled != null && adminEnabled);

        if (bloquearCmd != null && bloquearCmd) {
            dispararBloqueoInmediato("COMANDO_REMOTO");
            db.collection("dispositivos").document(deviceDocId).update("bloquear", false);
        }

        String msg = snapshot.getString("pending_message");
        if (msg != null && !msg.isEmpty() && !Boolean.TRUE.equals(snapshot.getBoolean("message_viewed"))) {
            Intent intent = new Intent(this, MessageActivity.class);
            intent.putExtra("mensaje", msg);
            intent.putExtra("remitente", snapshot.getString("message_sender"));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        }
    }

    private void procesarCambiosInstitucion(DocumentSnapshot snapshot) {
        this.blockAllBrowsing = Boolean.TRUE.equals(snapshot.getBoolean("blockAllBrowsing"));
        this.useBlacklist = Boolean.TRUE.equals(snapshot.getBoolean("useBlacklist"));
        this.useWhitelist = Boolean.TRUE.equals(snapshot.getBoolean("useWhitelist"));
        this.whitelistOnly = Boolean.TRUE.equals(snapshot.getBoolean("whitelistOnly"));

        List<String> bl = (List<String>) snapshot.get("blacklist");
        this.listaNegra = (bl != null) ? bl : new ArrayList<>();

        List<String> wl = (List<String>) snapshot.get("whitelist");
        this.whitelist = (wl != null) ? wl : new ArrayList<>();
    }

    private void saveUnlockPin(String pin) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString("bloqueo_pin", pin).apply();
    }

    private void saveMasterPin(String pin) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(KEY_MASTER_PIN, pin).apply();
    }

    private void saveUnlockState(boolean isUnlocked) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, isUnlocked).apply();
    }

    private void reportarUrlActual(String url) {
        if (deviceDocId == null || url == null || url.isEmpty() || url.equals(ultimaUrlReportada)) return;
        if (url.contains("about:blank") || url.length() < 4) return;

        ultimaUrlReportada = url;
        Map<String, Object> urlData = new HashMap<>();
        urlData.put("ultimaUrl", url);
        urlData.put("ultimaUrlTimestamp", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId).update(urlData);

        Map<String, Object> history = new HashMap<>();
        history.put("deviceId", deviceDocId);
        history.put("url", url);
        history.put("timestamp", FieldValue.serverTimestamp());
        history.put("InstitutoId", InstitutoId);
        history.put("aulaId", aulaId);
        history.put("alumno", alumnoAsignado);
        db.collection("web_history").add(history);
    }

    private void reportarIncidencia(String tipo, String desc, String url) {
        if (deviceDocId == null) return;
        Map<String, Object> inc = new HashMap<>();
        inc.put("tipo", tipo);
        inc.put("descripcion", desc);
        inc.put("url", url);
        inc.put("timestamp", FieldValue.serverTimestamp());
        inc.put("resuelta", false);
        db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(inc);

        Map<String, Object> alerta = new HashMap<>(inc);
        alerta.put("deviceId", deviceDocId);
        alerta.put("InstitutoId", InstitutoId);
        alerta.put("alumno_asignado", alumnoAsignado);
        alerta.put("status", "nuevo");
        db.collection("alertas").add(alerta);
    }

    // CORREGIDO: Bloqueo persistente sin auto-desbloqueo
    private synchronized void dispararBloqueoInmediato(String razon) {
        long now = System.currentTimeMillis();
        if (now - lastBlockTime < BLOCK_COOLDOWN) return;

        if (!getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(KEY_UNLOCKED, false)) {
            lastBlockTime = now;
            Log.d(TAG, "🔒 BLOQUEO ACTIVADO POR: " + razon);

            Intent lockIntent = new Intent(this, LockActivity.class);
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(lockIntent);
            
            // Hemos eliminado el Handler que enviaba ACTION_CLOSE_LOCK. 
            // La pantalla solo se quitará cuando el usuario vuelva a un área permitida 
            // o se use el PIN de desbloqueo.
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        int eventType = event.getEventType();
        String packageName = (event.getPackageName() != null) ? event.getPackageName().toString() : "";

        if (listaBlancaSistema.contains(packageName)) {
            return;
        }

        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            procesarCambioApp(packageName);
        }

        if (esNavegador(packageName)) {
            if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
                    eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
                analizarContenido(getRootInActiveWindow());
            }
        }
    }

    private void procesarCambioApp(String packageName) {
        boolean isUnlocked = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(KEY_UNLOCKED, false);
        
        // Si la app está desbloqueada por el administrador, no bloqueamos a menos que shieldMode esté activo
        if (isUnlocked && !shieldMode) return;

        // 1. Modo Concentración: Solo apps educativas
        if (modoConcentracion && !appsEducativas.contains(packageName) && !whitelist.contains(packageName)) {
            dispararBloqueoInmediato("MODO_CONCENTRACION");
            return;
        }

        // 2. Apps Prohibidas explícitamente
        for (String prohibida : appsProhibidas) {
            if (packageName.toLowerCase().contains(prohibida)) {
                dispararBloqueoInmediato("APP_PROHIBIDA: " + prohibida);
                return;
            }
        }

        // 3. Blindaje de Ajustes
        if (packageName.contains("settings") && !isUnlocked) {
            dispararBloqueoInmediato("AJUSTES_PROTEGIDOS");
        }
    }

    private boolean esNavegador(String pkg) {
        String p = pkg.toLowerCase();
        return p.contains("chrome") || p.contains("browser") || p.contains("firefox") ||
                p.contains("opera") || p.contains("edge") || p.contains("brave");
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        if (node == null) return;

        try {
            // Detección de URL en Chrome
            List<AccessibilityNodeInfo> urlNodes = node.findAccessibilityNodeInfosByViewId("com.android.chrome:id/url_bar");
            if (urlNodes != null && !urlNodes.isEmpty()) {
                AccessibilityNodeInfo urlNode = urlNodes.get(0);
                if (urlNode != null) {
                    CharSequence urlText = urlNode.getText();
                    if (urlText != null) {
                        procesarUrlEncontrada(urlText.toString());
                    }
                    urlNode.recycle();
                }
            }

            // Análisis de texto en pantalla
            if (node.getText() != null) {
                String texto = node.getText().toString().toLowerCase();

                for (String palabra : PALABRAS_PROHIBIDAS) {
                    if (texto.contains(palabra)) {
                        // Si se detecta contenido prohibido, bloqueo inmediato (eliminada la gracia)
                        if (node.isEditable() || node.getClassName().toString().contains("EditText") || esNodoUrl(node)) {
                            Log.d(TAG, "🚫 CONTENIDO PROHIBIDO: " + palabra);
                            reportarIncidencia("CONTENIDO_PROHIBIDO", "Detección: " + palabra, texto);
                            dispararBloqueoInmediato("CONTENIDO_RESTRINGIDO");
                            return;
                        }
                    }
                }
            }

            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    analizarContenido(child);
                    child.recycle();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error analizando contenido: " + e.getMessage());
        }
    }

    private boolean esNodoUrl(AccessibilityNodeInfo node) {
        if (node.getViewIdResourceName() != null) {
            String id = node.getViewIdResourceName();
            return id.contains("url") || id.contains("location") || id.contains("address");
        }
        return false;
    }

    private void procesarUrlEncontrada(String url) {
        if (!url.contains(".") || url.contains(" ") || url.length() < 4) return;

        boolean urlBlocked = false;

        if (whitelistOnly) {
            boolean permitido = false;
            for (String sitio : whitelist) {
                if (url.toLowerCase().contains(sitio.toLowerCase())) {
                    permitido = true;
                    break;
                }
            }
            if (!permitido) urlBlocked = true;
        }

        if (!urlBlocked && useBlacklist) {
            for (String sitio : listaNegra) {
                if (url.toLowerCase().contains(sitio.toLowerCase())) {
                    urlBlocked = true;
                    break;
                }
            }
        }

        if (urlBlocked) {
            Log.d(TAG, "⚠️ URL RESTRINGIDA: " + url);
            reportarIncidencia("WEB_BLOCK", "Intento de acceso a URL", url);
            dispararBloqueoInmediato("URL_PROHIBIDA");
        } else {
            reportarUrlActual(url);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(vpnStatusReceiver);
        } catch (Exception ignored) {}
        
        if (deviceListener != null) deviceListener.remove();
        if (institutionListener != null) institutionListener.remove();
        if (aulaListener != null) aulaListener.remove();
        if (securityListener != null) securityListener.remove();
        heartbeatHandler.removeCallbacks(heartbeatRunnable);
        if (deviceDocId != null) db.collection("dispositivos").document(deviceDocId).update("online", false);
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Servicio interrumpido");
    }
}