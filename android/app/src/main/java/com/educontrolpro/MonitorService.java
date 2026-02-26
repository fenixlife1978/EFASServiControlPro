package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

public class MonitorService extends AccessibilityService {

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (event.getPackageName() != null) {
                String packageName = event.getPackageName().toString();
                Log.d("EDU_Monitor", "App detectada: " + packageName);

                // Lógica de bloqueo instantáneo
                if (packageName.contains("tiktok") || packageName.contains("instagram") || 
                    packageName.contains("facebook") || packageName.contains("youtube")) {
                    
                    Intent lockIntent = new Intent(this, LockActivity.class);
                    lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(lockIntent);
                }
            }
        }
    }

    @Override
    public void onInterrupt() {
        Log.e("EDU_Monitor", "Servicio interrumpido");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.d("EDU_Monitor", "Servicio de Accesibilidad Conectado");
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;
        setServiceInfo(info);
    }
}
