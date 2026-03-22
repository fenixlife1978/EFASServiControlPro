package com.educontrolpro.services;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
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
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.database.FirebaseDatabase;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private static final String TAG = "EDU_Monitor";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";

    private FirebaseFirestore firestore;
    private String cachedDeviceId;

    // --- LISTA NEGRA DINÁMICA (Sincronizada con Dashboard en Firestore) ---
    private final List<String> dynamicBlacklist = new ArrayList<>();

    // --- LISTAS MASIVAS OFFLINE (.TXT 80k+) ---
    private final java.util.HashSet<String> massiveBlacklist = new java.util.HashSet<>();
    private final java.util.HashSet<String> massiveWhitelist = new java.util.HashSet<>();

    private long lastReportedTime = 0;
    private String lastReportedUrl = "";

    // --- PALABRAS CLAVE PROHIBIDAS (Filtro de Contenido en Búsquedas) ---
    private final List<String> blacklistedWords = Arrays.asList(
        "porno", "juegos", "casino", "armas", "gore", "sexo", "xxx", "hentai", "dating", "apuestas",
        "erotico", "eróticos", "erotica", "adultos", "adult", "onlyfans",
        "tiktok", "fortnite", "freefire", "free fire", "snapchat", "reddit",
        "instagram", "facebook", "roblox", "jugar", "play store"
    );
    
    // --- APPS NATIVAS PROHIBIDAS (Bloqueo Fulminante) ---
    private final List<String> forbiddenPackages = Arrays.asList(
        "com.android.vending", // Play Store
        "com.google.android.apps.games", // Play Games
        "com.zhiliaoapp.musically", // TikTok
        "com.epicgames.fortnite", // Fortnite
        "com.dts.freefireth", // Free Fire
        "com.dts.freefiremax", // Free Fire Max
        "com.snapchat.android", // Snapchat
        "reddit.frontpage", // Reddit
        "com.facebook.katana", // Facebook
        "com.instagram.android", // Instagram
        "com.twitter.android", // Twitter / X
        "com.roblox.client", // Roblox
        "com.tencent.ig", // PUBG
        "com.ea.gp.fifamobile" // FIFA
    );

    // --- NAVEGADORES SOPORTADOS ---
    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", "org.mozilla.firefox", "com.opera.browser", 
        "com.microsoft.emmx", "com.sec.android.app.sbrowser"
    );

    // --- IDs DE VISTAS PARA CAPTURAR URLs ---
    private final List<String> searchActionIds = Arrays.asList(
        "com.android.chrome:id/url_bar",
        "com.android.chrome:id/line_1",
        "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
        "com.opera.browser:id/url_field"
    );

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        
        // Inicializar Firestore
        firestore = FirebaseFirestore.getInstance();

        // Cargar DeviceID desde preferencias de Capacitor
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
        cachedDeviceId = prefs.getString(KEY_DEVICE_ID, "unknown_device");

        // Iniciar Sincronización de Lista Negra
        startBlacklistSync();

        // Configuración estricta de Accesibilidad
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | AccessibilityEvent.TYPE_VIEW_CLICKED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 50;
        info.flags = AccessibilityServiceInfo.DEFAULT | 
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS |
                     AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        setServiceInfo(info);
        
        Log.d(TAG, "MonitorService Conectado - Sincronizado con Firestore");
    }

    private void startBlacklistSync() {
        firestore.collection("configuracion_global")
            .addSnapshotListener(new EventListener<QuerySnapshot>() {
                @Override
                public void onEvent(@Nullable QuerySnapshot snapshots, @Nullable FirebaseFirestoreException e) {
                    if (e != null) {
                        Log.e(TAG, "Error en Sincronización Firestore", e);
                        return;
                    }
                    
                    if (snapshots != null) {
                        dynamicBlacklist.clear();
                        for (DocumentSnapshot doc : snapshots.getDocuments()) {
                            
                            String docId = doc.getId();

                            // LECTURA DE URLs MASIVAS (.TXT)
                            String massiveBlacklistUrl = doc.getString("blacklist_url");
                            String massiveWhitelistUrl = doc.getString("whitelist_url");

                            if (massiveBlacklistUrl != null) {
                                checkAndDownloadMassiveList(massiveBlacklistUrl, "blacklist.txt", massiveBlacklist);
                            }
                            if (massiveWhitelistUrl != null) {
                                checkAndDownloadMassiveList(massiveWhitelistUrl, "whitelist.txt", massiveWhitelist);
                            }

                            // SEPARACIÓN CORRECTA ENTRE LISTA BLANCA Y NEGRA (Firestore Arrays)
                            if ("whitelist".equals(docId)) {
                                List<String> wList = (List<String>) doc.get("dominios");
                                if (wList == null) wList = (List<String>) doc.get("domains");
                                if (wList != null) {
                                    for (String d : wList) massiveWhitelist.add(d.toLowerCase());
                                }
                            } else if ("blacklist".equals(docId)) {
                                List<String> bList = (List<String>) doc.get("dominios");
                                if (bList == null) bList = (List<String>) doc.get("domains");
                                if (bList != null) {
                                    for (String d : bList) dynamicBlacklist.add(d.toLowerCase());
                                }
                            } else {
                                // Soporte Legacy para documentos antiguos con campo "domain" único
                                String domain = doc.getString("domain");
                                if (domain != null && !domain.isEmpty()) {
                                    dynamicBlacklist.add(domain.toLowerCase());
                                }
                            }
                        }
                        Log.d(TAG, "Listas EDUControlPro Actualizadas: Negra(" + dynamicBlacklist.size() + "), Blanca Masiva(" + massiveWhitelist.size() + ")");
                    }
                }
            });
    }

    // --- DESCARGA E INYECCIÓN DE ARCHIVOS GIGANTES ---
    private void checkAndDownloadMassiveList(String url, String fileName, java.util.HashSet<String> targetSet) {
        if (url == null || url.isEmpty()) return;
        
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
        String savedUrl = prefs.getString(fileName + "_url", "");
        
        if (!savedUrl.equals(url)) {
            // Es un archivo nuevo, lo descargamos en Segundo Plano
            new Thread(() -> {
                try {
                    java.net.URL urlObj = new java.net.URL(url);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) urlObj.openConnection();
                    conn.connect();
                    java.io.InputStream is = conn.getInputStream();
                    java.io.FileOutputStream fos = openFileOutput(fileName, Context.MODE_PRIVATE);
                    byte[] buffer = new byte[4096];
                    int len;
                    while ((len = is.read(buffer)) > 0) {
                        fos.write(buffer, 0, len);
                    }
                    fos.close();
                    is.close();
                    
                    prefs.edit().putString(fileName + "_url", url).apply();
                    Log.d(TAG, "Descargada nueva lista masiva .txt: " + fileName);
                    
                    loadMassiveList(fileName, targetSet);
                } catch (Exception e) {
                    Log.e(TAG, "Error descargando lista masiva " + fileName, e);
                }
            }).start();
        } else {
            // El archivo ya estaba descargado, lo montamos a RAM (HashSet) si está vacío
            if (targetSet.isEmpty()) {
                loadMassiveList(fileName, targetSet);
            }
        }
    }

    private void loadMassiveList(String fileName, java.util.HashSet<String> targetSet) {
        try {
            java.io.FileInputStream fis = openFileInput(fileName);
            java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(fis));
            String line;
            targetSet.clear();
            while ((line = reader.readLine()) != null) {
                String clean = line.trim().toLowerCase();
                // Ignorar comentarios (suelen ser '#' o '/') o líneas vacías
                if (!clean.isEmpty() && !clean.startsWith("#")) {
                    targetSet.add(clean);
                }
            }
            reader.close();
            fis.close();
            Log.d(TAG, "Lista masiva " + fileName + " INYECTADA en memoria: " + targetSet.size() + " registros.");
        } catch (Exception e) {
            Log.e(TAG, "Error montando lista masiva a la memoria: " + fileName, e);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString().toLowerCase();

        // 1. Bloqueo Nativo Fulminante de Apps (Play Store, Juegos, Redes Sociales)
        if (isForbiddenPackage(packageName)) {
            Log.w(TAG, "App Bloqueada por Centinela: " + packageName);
            performGlobalAction(GLOBAL_ACTION_HOME); // Expulsión a pantalla de inicio
            sendSecurityReport("App_Prohibida: " + packageName);
            return; // Detener flujo
        }

        // 2. Filtrar solo eventos de navegadores para captura de URLs
        if (browserPackages.contains(packageName)) {
            int eventType = event.getEventType();
            if (eventType == AccessibilityEvent.TYPE_VIEW_CLICKED || 
                eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                validateAndProtectNavigation();
            }
        }
    }

    private boolean isForbiddenPackage(String pkg) {
        for (String fPkg : forbiddenPackages) {
            if (pkg.contains(fPkg)) return true;
        }
        return false;
    }

    private void reportAllowedVisit(String url) {
        if (url == null || url.trim().isEmpty() || url.length() < 4) return;
        
        long currentTime = System.currentTimeMillis();
        // Evitar inmersión constante, esperar 5 segundos para la misma URL
        if (url.equals(lastReportedUrl) && (currentTime - lastReportedTime) < 5000) {
            return;
        }
        
        lastReportedUrl = url;
        lastReportedTime = currentTime;

        try {
            // 1. RTDB Monitor LIVE (Sobrescribe la URL actual)
            FirebaseDatabase.getInstance().getReference("dispositivos")
                .child(cachedDeviceId)
                .child("current_url")
                .setValue(url);
            
            // 2. Historial Diario (Agrega nuevo registro)
            Map<String, Object> historyLog = new HashMap<>();
            historyLog.put("url", url);
            historyLog.put("timestamp", currentTime);
            
            FirebaseDatabase.getInstance().getReference("historial_navegacion")
                .child(cachedDeviceId)
                .push()
                .setValue(historyLog);
                
        } catch (Exception e) {
            Log.e(TAG, "Error reportando historial a RTDB", e);
        }
    }

    private void validateAndProtectNavigation() {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        for (String viewId : searchActionIds) {
            List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByViewId(viewId);
            if (nodes != null && !nodes.isEmpty()) {
                AccessibilityNodeInfo searchNode = nodes.get(0);
                CharSequence rawText = searchNode.getText();
                String searchText = (rawText != null) ? rawText.toString().toLowerCase().trim() : "";

                if (isForbidden(searchText)) {
                    // Acción de Bloqueo: Reportar y Cerrar
                    sendSecurityReport(searchText);
                    
                    // Limpiar el texto de la barra (Capa de Seguridad Estudiantil)
                    Bundle args = new Bundle();
                    args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                    searchNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                    
                    // Expulsar al usuario de la navegación prohibida
                    performGlobalAction(GLOBAL_ACTION_HOME);
                    Log.w(TAG, "Bloqueo Centinela ejecutado para: " + searchText);
                    break;
                } else {
                    // Permitido: Reportar al LIVE Monitor
                    reportAllowedVisit(searchText);
                }
                searchNode.recycle();
            }
        }
        rootNode.recycle();
    }

    private void sendSecurityReport(String url) {
        if (firestore == null) return;

        Map<String, Object> log = new HashMap<>();
        log.put("deviceId", cachedDeviceId);
        log.put("url", url);
        log.put("timestamp", FieldValue.serverTimestamp());
        log.put("status", "blocked");

        firestore.collection("system_analysis_blocked_attempts").add(log)
            .addOnSuccessListener(documentReference -> Log.d(TAG, "Reporte enviado: " + url))
            .addOnFailureListener(e -> Log.e(TAG, "Error enviando reporte", e));
    }

    private boolean isForbidden(String text) {
        if (text == null || text.isEmpty()) return false;

        // Comprobación contra palabras estáticas
        for (String word : blacklistedWords) {
            if (text.contains(word)) return true;
        }

        // Comprobación contra dominios dinámicos (Dashboard Array manual)
        for (String domain : dynamicBlacklist) {
            if (text.contains(domain)) return true;
        }

        // --- SISTEMA MASIVO OFFLINE (.txt) (Optimización O(1) con HashSet) ---
        if (!massiveWhitelist.isEmpty() || !massiveBlacklist.isEmpty()) {
            // Extraer posibles dominios o palabras del texto en la barra
            // Ej: "https://m.ejemplo.com/video" -> ["https:", "", "m.ejemplo.com", "video"]
            String[] tokens = text.split("[ /?=&]");
            
            for (String token : tokens) {
                String cleanToken = token.trim();
                if (cleanToken.isEmpty() || cleanToken.length() < 3) continue;

                // 1. Whitelist Prioritaria Extrema: Si está permitida, se anula cualquier bloqueo de ese dominio
                if (massiveWhitelist.contains(cleanToken)) {
                    return false; 
                }
                
                // 2. Blacklist Masiva O(1) Exacta
                if (massiveBlacklist.contains(cleanToken)) {
                    return true;
                }

                // 3. Extracción de Dominio Base
                // Ej. si el token es "m.youtube.com", probar también "youtube.com"
                int dotIndex = cleanToken.indexOf('.');
                if (dotIndex > 0 && dotIndex < cleanToken.length() - 1) {
                    String baseDomain = cleanToken.substring(dotIndex + 1);
                    if (massiveWhitelist.contains(baseDomain)) return false;
                    if (massiveBlacklist.contains(baseDomain)) return true;

                    // Si hay un tercer nivel (ej. www.m.ejemplo.com) probamos un nivel más abstracto
                    int secondDot = baseDomain.indexOf('.');
                    if (secondDot > 0 && secondDot < baseDomain.length() - 1) {
                        String rootDomain = baseDomain.substring(secondDot + 1);
                        if (massiveWhitelist.contains(rootDomain)) return false;
                        if (massiveBlacklist.contains(rootDomain)) return true;
                    }
                }
            }
        }

        return false;
    }

    @Override public void onInterrupt() {}
}