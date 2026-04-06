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
    private static final long SERVICE_CHECK_INTERVAL = 30000;
    
    private DatabaseReference rtdb;
    private String deviceId;
    private String institutoId;
    private boolean isServiceActive = false;
    private boolean allowAccess = false;
    private boolean modoBlindadoActivo = false;
    private long lastBlockTime = 0;
    private static final long MIN_BLOCK_INTERVAL = 200; // 200ms para respuesta ultra rápida
    private Handler heartbeatHandler;
    private Handler watchdogHandler;
    private PowerManager.WakeLock wakeLock;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isBlocking = false;
    
    // Variables para URL actual
    private String currentUrl = "Esperando navegación...";
    private long lastUrlUpdate = 0;
    
    // Lista de paquetes de ajustes del sistema
    private final Set<String> settingsPackages = new HashSet<>(Arrays.asList(
        "com.android.settings",
        "com.android.systemui",
        "com.android.systemui.settings",
        "com.google.android.gms",
        "com.google.android.gsf",
        "com.android.phone",
        "com.android.contacts",
        "com.android.providers.settings",
        "com.android.settings.intelligence",
        "com.google.android.setupwizard",
        "com.android.wifi",
        "com.android.bluetooth"
    ));
    
    // Apps prohibidas - Lista completa
    private final Set<String> forbiddenPackages = new HashSet<>(Arrays.asList(
        // Redes Sociales
        "com.instagram.android",
        "com.facebook.katana",
        "com.facebook.orca",
        "com.twitter.android",
        "com.tumblr",
        "com.pinterest",
        "com.snapchat.android",
        "com.reddit.frontpage",
        "com.telegram.messenger",
        // Mensajería
        "com.whatsapp",
        "com.whatsapp.w4b",
        "org.telegram.messenger",
        "com.discord",
        // Juegos
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
        // Streaming / Videos
        "com.google.android.youtube",
        "com.netflix.mediaclient",
        "com.amazon.avod.thirdpartyclient",
        "com.hulu.plus",
        "com.disney.disneyplus",
        "com.tiktok.android",
        "com.zhiliaoapp.musically",
        // Tiendas de Apps
        "com.android.vending",
        "com.sec.android.app.samsungapps",
        "com.huawei.appmarket",
        "com.xiaomi.market",
        "com.oppo.market",
        "com.vivo.appstore",
        "com.amazon.venezia",
        "com.google.android.apps.podcasts",
        "com.google.android.play.games"
    ));
    
    // Navegadores
    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", 
        "org.mozilla.firefox", 
        "com.opera.browser", 
        "com.android.browser", 
        "com.brave.browser", 
        "com.microsoft.emmx",
        "com.sec.android.app.sbrowser"
    );
    
    // Clases de configuración del navegador
    private final List<String> configClasses = Arrays.asList(
        "Settings", 
        "Preference", 
        "SettingsActivity", 
        "BrowserPreferences",
        "ChromeSettings",
        "PreferenceFragment",
        "SettingsFragment"
    );

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!isServiceActive || isBlocking) return;
        
        String pkg = event.getPackageName() != null ? event.getPackageName().toString() : "";
        int eventType = event.getEventType();
        
        if (pkg.equals(getPackageName())) return;
        
        // Capturar URL actual
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            capturarUrlActual(event, pkg);
        }
        
        // BLINDAJE TOTAL
        if (modoBlindadoActivo && !allowAccess) {
            mostrarBloqueo("blindaje_total", "⚠️ BLOQUEO TOTAL ACTIVADO ⚠️\nEl dispositivo ha sido bloqueado por seguridad.\nContacta a tu profesor para desbloquear.");
            return;
        }
        
        // MODO TÉCNICO
        if (allowAccess) {
            Log.d(TAG, "🔓 Modo Técnico ACTIVADO - Ignorando bloqueos");
            return;
        }
        
        // 🔥 BLOQUEO DE AJUSTES DEL SISTEMA - RESPUESTA INMEDIATA
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            
            boolean isSettings = settingsPackages.contains(pkg) || 
                                 pkg.contains("settings") || 
                                 pkg.contains("Settings") ||
                                 pkg.contains("config") ||
                                 pkg.equals("com.android.systemui");
            
            boolean isAccessibilitySettings = false;
            if (event.getClassName() != null) {
                String className = event.getClassName().toString();
                isAccessibilitySettings = className.contains("Accessibility") ||
                                          className.contains("accessibility") ||
                                          className.contains("Settings");
            }
            
            if (isSettings || isAccessibilitySettings) {
                Log.w(TAG, "🔒 BLOQUEO INMEDIATO: " + pkg);
                expulsarInmediato("ajustes_sistema");
                return;
            }
        }
        
        // 🔥 BLOQUEO DE APPS PROHIBIDAS - RESPUESTA INMEDIATA
        if (forbiddenPackages.contains(pkg) && 
            (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
             eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED)) {
            Log.w(TAG, "🔒 APP PROHIBIDA DETECTADA: " + pkg);
            expulsarInmediato("app_prohibida");
            return;
        }
        
        // Configuración del navegador
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (browserPackages.contains(pkg) && event.getClassName() != null) {
                String className = event.getClassName().toString();
                for (String configClass : configClasses) {
                    if (className.contains(configClass)) {
                        expulsarInmediato("configuracion_navegador");
                        return;
                    }
                }
            }
        }
    }
    
    /**
     * Expulsión inmediata y agresiva
     */
    private void expulsarInmediato(String tipo) {
        long now = System.currentTimeMillis();
        if (now - lastBlockTime < MIN_BLOCK_INTERVAL) return;
        lastBlockTime = now;
        
        Log.w(TAG, "🚫 EXPULSIÓN INMEDIATA: " + tipo);
        
        // 1. Enviar al home
        performGlobalAction(GLOBAL_ACTION_HOME);
        
        // 2. Enviar BACK varias veces para asegurar
        performGlobalAction(GLOBAL_ACTION_BACK);
        
        // 3. Pequeña pausa y otro HOME por si acaso
        mainHandler.postDelayed(() -> {
            performGlobalAction(GLOBAL_ACTION_HOME);
        }, 50);
        
        // 4. Reportar evento
        reportarEvento(tipo);
        
        // 5. Bloquear temporalmente para no saturar
        isBlocking = true;
        mainHandler.postDelayed(() -> isBlocking = false, 300);
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
        
        rtdb.child("historial").child(deviceId).push().setValue(historyEntry);
        
        if (institutoId != null) {
            rtdb.child("historial_instituciones").child(institutoId).child(deviceId).push().setValue(historyEntry);
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
        if (now - lastBlockTime < MIN_BLOCK_INTERVAL) return;
        lastBlockTime = now;
        
        Intent intent = new Intent(this, BlockActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("tipo_bloqueo", tipo);
        intent.putExtra("deviceId", deviceId);
        intent.putExtra("mensaje", mensaje);
        startActivity(intent);
        reportarEvento(tipo);
    }
    
    private void mostrarMensajeDirector(String texto, String remitente, String idMsg) {
        long now = System.currentTimeMillis();
        if (now - lastBlockTime < MIN_BLOCK_INTERVAL) return;
        lastBlockTime = now;
        
        Intent intent = new Intent(this, MessageActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("mensaje", texto);
        intent.putExtra("remitente", remitente != null ? remitente : "Dirección");
        intent.putExtra("messageId", idMsg);
        intent.putExtra("deviceId", deviceId);
        startActivity(intent);
        reportarEvento("mensaje_director");
        
        if (rtdb != null && deviceId != null && idMsg != null) {
            rtdb.child("dispositivos").child(deviceId).child("mensaje_actual").child("leido").setValue(true);
        }
    }
    
    private void reportarEvento(String tipo) {
        if (rtdb == null || deviceId == null) return;
        Map<String, Object> e = new HashMap<>();
        e.put("tipo", tipo);
        e.put("timestamp", System.currentTimeMillis());
        e.put("deviceId", deviceId);
        if (institutoId != null) e.put("InstitutoId", institutoId);
        if (currentUrl != null && !currentUrl.equals("Esperando navegación...")) {
            e.put("url_actual", currentUrl);
        }
        rtdb.child("alertas_seguridad").push().setValue(e);
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
                .setContentText("Protección funcionando - No cerrar esta app")
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
                    Log.w(TAG, "⚠️ Watchdog: Servicio detectado como inactivo, reiniciando...");
                    isServiceActive = true;
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
                        Log.d(TAG, "InstitutoId cargado: " + institutoId);
                        precargarListas();
                    }
                }
                @Override public void onCancelled(DatabaseError e) {}
            });
    }
    
    private void precargarListas() {
        if (rtdb == null || institutoId == null) return;
        
        DatabaseReference sedeRef = rtdb.child("config").child("instituciones").child(institutoId);
        
        sedeRef.child("blacklist").addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot s) {
                Log.d(TAG, "📦 Lista negra precargada: " + s.getChildrenCount() + " dominios");
            }
            @Override
            public void onCancelled(DatabaseError e) {}
        });
        
        sedeRef.child("whitelist").addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot s) {
                Log.d(TAG, "📦 Lista blanca precargada: " + s.getChildrenCount() + " dominios");
            }
            @Override
            public void onCancelled(DatabaseError e) {}
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
                    Log.d(TAG, "Blindaje total: " + (modoBlindadoActivo ? "ACTIVADO" : "DESACTIVADO"));
                    if (modoBlindadoActivo && !allowAccess) {
                        mostrarBloqueo("blindaje_total", "⚠️ BLOQUEO TOTAL ACTIVADO ⚠️\nEl dispositivo ha sido bloqueado por seguridad.\nContacta a tu profesor para desbloquear.");
                    }
                }
                @Override public void onCancelled(DatabaseError e) {}
            });
        
        rtdb.child("dispositivos").child(deviceId).child("mensaje_actual")
            .addValueEventListener(new ValueEventListener() {
                @Override
                public void onDataChange(DataSnapshot snapshot) {
                    if (snapshot.exists()) {
                        String texto = snapshot.child("mensaje").getValue(String.class);
                        Boolean leido = snapshot.child("leido").getValue(Boolean.class);
                        String idMsg = snapshot.child("messageId").getValue(String.class);
                        String remitente = snapshot.child("remitente").getValue(String.class);
                        
                        if (texto != null && !texto.isEmpty() && (leido == null || !leido)) {
                            Log.d(TAG, "📨 Mensaje del director detectado: " + texto);
                            mostrarMensajeDirector(texto, remitente, idMsg);
                        }
                    }
                }
                @Override
                public void onCancelled(DatabaseError error) {
                    Log.e(TAG, "Error escuchando mensajes: " + error.getMessage());
                }
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
            info.notificationTimeout = 50; // Tiempo de respuesta ultra rápido
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
            Log.d(TAG, "🔄 Servicio reiniciado desde onDestroy");
        } catch (Exception e) {
            Log.e(TAG, "Error reiniciando servicio: " + e.getMessage());
        }
    }
    
    

    public String getCurrentUrl() { return currentUrl; }
    public long getLastUrlUpdate() { return lastUrlUpdate; }
}