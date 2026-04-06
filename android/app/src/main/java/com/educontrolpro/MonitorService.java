package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import androidx.core.app.NotificationCompat;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class MonitorService extends AccessibilityService {
    private static final String TAG = "MonitorService";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final long HEARTBEAT_INTERVAL = 15000;
    private static final String CHANNEL_ID = "educontrol_foreground";
    private static final long SERVICE_CHECK_INTERVAL = 10000;
    
    private DatabaseReference rtdb;
    private String deviceId;
    private String institutoId;
    private boolean isServiceActive = false;
    private boolean allowAccess = false;
    private boolean modoBlindadoActivo = false;
    private long lastBlockTime = 0;
    private Handler heartbeatHandler;
    private Handler watchdogHandler;
    private PowerManager.WakeLock wakeLock;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isBlocking = false;
    private int homePressCount = 0;
    
    private String currentUrl = "Esperando navegación...";
    private long lastUrlUpdate = 0;
    private String lastBlockedPackage = "";
    
    // Control de spam para reportes (SOLO para Firebase)
    private Map<String, Long> lastReportTime = new HashMap<>();
    private static final long MIN_REPORT_INTERVAL = 10000;
    
    // Listas en memoria
    private Set<String> globalBlacklist = new HashSet<>();
    private Set<String> globalWhitelist = new HashSet<>();
    
    private final Set<String> settingsPackages = new HashSet<>(Arrays.asList(
        "com.android.settings",
        "com.android.systemui",
        "com.android.systemui.settings",
        "com.android.providers.settings",
        "com.android.settings.intelligence"
    ));
    
    private final Set<String> forbiddenPackages = new HashSet<>(Arrays.asList(
        "com.instagram.android",
        "com.facebook.katana",
        "com.facebook.orca",
        "com.twitter.android",
        "com.tumblr",
        "com.pinterest",
        "com.snapchat.android",
        "com.reddit.frontpage",
        "com.telegram.messenger",
        "com.whatsapp",
        "com.whatsapp.w4b",
        "org.telegram.messenger",
        "com.discord",
        "com.roblox.client",
        "com.dts.freefireth",
        "com.mobile.legends",
        "com.supercell.clashroyale",
        "com.supercell.clashofclans",
        "com.king.candycrushsaga",
        "com.king.candycrushsodasaga",
        "com.playrix.gardenscapes",
        "com.playrix.fishdom",
        "com.miniclip.eightballpool",
        "com.ea.games.simsmobile",
        "com.activision.callofduty.shooter",
        "com.tencent.ig",
        "com.pubg.imobile",
        "com.google.android.youtube",
        "com.netflix.mediaclient",
        "com.amazon.avod.thirdpartyclient",
        "com.hulu.plus",
        "com.disney.disneyplus",
        "com.tiktok.android",
        "com.zhiliaoapp.musically",
        "com.android.vending",
        "com.sec.android.app.samsungapps",
        "com.huawei.appmarket",
        "com.xiaomi.market",
        "com.oppo.market",
        "com.vivo.appstore",
        "com.amazon.venezia"
    ));
    
    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", 
        "org.mozilla.firefox", 
        "com.opera.browser", 
        "com.android.browser", 
        "com.brave.browser", 
        "com.microsoft.emmx",
        "com.sec.android.app.sbrowser"
    );
    
    private final List<String> configClasses = Arrays.asList(
        "Settings", 
        "Preference", 
        "SettingsActivity", 
        "BrowserPreferences",
        "ChromeSettings"
    );

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!isServiceActive) return;
        
        // Si isBlocking está true por más de 2 segundos, liberar forzadamente
        if (isBlocking) {
            long blockingDuration = System.currentTimeMillis() - lastBlockTime;
            if (blockingDuration > 2000) {
                Log.w(TAG, "⚠️ isBlocking trabada por " + blockingDuration + "ms, liberando");
                isBlocking = false;
                homePressCount = 0;
            } else {
                return;
            }
        }
        
        String pkg = event.getPackageName() != null ? event.getPackageName().toString() : "";
        int eventType = event.getEventType();
        
        if (pkg.equals(getPackageName())) return;
        
        // Capturar URL
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            capturarUrlActual(event, pkg);
        }
        
        // Modo técnico: NO bloquear nada
        if (allowAccess) {
            return;
        }
        
        // Blindaje total
        if (modoBlindadoActivo) {
            expulsarAlHome("blindaje_total");
            return;
        }
        
        // BLOQUEO DE CONFIGURACIONES DEL SISTEMA
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (settingsPackages.contains(pkg)) {
                if (!lastBlockedPackage.equals(pkg)) {
                    lastBlockedPackage = pkg;
                    expulsarAlHome("ajustes_sistema");
                    mainHandler.postDelayed(() -> lastBlockedPackage = "", 2000);
                }
                return;
            }
        }
        
        // BLOQUEO DE CONFIGURACIONES DEL NAVEGADOR
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (browserPackages.contains(pkg) && event.getClassName() != null) {
                String className = event.getClassName().toString();
                for (String configClass : configClasses) {
                    if (className.contains(configClass)) {
                        if (!lastBlockedPackage.equals(pkg + "_config")) {
                            lastBlockedPackage = pkg + "_config";
                            expulsarAlHome("configuracion_navegador");
                            mainHandler.postDelayed(() -> lastBlockedPackage = "", 2000);
                        }
                        return;
                    }
                }
            }
        }
        
        // BLOQUEO DE APPS PROHIBIDAS
        if (forbiddenPackages.contains(pkg) && eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (!lastBlockedPackage.equals(pkg)) {
                lastBlockedPackage = pkg;
                expulsarAlHome("app_prohibida");
                mainHandler.postDelayed(() -> lastBlockedPackage = "", 2000);
            }
            return;
        }
    }
    
    /**
     * EXPULSA INMEDIATAMENTE AL HOME - SIN spam control
     * Ahora expulsa CADA VEZ que se detecta una app prohibida
     */
    private void expulsarAlHome(String tipo) {
        Log.w(TAG, "🚫 EXPULSANDO AL HOME: " + tipo);
        
        // Activar bandera de bloqueo
        isBlocking = true;
        homePressCount = 0;
        
        // Múltiples intentos de HOME con delays
        realizarHomeRepetido(0);
        
        // Reportar evento a Firebase (solo este tiene control de spam)
        reportarEvento(tipo, "sistema");
    }
    
    /**
     * Realiza múltiples intentos de HOME hasta asegurar la expulsión
     * 3 intentos con delay de 500ms
     */
    private void realizarHomeRepetido(int intento) {
        if (intento >= 3) {
            Log.w(TAG, "⚠️ Se realizaron 3 intentos de HOME, liberando bandera");
            isBlocking = false;
            homePressCount = 0;
            return;
        }
        
        boolean success = performGlobalAction(GLOBAL_ACTION_HOME);
        Log.d(TAG, "🏠 HOME intento " + (intento + 1) + ": " + (success ? "OK" : "FALLÓ"));
        
        homePressCount++;
        
        mainHandler.postDelayed(() -> {
            if (isBlocking) {
                realizarHomeRepetido(intento + 1);
            }
        }, 500);
    }
    
    private void capturarUrlActual(AccessibilityEvent event, String packageName) {
        if (!browserPackages.contains(packageName)) return;
        
        try {
            AccessibilityNodeInfo source = event.getSource();
            if (source != null) {
                String url = extraerUrlDesdeNodo(source);
                if (url != null && !url.isEmpty() && !url.equals(currentUrl)) {
                    currentUrl = url;
                    lastUrlUpdate = System.currentTimeMillis();
                    Log.d(TAG, "🌐 URL detectada: " + currentUrl);
                    guardarHistorial(currentUrl);
                    actualizarUrlEnTiempoReal(currentUrl);
                }
                source.recycle();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error capturando URL: " + e.getMessage());
        }
    }
    
    private String extraerUrlDesdeNodo(AccessibilityNodeInfo node) {
        if (node == null) return null;
        
        if (node.getText() != null) {
            String text = node.getText().toString();
            if (text.startsWith("http://") || text.startsWith("https://")) {
                return text;
            }
            if (text.contains(".com/") || text.contains(".org/") || text.contains(".net/")) {
                if (text.length() > 10 && !text.contains("Google") && !text.contains("Búsqueda")) {
                    return text;
                }
            }
        }
        
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                String url = extraerUrlDesdeNodo(child);
                if (url != null) {
                    child.recycle();
                    return url;
                }
                child.recycle();
            }
        }
        return null;
    }
    
    private void guardarHistorial(String url) {
        if (rtdb == null || deviceId == null || url == null || url.isEmpty()) return;
        if (url.equals("Esperando navegación...")) return;
        
        Map<String, Object> historyEntry = new HashMap<>();
        historyEntry.put("url", url);
        historyEntry.put("timestamp", System.currentTimeMillis());
        historyEntry.put("deviceId", deviceId);
        if (institutoId != null) historyEntry.put("InstitutoId", institutoId);
        
        rtdb.child("historial_navegacion").child(deviceId).push().setValue(historyEntry);
        
        if (institutoId != null) {
            rtdb.child("historial_navegacion_instituciones").child(institutoId).child(deviceId).push().setValue(historyEntry);
        }
        
        Log.d(TAG, "📝 Historial guardado: " + url);
    }
    
    private void actualizarUrlEnTiempoReal(String url) {
        if (rtdb == null || deviceId == null) return;
        
        Map<String, Object> updates = new HashMap<>();
        updates.put("url_actual", url);
        updates.put("ultima_url_actualizacion", System.currentTimeMillis());
        rtdb.child("status_dispositivos").child(deviceId).updateChildren(updates);
    }
    
    private void mostrarBloqueo(String tipo, String mensaje) {
        long now = System.currentTimeMillis();
        
        Intent intent = new Intent(this, BlockActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("tipo_bloqueo", tipo);
        intent.putExtra("deviceId", deviceId);
        intent.putExtra("mensaje", mensaje);
        startActivity(intent);
        reportarEvento(tipo, "sistema");
    }
    
    private void mostrarMensajeDirector(String texto, String remitente, String idMsg, String titulo) {
        long now = System.currentTimeMillis();
        
        Intent intent = new Intent(this, MessageActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("mensaje", texto);
        intent.putExtra("remitente", remitente != null ? remitente : "Dirección");
        intent.putExtra("messageId", idMsg);
        intent.putExtra("deviceId", deviceId);
        if (titulo != null) intent.putExtra("titulo", titulo);
        startActivity(intent);
        reportarEvento("mensaje_director", "sistema");
        
        if (rtdb != null && deviceId != null && idMsg != null) {
            rtdb.child("mensajes_dispositivos").child(deviceId).child("ultimo_mensaje").child("leido").setValue(true);
        }
    }
    
    private void reportarEvento(String tipo, String paquete) {
        if (rtdb == null || deviceId == null) return;
        
        String key = tipo + "_" + deviceId;
        Long lastReport = lastReportTime.get(key);
        long now = System.currentTimeMillis();
        
        // Control de spam SOLO para reportes de Firebase
        if (lastReport != null && (now - lastReport) < MIN_REPORT_INTERVAL) {
            return;
        }
        
        lastReportTime.put(key, now);
        
        Map<String, Object> e = new HashMap<>();
        e.put("tipo", tipo);
        e.put("timestamp", now);
        e.put("deviceId", deviceId);
        e.put("paquete", paquete);
        if (institutoId != null) e.put("InstitutoId", institutoId);
        rtdb.child("alertas_seguridad").push().setValue(e);
        
        Log.d(TAG, "📊 Reporte: " + tipo);
    }
    
    private void startForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "EduControlPro", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
        
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EduControlPro Activo")
                .setContentText("Protección funcionando")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
        
        startForeground(1001, notif);
    }
    
    private void startHeartbeat() {
        heartbeatHandler = new Handler(Looper.getMainLooper());
        heartbeatHandler.post(new Runnable() {
            @Override
            public void run() {
                if (isServiceActive && deviceId != null && rtdb != null) {
                    Map<String, Object> data = new HashMap<>();
                    data.put("lastSeen", System.currentTimeMillis());
                    data.put("online", true);
                    data.put("service_alive", true);
                    data.put("heartbeat", System.currentTimeMillis());
                    data.put("url_actual", currentUrl);
                    if (institutoId != null) data.put("InstitutoId", institutoId);
                    rtdb.child("status_dispositivos").child(deviceId).updateChildren(data);
                }
                if (heartbeatHandler != null) {
                    heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
                }
            }
        });
    }
    
    private void startWatchdog() {
        watchdogHandler = new Handler(Looper.getMainLooper());
        watchdogHandler.post(new Runnable() {
            @Override
            public void run() {
                if (!isServiceActive) {
                    Log.w(TAG, "⚠️ Watchdog: Servicio inactivo, reiniciando...");
                    isServiceActive = true;
                }
                
                // Limpiar bandera isBlocking si quedó trabada (más de 3 segundos)
                if (isBlocking) {
                    long blockDuration = System.currentTimeMillis() - lastBlockTime;
                    if (blockDuration > 3000) {
                        Log.w(TAG, "⚠️ Watchdog liberó isBlocking trabada por " + blockDuration + "ms");
                        isBlocking = false;
                        homePressCount = 0;
                    }
                }
                
                if (rtdb == null && isServiceActive) {
                    Log.w(TAG, "⚠️ Watchdog: RTDB nulo, reconectando...");
                    try {
                        rtdb = FirebaseDatabase.getInstance().getReference();
                    } catch (Exception e) {
                        Log.e(TAG, "Error reconectando RTDB: " + e.getMessage());
                    }
                }
                
                if (watchdogHandler != null) {
                    watchdogHandler.postDelayed(this, SERVICE_CHECK_INTERVAL);
                }
            }
        });
    }
    
    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EduControlPro:WakeLock");
            wakeLock.acquire(10 * 60 * 1000L);
        }
    }
    
    private void cargarConfiguracion() {
        if (rtdb == null || deviceId == null) return;
        
        rtdb.child("dispositivos").child(deviceId).child("InstitutoId")
            .addListenerForSingleValueEvent(new ValueEventListener() {
                @Override public void onDataChange(DataSnapshot s) {
                    institutoId = s.getValue(String.class);
                    if (institutoId != null) {
                        Log.d(TAG, "InstitutoId: " + institutoId);
                        cargarListasEnMemoria();
                        precargarListas();
                    }
                }
                @Override public void onCancelled(DatabaseError e) {}
            });
    }
    
    private void cargarListasEnMemoria() {
        if (rtdb == null || institutoId == null) return;
        
        DatabaseReference sedeRef = rtdb.child("config").child("instituciones").child(institutoId);
        
        sedeRef.child("blacklist").addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                globalBlacklist.clear();
                for (DataSnapshot child : snapshot.getChildren()) {
                    String value = child.getValue(String.class);
                    if (value != null && !value.isEmpty()) {
                        globalBlacklist.add(value.toLowerCase());
                    }
                }
                Log.d(TAG, "Blacklist cargada: " + globalBlacklist.size() + " dominios");
            }
            @Override
            public void onCancelled(DatabaseError error) {}
        });
        
        sedeRef.child("whitelist").addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                globalWhitelist.clear();
                for (DataSnapshot child : snapshot.getChildren()) {
                    String value = child.getValue(String.class);
                    if (value != null && !value.isEmpty()) {
                        globalWhitelist.add(value.toLowerCase());
                    }
                }
                Log.d(TAG, "Whitelist cargada: " + globalWhitelist.size() + " dominios");
            }
            @Override
            public void onCancelled(DatabaseError error) {}
        });
    }
    
    private void precargarListas() {
        if (rtdb == null || institutoId == null) return;
        
        DatabaseReference sedeRef = rtdb.child("config").child("instituciones").child(institutoId);
        
        sedeRef.child("blacklist").addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                globalBlacklist.clear();
                for (DataSnapshot child : snapshot.getChildren()) {
                    String value = child.getValue(String.class);
                    if (value != null && !value.isEmpty()) {
                        globalBlacklist.add(value.toLowerCase());
                    }
                }
            }
            @Override
            public void onCancelled(DatabaseError error) {}
        });
        
        sedeRef.child("whitelist").addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                globalWhitelist.clear();
                for (DataSnapshot child : snapshot.getChildren()) {
                    String value = child.getValue(String.class);
                    if (value != null && !value.isEmpty()) {
                        globalWhitelist.add(value.toLowerCase());
                    }
                }
            }
            @Override
            public void onCancelled(DatabaseError error) {}
        });
    }
    
    private void syncModes() {
        if (deviceId == null) return;
        
        rtdb.child("status_dispositivos").child(deviceId).child("admin_mode_enable")
            .addValueEventListener(new ValueEventListener() {
                @Override public void onDataChange(DataSnapshot s) {
                    allowAccess = s.exists() && Boolean.TRUE.equals(s.getValue(Boolean.class));
                    Log.d(TAG, "Modo técnico: " + (allowAccess ? "ACTIVADO" : "DESACTIVADO"));
                }
                @Override public void onCancelled(DatabaseError e) {}
            });
        
        rtdb.child("status_dispositivos").child(deviceId).child("shield_mode_enable")
            .addValueEventListener(new ValueEventListener() {
                @Override public void onDataChange(DataSnapshot s) {
                    modoBlindadoActivo = s.exists() && Boolean.TRUE.equals(s.getValue(Boolean.class));
                    Log.d(TAG, "Blindaje: " + (modoBlindadoActivo ? "ACTIVADO" : "DESACTIVADO"));
                }
                @Override public void onCancelled(DatabaseError e) {}
            });
        
        rtdb.child("mensajes_dispositivos").child(deviceId).child("ultimo_mensaje")
            .addValueEventListener(new ValueEventListener() {
                @Override
                public void onDataChange(DataSnapshot snapshot) {
                    if (snapshot.exists()) {
                        String texto = snapshot.child("texto").getValue(String.class);
                        Boolean leido = snapshot.child("leido").getValue(Boolean.class);
                        String idMsg = snapshot.child("id").getValue(String.class);
                        String remitente = snapshot.child("remitente").getValue(String.class);
                        String titulo = snapshot.child("titulo").getValue(String.class);
                        
                        if (texto != null && !texto.isEmpty() && (leido == null || !leido)) {
                            mostrarMensajeDirector(texto, remitente, idMsg, titulo);
                        }
                    }
                }
                @Override
                public void onCancelled(DatabaseError error) {}
            });
    }
    
    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        isServiceActive = true;
        
        try {
            rtdb = FirebaseDatabase.getInstance().getReference();
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            deviceId = prefs.getString("deviceId", null);
            
            if (deviceId != null && !deviceId.isEmpty() && !deviceId.equals("student_unknown")) {
                cargarConfiguracion();
                syncModes();
                startHeartbeat();
                startWatchdog();
                startForegroundService();
                acquireWakeLock();
                Log.d(TAG, "✅ MonitorService conectado: " + deviceId);
            }
            
            AccessibilityServiceInfo info = new AccessibilityServiceInfo();
            info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | 
                              AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
            info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
            info.flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS |
                         AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
            info.notificationTimeout = 50;
            setServiceInfo(info);
            
        } catch (Exception e) {
            Log.e(TAG, "Error init: " + e.getMessage());
        }
    }
    
    @Override
    public void onInterrupt() { 
        isServiceActive = false;
        if (heartbeatHandler != null) heartbeatHandler.removeCallbacksAndMessages(null);
        if (watchdogHandler != null) watchdogHandler.removeCallbacksAndMessages(null);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        isServiceActive = false;
        if (heartbeatHandler != null) heartbeatHandler.removeCallbacksAndMessages(null);
        if (watchdogHandler != null) watchdogHandler.removeCallbacksAndMessages(null);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        try {
            Intent restartIntent = new Intent(this, MonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent);
            } else {
                startService(restartIntent);
            }
            Log.d(TAG, "🔄 Servicio reiniciado");
        } catch (Exception e) {
            Log.e(TAG, "Error reiniciando: " + e.getMessage());
        }
    }
    
    public String getCurrentUrl() { return currentUrl; }
    public long getLastUrlUpdate() { return lastUrlUpdate; }
    public Set<String> getGlobalBlacklist() { return globalBlacklist; }
    public Set<String> getGlobalWhitelist() { return globalWhitelist; }
}