package com.educontrolpro.services;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.Arrays;
import java.util.List;

public class MonitorService extends AccessibilityService {

    // --- CONFIGURACIÓN DE BLOQUEO ---
    private final List<String> blacklistedWords = Arrays.asList(
        "porno", "juegos", "casino", "armas", "gore", "sexo", "xxx", "hentai", "dating", "apuestas"
    );
    
    private final List<String> forbiddenApps = Arrays.asList(
        "com.android.settings", "com.android.vending", "com.google.android.gms",
        "com.facebook.katana", "com.facebook.orca", "com.instagram.android",
        "com.zhiliaoapp.musically", "com.snapchat.android", "com.twitter.android",
        "org.telegram.messenger", "org.thunderdog.challegram", "com.whatsapp",
        "com.reddit.frontpage", "com.discord", "org.thoughtcrime.securesms",
        "com.viber.voip", "com.skype.raider", "com.netflix.mediaclient",
        "com.google.android.youtube", "com.bumble.app", "com.tinder"
    );

    private final List<String> browserPackages = Arrays.asList(
        "com.android.chrome", "org.mozilla.firefox", "com.opera.browser", 
        "com.microsoft.emmx", "com.sec.android.app.sbrowser"
    );

    // IDs de barras y botones de "Ir/Buscar" en navegadores
    private final List<String> searchActionIds = Arrays.asList(
        "com.android.chrome:id/url_bar",
        "com.android.chrome:id/line_1", // Sugerencias de búsqueda
        "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
        "com.opera.browser:id/url_field"
    );

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString().toLowerCase();

        // 1. BLOQUEO PERIMETRAL (Ajustes, Tiendas, Redes, Mensajería)
        if (shouldBlockApp(packageName)) {
            performGlobalAction(GLOBAL_ACTION_HOME);
            return;
        }

        // 2. FILTRADO DE NAVEGACIÓN (Solo al ejecutar acción: Click o cambio de ventana)
        if (browserPackages.contains(packageName)) {
            int eventType = event.getEventType();
            if (eventType == AccessibilityEvent.TYPE_VIEW_CLICKED || 
                eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                
                validateAndCleanSearch(packageName);
            }
        }
    }

    private void validateAndCleanSearch(String currentPackage) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        // Verificar que estamos analizando la ventana correcta
        if (rootNode.getPackageName() == null || !rootNode.getPackageName().toString().equals(currentPackage)) {
            return;
        }

        for (String viewId : searchActionIds) {
            List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByViewId(viewId);
            
            if (nodes != null && !nodes.isEmpty()) {
                AccessibilityNodeInfo searchNode = nodes.get(0);
                if (searchNode == null) continue;

                CharSequence rawText = searchNode.getText();
                String searchText = (rawText != null) ? rawText.toString().toLowerCase().trim() : "";

                // Si la búsqueda contiene contenido prohibido
                if (isForbiddenContent(searchText)) {
                    
                    // A. LIMPIEZA INMEDIATA
                    Bundle arguments = new Bundle();
                    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                    searchNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                    
                    // B. EXPULSIÓN AL HOME
                    performGlobalAction(GLOBAL_ACTION_HOME);
                    break; // Salir del bucle tras la expulsión
                }
            }
        }
    }

    private boolean shouldBlockApp(String packageName) {
        // Bloqueo por coincidencia de paquete
        for (String app : forbiddenApps) {
            if (packageName.startsWith(app)) return true;
        }
        // Bloqueo por palabra clave en el nombre del paquete (juegos/adultos)
        List<String> keywords = Arrays.asList("casino", "poker", "adult", "porn", "sex", "freefire", "bet");
        for (String keyword : keywords) {
            if (packageName.contains(keyword)) return true;
        }
        return false;
    }

    private boolean isForbiddenContent(String text) {
        if (text == null || text.isEmpty()) return false;
        for (String word : blacklistedWords) {
            if (text.contains(word)) return true;
        }
        return false;
    }

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        
        // Configuramos los eventos de escucha
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                         AccessibilityEvent.TYPE_VIEW_CLICKED;
        
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 50; 
        info.flags = AccessibilityServiceInfo.DEFAULT | 
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS |
                     AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        
        setServiceInfo(info);
    }

    @Override public void onInterrupt() {}
}