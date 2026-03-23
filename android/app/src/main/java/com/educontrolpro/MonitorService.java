package com.educontrolpro.services;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.QuerySnapshot;
import com.google.firebase.database.FirebaseDatabase;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/**
 * MonitorService - Versión Simplificada
 * 
 * FUNCIONES:
 * 1. EXPULSIÓN INMEDIATA de:
 *    - Ajustes/Configuración del dispositivo
 *    - Apps de entretenimiento (TikTok, Instagram, Facebook, Messenger, Reddit, Snapchat, WhatsApp)
 *    - Tiendas de apps (Play Store, Galaxy Store, etc.)
 * 
 * 2. LECTURA de URL al momento de búsqueda (click, enter, "Ir") 
 *    para REPORTAR al dashboard (SIN BLOQUEAR)
 * 
 * 3. SINCRONIZACIÓN de listas negra/blanca con Firestore para la VPN
 */
public class MonitorService extends AccessibilityService {

    private static final String TAG = "EDU_Monitor";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";

    private FirebaseFirestore firestore;
    private String cachedDeviceId;
    
    // Listas para sincronizar con VPN
    private final HashSet<String> dynamicBlacklist = new HashSet<>();
    private final HashSet<String> dynamicWhitelist = new HashSet<>();
    
    // Lista masiva offline
    private final HashSet<String> massiveBlacklist = new HashSet<>();
    private final HashSet<String> massiveWhitelist = new HashSet<>();
    
    // --- APPS PROHIBIDAS (EXPULSIÓN INMEDIATA) ---
    // Ajustes
    private final List<String> forbiddenSettings = Arrays.asList(
        "com.android.settings",           // Configuración Android
        "com.android.systemui",           // Sistema
        "com.google.android.gms"          // Google Settings
    );
    
    // Tiendas de apps
    private final List<String> forbiddenStores = Arrays.asList(
        "com.android.vending",            // Play Store
        "com.google.android.apps.games",  // Play Games
        "com.sec.android.app.samsungapps", // Galaxy Store
        "com.huawei.appmarket",           // Huawei AppGallery
        "com.xiaomi.market",              // Xiaomi GetApps
        "com.oppo.market",                // Oppo Store
        "com.amazon.venezia"              // Amazon Appstore
    );
    
    // Redes sociales y entretenimiento
    private final List<String> forbiddenSocial = Arrays.asList(
        "com.zhiliaoapp.musically",       // TikTok
        "com.epicgames.fortnite",         // Fortnite
        "com.dts.freefireth",             // Free Fire
        "com.dts.freefiremax",            // Free Fire Max
        "com.snapchat.android",           // Snapchat
        "reddit.frontpage",               // Reddit
        "com.facebook.katana",            // Facebook
        "com.facebook.orca",              // Messenger
        "com.instagram.android",          // Instagram
        "com.twitter.android",            // Twitter / X
        "com.roblox.client",              // Roblox
        "com.tencent.ig",                 // PUBG
        "com.whatsapp",                   // WhatsApp
        "com.whatsapp.w4b"                // WhatsApp Business
    );
    
    // Todas las apps prohibidas (unificadas para expulsión inmediata)
    private final List<String> allForbiddenPackages = new ArrayList<>();

