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
    private static final long MIN_BLOCK_INTERVAL = 200;
    private Handler heartbeatHandler;
    private Handler watchdogHandler;
    private PowerManager.WakeLock wakeLock;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isBlocking = false;
    
    private String currentUrl = "Esperando navegación...";
    private long lastUrlUpdate = 0;
    
    private Map<String, Long> lastReportTime = new HashMap<>();
    private static final long MIN_REPORT_INTERVAL = 3000; 
    
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
    
    private final Set<String> forbiddenPackages = new HashSet<>(Arrays.asList(
        "com.instagram.android", "com.facebook.katana", "com.facebook.orca", "com.twitter.android",
        "com.tumblr", "com.pinterest", "com.snapchat.android", "com.reddit.frontpage",
        "com.telegram.messenger", "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger",
        "com.discord", "com.roblox.client", "com.dts.freefireth", "com.mobile.legends",
        "com.supercell.clashroyale", "com.supercell.clashofclans", "com.king.candycrushsaga",
        "com.king.candycrushsodasaga", "com.playrix.gardenscapes", "com.playrix.fishdom",
        "com.miniclip.eightballpool", "com.ea.games.simsmobile", "com.activision.callofduty.shooter",
        "com.tencent.ig", "com.pubg.imobile", "com.google.android.youtube", "com.netflix.mediaclient",
        "com.amazon.avod.thirdpartyclient", "com.hulu.plus", "com.disney.disneyplus",
        "com.tiktok.android", "com.zhiliaoapp.musically", "com.android.vending",
        "com.sec.android.app.samsungapps", "com.huawei.appmarket", "com.xiaomi.market",
        "com.oppo.market", "com.vivo.appstore", "com.amazon.venezia", "com.google.android.apps.podcasts",
        "com.google.android.play.games"
    ));
    
    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", "org.mozilla.firefox", "com.opera.browser", 
        "com.android.browser", "com.brave.browser", "com.microsoft.emmx",
        "com.sec.android.app.sbrowser"
    );

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!isServiceActive || isBlocking) return;
        
        String pkg = event.getPackageName() != null ? event.getPackageName().toString() : "";
        int eventType = event.getEventType();
        
        if (pkg.equals(getPackageName())) return;
        
        // 1. Capturar URL (Solo en cambios de ventana)
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            capturarUrlActual(event, pkg);
        }
        
        // 2. Blindaje Total y Modo Técnico
        if (modoBlindadoActivo && !allowAccess) {
            mostrarBloqueo("blindaje_total", "⚠️ BLOQUEO TOTAL ACTIVADO ⚠️");
            return;
        }
        if (allowAccess) return;

        // ============================================================
        // 🔒 LÓGICA DE EXPULSIÓN POR CLICK (EVENTOS ESPECÍFICOS)
        // ============================================================
        
        if (eventType == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            
            // A. Bloqueo de Menú de Navegador (Tres puntos)
            if (browserPackages.contains(pkg)) {
                AccessibilityNodeInfo source = event.getSource();
                if (source != null) {
                    String contentDesc = source.getContentDescription() != null ? source.getContentDescription().toString().toLowerCase() : "";
                    String viewId = source.getViewIdResourceName() != null ? source.getViewIdResourceName() : "";
                    
                    // Detecta el click en "Más opciones", "Menú" o el ID común de Chrome para los 3 puntos
                    if (contentDesc.contains("más opciones") || contentDesc.contains("more options") || 
                        contentDesc.contains("menú") || viewId.contains("menu_button")) {
                        Log.w(TAG, "🔒 CLICK EN MENÚ DETECTADO - EXPULSANDO");
                        expulsarInmediato("menu_navegador_prohibido");
                        source.recycle();
                        return;
                    }
                    source.recycle();
                }
            }

            // B. Bloqueo de Ajustes y Apps Prohibidas (Solo al hacer click para abrirlas)
            boolean isForbidden = forbiddenPackages.contains(pkg);
            boolean isSettings = settingsPackages.contains(pkg) || pkg.contains("settings") || pkg.contains("config");

            if (isForbidden || isSettings) {
                Log.w(TAG, "🔒 CLICK EN APP/AJUSTE PROHIBIDO: " + pkg);
                expulsarInmediato(isSettings ? "ajustes_sistema" : "app_prohibida");
                return;
            }
        }

        // C. Bloqueo inmediato si la ventana ya cambió a Ajustes (Refuerzo)
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (settingsPackages.contains(pkg) || pkg.contains("settings") || pkg.contains("config")) {
                expulsarInmediato("ajustes_sistema_ventana");
            }
        }
    }
    
    private void expulsarInmediato(String tipo) {
        long now = System.currentTimeMillis();
        if (now - lastBlockTime < MIN_BLOCK_INTERVAL) return;
        lastBlockTime = now;
        
        Log.w(TAG, "🚫 EXPULSIÓN: " + tipo);
        reportarEvento(tipo);
        
        performGlobalAction(GLOBAL_ACTION_HOME);
        performGlobalAction(GLOBAL_ACTION_BACK);
        
        isBlocking = true;
        mainHandler.postDelayed(() -> isBlocking = false, 300);
    }
    
    // --- LOS DEMÁS MÉTODOS QUEDAN EXACTAMENTE IGUAL ---
    
    private void capturarUrlActual(AccessibilityEvent event, String packageName) {
        if (!browserPackages.contains(packageName)) return;
        try {
            AccessibilityNodeInfo source = event.getSource();
            if (source != null) {
                String url = extraerUrlDesdeNodo(source);
                if (url != null && !url.isEmpty() && !url.equals(currentUrl)) {
                    currentUrl = url;
                    lastUrlUpdate = System.currentTimeMillis();
                    guardarHistorial(currentUrl);
                    actualizarUrlEnTiempoReal(currentUrl);
                }
                source.recycle();
            }
        } catch (Exception e) { Log.e(TAG, "Error URL: " + e.getMessage()); }
    }
    
    private String extraerUrlDesdeNodo(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.getText() != null) {
            String text = node.getText().toString();
            if (text.startsWith("http://") || text.startsWith("https://")) return text;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                String url = extraerUrlDesdeNodo(child);
                if (url != null) { child.recycle(); return url; }
                child.recycle();
            }
        }
        return null;
    }
    
    private void guardarHistorial(String url) {
        if (rtdb == null || deviceId == null || url == null || url.isEmpty() || url.equals("Esperando navegación...")) return;
        Map<String, Object> entry = new HashMap<>();
        entry.put("url", url);
        entry.put("timestamp", System.currentTimeMillis());
        entry.put("deviceId", deviceId);
        if (institutoId != null) entry.put("InstitutoId", institutoId);
        rtdb.child("historial").child(deviceId).push().setValue(entry);
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
        intent.putExtra("mensaje", mensaje);
        startActivity(intent);
        reportarEvento(tipo);
    }

    private void mostrarMensajeDirector(String texto, String remitente, String idMsg, String titulo) {
        long now = System.currentTimeMillis();
        if (now - lastBlockTime < MIN_BLOCK_INTERVAL) return;
        lastBlockTime = now;
        Intent intent = new Intent(this, MessageActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("mensaje", texto);
        intent.putExtra("remitente", remitente);
        intent.putExtra("messageId", idMsg);
        if (titulo != null) intent.putExtra("titulo", titulo);
        startActivity(intent);
        if (rtdb != null) rtdb.child("mensajes_dispositivos").child(deviceId).child("ultimo_mensaje").child("leido").setValue(true);
        reportarEvento("mensaje_director");
    }
    
    private void reportarEvento(String tipo) {
        if (rtdb == null || deviceId == null) return;
        String key = tipo + "_" + deviceId;
        long now = System.currentTimeMillis();
        if (lastReportTime.containsKey(key) && (now - lastReportTime.get(key)) < MIN_REPORT_INTERVAL) return;
        lastReportTime.put(key, now);
        Map<String, Object> e = new HashMap<>();
        e.put("tipo", tipo);
        e.put("timestamp", now);
        e.put("deviceId", deviceId);
        rtdb.child("alertas_seguridad").push().setValue(e);
    }

    private void startForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "EduControlPro", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EduControlPro Activo").setSmallIcon(android.R.drawable.ic_lock_lock).build();
        startForeground(1001, notif);
    }

    private void startHeartbeat() {
        heartbeatHandler = new Handler(Looper.getMainLooper());
        heartbeatHandler.post(new Runnable() {
            @Override public void run() {
                if (isServiceActive && deviceId != null && rtdb != null) {
                    Map<String, Object> data = new HashMap<>();
                    data.put("lastSeen", System.currentTimeMillis());
                    data.put("online", true);
                    rtdb.child("status_dispositivos").child(deviceId).updateChildren(data);
                }
                heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
            }
        });
    }

    private void startWatchdog() {
        watchdogHandler = new Handler(Looper.getMainLooper());
        watchdogHandler.postDelayed(new Runnable() {
            @Override public void run() {
                isServiceActive = true;
                watchdogHandler.postDelayed(this, SERVICE_CHECK_INTERVAL);
            }
        }, SERVICE_CHECK_INTERVAL);
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EduControlPro:WakeLock");
        wakeLock.acquire(10 * 60 * 1000L);
    }

    private void cargarConfiguracion() {
        rtdb.child("dispositivos").child(deviceId).child("InstitutoId").addListenerForSingleValueEvent(new ValueEventListener() {
            @Override public void onDataChange(DataSnapshot s) { institutoId = s.getValue(String.class); }
            @Override public void onCancelled(DatabaseError e) {}
        });
    }

    private void syncModes() {
        rtdb.child("status_dispositivos").child(deviceId).child("admin_mode_enable").addValueEventListener(new ValueEventListener() {
            @Override public void onDataChange(DataSnapshot s) { allowAccess = Boolean.TRUE.equals(s.getValue(Boolean.class)); }
            @Override public void onCancelled(DatabaseError e) {}
        });
        rtdb.child("status_dispositivos").child(deviceId).child("shield_mode_enable").addValueEventListener(new ValueEventListener() {
            @Override public void onDataChange(DataSnapshot s) {
                modoBlindadoActivo = Boolean.TRUE.equals(s.getValue(Boolean.class));
                if (modoBlindadoActivo && !allowAccess) mostrarBloqueo("blindaje_total", "⚠️ BLOQUEO TOTAL ACTIVADO ⚠️");
            }
            @Override public void onCancelled(DatabaseError e) {}
        });
        rtdb.child("mensajes_dispositivos").child(deviceId).child("ultimo_mensaje").addValueEventListener(new ValueEventListener() {
            @Override public void onDataChange(DataSnapshot s) {
                if (s.exists() && !Boolean.TRUE.equals(s.child("leido").getValue(Boolean.class))) {
                    mostrarMensajeDirector(s.child("texto").getValue(String.class), s.child("remitente").getValue(String.class), s.child("id").getValue(String.class), s.child("titulo").getValue(String.class));
                }
            }
            @Override public void onCancelled(DatabaseError e) {}
        });
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        isServiceActive = true;
        rtdb = FirebaseDatabase.getInstance().getReference();
        deviceId = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString("deviceId", null);
        if (deviceId != null) {
            cargarConfiguracion(); syncModes(); startHeartbeat(); startWatchdog(); startForegroundService(); acquireWakeLock();
        }
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED | AccessibilityEvent.TYPE_VIEW_CLICKED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        setServiceInfo(info);
    }

    @Override public void onInterrupt() { isServiceActive = false; }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        isServiceActive = false;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    }

    public String getCurrentUrl() { return currentUrl; }
}