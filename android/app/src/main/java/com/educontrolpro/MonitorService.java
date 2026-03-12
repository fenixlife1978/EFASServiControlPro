package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
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
    private boolean whitelistOnly = false;
    private boolean blockAllBrowsing = false;
    private boolean cortarNavegacion = false;
    private String bloqueoPin = "";

    private List<String> listaNegra = new ArrayList<>();
    private List<String> whitelist = new ArrayList<>();
    private boolean modoConcentracion = false;

    private long firstDetectionTime = 0;
    private static final long GRACE_PERIOD = 3000; // Reducido a 3 segundos
    private long lastBlockTime = 0;
    private static final long BLOCK_COOLDOWN = 5000; // 5 segundos

    // NUEVO: Para controlar limpieza después de bloqueo
    private boolean bloqueoActivo = false;
    private String ultimaUrlProcesada = "";
    private long ultimoBloqueoTime = 0;

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
            "com.netflix.mediaclient", "com.spotify.music", "com.amazon.avod.thirdpartyclient", "com.hulu.plus",
            "com.disney.disneyplus", "com.crunchyroll.crunchyroid", "com.mercadopago.wallet", "com.paypal.android.p2pmobile",
            "com.ubercab", "com.didiglobal.passenger", "com.alibaba.aliexpresshd", "com.amazon.mShop.android.shopping"
    );

    private List<String> listaBlancaSistema = Arrays.asList(
            "com.android.packageinstaller", "com.google.android.packageinstaller", "com.educontrolpro",
            "com.android.systemui", "com.google.android.googlequicksearchbox", "com.android.launcher3",
            "com.google.android.inputmethod.latin"
    );

    private static final List<String> PALABRAS_PROHIBIDAS = Arrays.asList(
            "xxx", "porno", "pornos", "videos pornos", "juegos", "proxy", "vpn", "unblock",
            "bypass", "casino", "bet", "poker", "slot", "torrent", "piratebay"
    );

    private ListenerRegistration deviceListener;
    private ListenerRegistration institutionListener;
    private ListenerRegistration aulaListener;
    private ListenerRegistration securityListener;

    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 30000;

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
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Monitoreo Educativo",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro")
                .setContentText("Protección de aula activa")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_LOW)
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
                }
                heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
            }
        };
        heartbeatHandler.post(heartbeatRunnable);
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
            dispararBloqueoConDuracion(0); // 0 = permanente hasta PIN
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
        if (deviceDocId == null || url == null || url.isEmpty()) return;

        String normalizada = url.toLowerCase()
                .replace("https://", "")
                .replace("http://", "")
                .replace("www.", "")
                .replace("/", "")
                .trim();

        if (normalizada.equals(ultimaUrlReportada)) return;

        ultimaUrlReportada = normalizada;

        Map<String, Object> urlData = new HashMap<>();
        urlData.put("ultimaUrl", normalizada);
        urlData.put("ultimaUrlTimestamp", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId).update(urlData);

        Map<String, Object> history = new HashMap<>();
        history.put("deviceId", deviceDocId);
        history.put("url", normalizada);
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

    private synchronized void dispararBloqueoConDuracion(int duracionMs) {
        long now = System.currentTimeMillis();

        if (now - lastBlockTime < BLOCK_COOLDOWN) return;

        boolean isUnlocked = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(KEY_UNLOCKED, false);
        if (!isUnlocked) {
            lastBlockTime = now;
            ultimoBloqueoTime = now;
            bloqueoActivo = true;
            firstDetectionTime = 0; // Resetear detección

            // Limpiar el texto del navegador después del bloqueo
            limpiarTextoNavegador();

            Intent lockIntent = new Intent(this, LockActivity.class);
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            // Pasar la URL bloqueada para mostrarla
            if (!ultimaUrlProcesada.isEmpty()) {
                lockIntent.putExtra("sitio_bloqueado", ultimaUrlProcesada);
            }
            
            startActivity(lockIntent);

            // Si tiene duración (modo temporal), cerrar después
            if (duracionMs > 0) {
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    sendBroadcast(new Intent("ACTION_CLOSE_LOCK"));
                    bloqueoActivo = false;
                }, duracionMs);
            }
            // Si duracionMs = 0, es permanente (esperará PIN)
        }
    }

    // NUEVO: Método para limpiar el texto del navegador
    private void limpiarTextoNavegador() {
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;

            // Buscar campo de URL en Chrome
            List<AccessibilityNodeInfo> urlNodes = root.findAccessibilityNodeInfosByViewId("com.android.chrome:id/url_bar");
            if (urlNodes != null && !urlNodes.isEmpty()) {
                AccessibilityNodeInfo urlBar = urlNodes.get(0);
                Bundle arguments = new Bundle();
                arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                urlBar.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                Log.d(TAG, "🧹 URL bar limpiada en Chrome");
            }

            // Buscar campo de búsqueda/browser en otros navegadores
            List<String> searchViewIds = Arrays.asList(
                "org.mozilla.firefox:id/url_bar",
                "com.android.chrome:id/search_box_text",
                "com.android.browser:id/url",
                "com.brave.browser:id/url_bar"
            );

            for (String viewId : searchViewIds) {
                List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(viewId);
                if (nodes != null && !nodes.isEmpty()) {
                    Bundle args = new Bundle();
                    args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                    nodes.get(0).performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                    Log.d(TAG, "🧹 Campo de texto limpiado en: " + viewId);
                }
            }

            // Buscar EditTexts genéricos que puedan ser campos de búsqueda
            buscarYLimpiarEditTexts(root);
            
        } catch (Exception e) {
            Log.e(TAG, "Error limpiando texto: " + e.getMessage());
        }
    }

    // NUEVO: Buscar recursivamente EditTexts y limpiarlos
    private void buscarYLimpiarEditTexts(AccessibilityNodeInfo node) {
        if (node == null) return;

        if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
            if (node.getText() != null && node.getText().length() > 0) {
                Bundle args = new Bundle();
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                Log.d(TAG, "🧹 EditText limpiado");
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            buscarYLimpiarEditTexts(node.getChild(i));
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        int eventType = event.getEventType();
        String packageName = (event.getPackageName() != null) ? event.getPackageName().toString() : "";

        if (listaBlancaSistema.contains(packageName)) {
            firstDetectionTime = 0;
            return;
        }

        // Si estamos en período de cooldown después de un bloqueo, ignorar detecciones
        long now = System.currentTimeMillis();
        if (now - ultimoBloqueoTime < BLOCK_COOLDOWN) {
            return;
        }

        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            procesarCambioApp(packageName);
        }

        if (esNavegador(packageName)) {
            if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
                    eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
                    eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
                analizarContenido(getRootInActiveWindow());
            }
        }
    }

    private void procesarCambioApp(String packageName) {
        boolean isUnlocked = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(KEY_UNLOCKED, false);
        if (isUnlocked && !shieldMode) return;

        if (modoConcentracion && !appsEducativas.contains(packageName) && !whitelist.contains(packageName)) {
            reportarIncidencia("MODO_CONCENTRACION", "App bloqueada: " + packageName, packageName);
            dispararBloqueoConDuracion(0); // Permanente
            return;
        }

        for (String prohibida : appsProhibidas) {
            if (packageName.equalsIgnoreCase(prohibida) || packageName.toLowerCase().contains(prohibida)) {
                dispararBloqueoConDuracion(0); // Permanente
                return;
            }
        }

        if (packageName.contains("settings") && !isUnlocked) {
            dispararBloqueoConDuracion(0); // Permanente
        }
    }

    private boolean esNavegador(String pkg) {
        String p = pkg.toLowerCase();
        return p.contains("chrome") || p.contains("browser") || p.contains("firefox") ||
                p.contains("opera") || p.contains("edge") || p.contains("brave") ||
                p.contains("webview");
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        if (node == null) return;

        List<AccessibilityNodeInfo> urlNodes = node.findAccessibilityNodeInfosByViewId("com.android.chrome:id/url_bar");
        if (urlNodes != null && !urlNodes.isEmpty()) {
            CharSequence urlText = urlNodes.get(0).getText();
            if (urlText != null) procesarUrlEncontrada(urlText.toString());
        }

        if (node.getText() != null) {
            String texto = node.getText().toString().toLowerCase();

            for (String palabra : PALABRAS_PROHIBIDAS) {
                if (texto.contains(palabra)) {
                    long now = System.currentTimeMillis();
                    if (firstDetectionTime == 0) {
                        firstDetectionTime = now;
                        Log.d(TAG, "⚠️ Palabra prohibida detectada: " + palabra);
                    } else if (now - firstDetectionTime > GRACE_PERIOD) {
                        reportarIncidencia("CONTENIDO_PROHIBIDO", "Palabra detectada: " + palabra, texto);
                        ultimaUrlProcesada = palabra;
                        dispararBloqueoConDuracion(0); // Permanente
                        return;
                    }
                }
            }

            // Si contiene algo que parece URL
            if (texto.contains("http") || texto.contains("www.") || texto.contains(".")) {
                procesarUrlEncontrada(texto);
            }
        }

        // Recorrer hijos
        for (int i = 0; i < node.getChildCount(); i++) {
            analizarContenido(node.getChild(i));
        }
    }

    private void procesarUrlEncontrada(String url) {
        if (url == null) return;

        String limpia = url.toLowerCase().trim()
                .replace("https://", "")
                .replace("http://", "")
                .replace("www.", "")
                .replace(" ", "")
                .replace("\n", "")
                .replace("\t", "");

        if (!limpia.contains(".") || limpia.length() < 4) return;

        // Guardar para referencia
        ultimaUrlProcesada = limpia;

        boolean urlBlocked = false;

        if (whitelistOnly) {
            boolean permitido = false;
            for (String sitio : whitelist) {
                if (limpia.contains(sitio.toLowerCase())) {
                    permitido = true;
                    break;
                }
            }
            if (!permitido) urlBlocked = true;
        }

        if (!urlBlocked && useBlacklist) {
            for (String sitio : listaNegra) {
                if (limpia.contains(sitio.toLowerCase())) {
                    urlBlocked = true;
                    break;
                }
            }
        }

        if (blockAllBrowsing) {
            urlBlocked = true;
        }

        if (urlBlocked) {
            long now = System.currentTimeMillis();

            if (firstDetectionTime == 0) {
                firstDetectionTime = now;
                Log.d(TAG, "⚠️ URL bloqueada detectada, iniciando gracia: " + limpia);
                return;
            }

            if (now - firstDetectionTime > GRACE_PERIOD) {
                Log.d(TAG, "🚫 URL bloqueada tras gracia: " + limpia);
                reportarIncidencia("WEB_BLOCK", "URL restringida", limpia);
                dispararBloqueoConDuracion(0); // Permanente
                firstDetectionTime = 0;
            }

            return;
        }

        // Si llegamos aquí, la URL es permitida
        firstDetectionTime = 0;
        reportarUrlActual(limpia);
    }

    @Override
    public void onInterrupt() {
        // No se requiere implementación
    }

    @Override
    public void onDestroy() {
        super.onDestroy();

        if (deviceListener != null) deviceListener.remove();
        if (institutionListener != null) institutionListener.remove();
        if (aulaListener != null) aulaListener.remove();
        if (securityListener != null) securityListener.remove();

        heartbeatHandler.removeCallbacks(heartbeatRunnable);

        if (deviceDocId != null) {
            db.collection("dispositivos")
                    .document(deviceDocId)
                    .update("online", false);
        }
    }
}