    // Navegadores soportados (solo para lectura de URL, sin bloqueo)
    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", 
        "org.mozilla.firefox", 
        "com.opera.browser", 
        "com.microsoft.emmx", 
        "com.sec.android.app.sbrowser"
    );

    // IDs de vistas para capturar URLs
    private final List<String> searchActionIds = Arrays.asList(
        "com.android.chrome:id/url_bar",
        "com.android.chrome:id/line_1",
        "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
        "com.opera.browser:id/url_field"
    );
    
    private long lastReportedTime = 0;
    private String lastReportedUrl = "";

    @Override
    public void onCreate() {
        super.onCreate();
        
        // Unificar listas prohibidas
        allForbiddenPackages.addAll(forbiddenSettings);
        allForbiddenPackages.addAll(forbiddenStores);
        allForbiddenPackages.addAll(forbiddenSocial);
        
        Log.d(TAG, "MonitorService creado - " + allForbiddenPackages.size() + " apps prohibidas");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        
        firestore = FirebaseFirestore.getInstance();

        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
        cachedDeviceId = prefs.getString(KEY_DEVICE_ID, "unknown_device");

        // Iniciar sincronización de listas para VPN
        startBlacklistSync();

        // Configuración de accesibilidad
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | 
                          AccessibilityEvent.TYPE_VIEW_CLICKED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 50;
        info.flags = AccessibilityServiceInfo.DEFAULT | 
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS |
                     AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        setServiceInfo(info);
        
        Log.d(TAG, "MonitorService conectado");
    }

    private void startBlacklistSync() {
        firestore.collection("configuracion_global")
            .addSnapshotListener(new EventListener<QuerySnapshot>() {
                @Override
                public void onEvent(@Nullable QuerySnapshot snapshots, @Nullable FirebaseFirestoreException e) {
                    if (e != null) {
                        Log.e(TAG, "Error en sincronización Firestore", e);
                        return;
                    }
                    
                    if (snapshots != null) {
                        dynamicBlacklist.clear();
                        dynamicWhitelist.clear();
                        
                        for (DocumentSnapshot doc : snapshots.getDocuments()) {
                            String docId = doc.getId();
                            
                            // Cargar listas masivas desde URLs
                            String massiveBlacklistUrl = doc.getString("blacklist_url");
                            String massiveWhitelistUrl = doc.getString("whitelist_url");
                            
                            if (massiveBlacklistUrl != null) {
                                loadMassiveListAsync(massiveBlacklistUrl, "blacklist.txt", massiveBlacklist);
                            }
                            if (massiveWhitelistUrl != null) {
                                loadMassiveListAsync(massiveWhitelistUrl, "whitelist.txt", massiveWhitelist);
                            }
                            
                            // Lista blanca dinámica
                            if ("whitelist".equals(docId)) {
                                List<String> wList = (List<String>) doc.get("dominios");
                                if (wList == null) wList = (List<String>) doc.get("domains");
                                if (wList != null) {
                                    for (String d : wList) dynamicWhitelist.add(d.toLowerCase());
                                }
                            }
                            
                            // Lista negra dinámica
                            if ("blacklist".equals(docId)) {
                                List<String> bList = (List<String>) doc.get("dominios");
                                if (bList == null) bList = (List<String>) doc.get("domains");
                                if (bList != null) {
                                    for (String d : bList) dynamicBlacklist.add(d.toLowerCase());
                                }
                            }
                        }
                        
                        // Sincronizar listas con VPN
                        LocalVpnService.updateLists(
                            new HashSet<>(dynamicBlacklist), 
                            new HashSet<>(dynamicWhitelist)
                        );
                        
                        Log.d(TAG, "Listas actualizadas - Negra: " + dynamicBlacklist.size() + 
                                   ", Blanca: " + dynamicWhitelist.size());
                    }
                }
            });
    }
    
    private void loadMassiveListAsync(String url, String fileName, HashSet<String> targetSet) {
        new Thread(() -> {
            try {
                java.net.URL urlObj = new java.net.URL(url);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) urlObj.openConnection();
                conn.connect();
                java.io.InputStream is = conn.getInputStream();
                java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(is));
                String line;
                HashSet<String> tempSet = new HashSet<>();
                while ((line = reader.readLine()) != null) {
                    String clean = line.trim().toLowerCase();
                    if (!clean.isEmpty() && !clean.startsWith("#")) {
                        tempSet.add(clean);
                    }
                }
                reader.close();
                is.close();
                
                targetSet.clear();
                targetSet.addAll(tempSet);
                
                // Actualizar VPN
                LocalVpnService.updateLists(dynamicBlacklist, dynamicWhitelist);
                
                Log.d(TAG, "Lista masiva cargada: " + fileName + " - " + targetSet.size() + " registros");
            } catch (Exception e) {
                Log.e(TAG, "Error cargando lista masiva " + fileName, e);
            }
        }).start();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString();
        
        // ============================================================
        // 1. EXPULSIÓN INMEDIATA de apps prohibidas (milisegundos)
        // ============================================================
        if (isForbiddenPackage(packageName)) {
            Log.w(TAG, "EXPULSIÓN INMEDIATA - App prohibida: " + packageName);
            performGlobalAction(GLOBAL_ACTION_HOME);
            sendSecurityReport("App_Prohibida: " + packageName);
            return; // Detener todo flujo, expulsión inmediata
        }
        
        // ============================================================
        // 2. LECTURA de URL en navegadores (SIN BLOQUEO, solo reporte)
        // ============================================================
        if (browserPackages.contains(packageName)) {
            int eventType = event.getEventType();
            if (eventType == AccessibilityEvent.TYPE_VIEW_CLICKED || 
                eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                captureAndReportUrl();
            }
        }
    }
    
    /**
     * Verifica si un paquete está en la lista de prohibidos
     */
    private boolean isForbiddenPackage(String packageName) {
        String lowerPkg = packageName.toLowerCase();
        for (String forbidden : allForbiddenPackages) {
            if (lowerPkg.contains(forbidden) || lowerPkg.equals(forbidden)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Captura la URL de la barra de direcciones y la reporta (SIN BLOQUEAR)
     */
    private void captureAndReportUrl() {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;
        
        for (String viewId : searchActionIds) {
            List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByViewId(viewId);
            if (nodes != null && !nodes.isEmpty()) {
                AccessibilityNodeInfo searchNode = nodes.get(0);
                CharSequence rawText = searchNode.getText();
                String url = (rawText != null) ? rawText.toString() : "";
                
                if (!url.isEmpty()) {
                    reportAllowedVisit(url);
                }
                
                searchNode.recycle();
                break;
            }
        }
        rootNode.recycle();
    }
    
    /**
     * Reporta la URL al dashboard (HISTORIAL, SIN BLOQUEO)
     */
    private void reportAllowedVisit(String url) {
        if (url == null || url.trim().isEmpty() || url.length() < 4) return;
        
        long currentTime = System.currentTimeMillis();
        // Evitar spam, esperar 2 segundos para la misma URL
        if (url.equals(lastReportedUrl) && (currentTime - lastReportedTime) < 2000) {
            return;
        }
        
        lastReportedUrl = url;
        lastReportedTime = currentTime;
        
        try {
            // URL actual en tiempo real
            FirebaseDatabase.getInstance().getReference("dispositivos")
                .child(cachedDeviceId)
                .child("current_url")
                .setValue(url);
            
            // Historial de navegación
            Map<String, Object> historyLog = new HashMap<>();
            historyLog.put("url", url);
            historyLog.put("timestamp", currentTime);
            
            FirebaseDatabase.getInstance().getReference("historial_navegacion")
                .child(cachedDeviceId)
                .push()
                .setValue(historyLog);
                
            Log.d(TAG, "URL reportada: " + url);
                
        } catch (Exception e) {
            Log.e(TAG, "Error reportando URL", e);
        }
    }
    
    /**
     * Reporta intentos de acceso a apps prohibidas
     */
    private void sendSecurityReport(String data) {
        if (firestore == null) return;
        
        Map<String, Object> log = new HashMap<>();
        log.put("deviceId", cachedDeviceId);
        log.put("data", data);
        log.put("timestamp", com.google.firebase.firestore.FieldValue.serverTimestamp());
        log.put("status", "blocked_immediate");

        firestore.collection("system_analysis_blocked_attempts").add(log)
            .addOnSuccessListener(docRef -> Log.d(TAG, "Reporte enviado: " + data))
            .addOnFailureListener(e -> Log.e(TAG, "Error enviando reporte", e));
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "MonitorService interrumpido");
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "MonitorService destruido");
    }
    
}