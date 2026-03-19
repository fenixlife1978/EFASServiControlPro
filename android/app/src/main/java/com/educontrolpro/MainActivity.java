package com.educontrolpro;

import android.Manifest;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;

// IMPORTACIONES PARA PERMISOS
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

// HÍBRIDO: Realtime DB + Firestore
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

import java.util.Map;
import java.util.HashMap;

// IMPORTACIÓN DEL SERVICIO
import com.educontrolpro.services.MonitorService;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String TAG = "MainActivity";
    
    private FirebaseDatabase realtimeDb;
    private DatabaseReference deviceRealtimeRef;
    private FirebaseFirestore firestore;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Inicializar Firebase
        realtimeDb = FirebaseDatabase.getInstance();
        firestore = FirebaseFirestore.getInstance();
        
        // 2. Registrar Plugins de Capacitor (Solo los esenciales)
        registerPlugin(DevicePlugin.class);

        // 3. Configuración de Seguridad y Estado
        solicitarPermisosBasicos();
        checkSecurityPrivileges();
        checkVinculacionYEstado();

        logToRealtime("APP_START", "MainActivity iniciada correctamente");
    }

    // --- LÓGICA DE LOGS SISTEMA ---
    private void logToRealtime(String tipo, String mensaje) {
        try {
            SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);
            if (deviceId != null) {
                DatabaseReference logRef = realtimeDb.getReference("dispositivos")
                    .child(deviceId).child("system_logs").child(String.valueOf(System.currentTimeMillis()));
                
                Map<String, Object> logEntry = new HashMap<>();
                logEntry.put("tipo", tipo);
                logEntry.put("mensaje", mensaje);
                logEntry.put("timestamp", System.currentTimeMillis());
                logRef.setValue(logEntry);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error log: " + e.getMessage());
        }
    }

    // --- PERMISOS ---
    private void solicitarPermisosBasicos() {
        String[] permisos = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) ?
            new String[]{Manifest.permission.CAMERA, Manifest.permission.POST_NOTIFICATIONS} :
            new String[]{Manifest.permission.CAMERA};
        
        boolean necesitaSolicitud = false;
        for (String p : permisos) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                necesitaSolicitud = true; 
                break;
            }
        }
        if (necesitaSolicitud) ActivityCompat.requestPermissions(this, permisos, 1001);
    }

    // --- ACCIONES DE SEGURIDAD ---
    public void reactivarSeguridad() {
        getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, false).apply();
        reiniciarMonitorService();
        Toast.makeText(this, "Protección EFAS Reactivada", Toast.LENGTH_SHORT).show();
    }

    public void liberarDispositivoTotal() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, AdminReceiver.class);
        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(admin, getPackageName(), false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    dpm.clearDeviceOwnerApp(getPackageName());
                }
                stopService(new Intent(this, MonitorService.class));
                logToRealtime("LIBERACION", "Dispositivo liberado");
                
                getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit().clear().apply();
                finishAffinity();
            }
        } catch (Exception e) {
            logToRealtime("LIBERACION_ERROR", e.getMessage());
        }
    }

    private void reiniciarMonitorService() {
        Intent intent = new Intent(this, MonitorService.class);
        stopService(intent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }

    private void checkSecurityPrivileges() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, AdminReceiver.class);
        
        if (!dpm.isDeviceOwnerApp(getPackageName()) && !dpm.isAdminActive(admin)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin); // Corregido: EXTRA_DEVICE_ADMIN
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección requerida.");
            startActivity(intent);
        }
    }

    private void checkVinculacionYEstado() {
        SharedPreferences cap = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String dId = cap.getString(KEY_DEVICE_ID, null);
        if (dId != null) {
            deviceRealtimeRef = realtimeDb.getReference("dispositivos").child(dId);
            reiniciarMonitorService();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getAction() != null) {
            if (intent.getAction().equals("ACTION_LIBERAR_TAB")) {
                liberarDispositivoTotal();
            } else if (intent.getAction().equals("ACTION_REBLOQUEAR_TAB")) {
                reactivarSeguridad();
            }
        }
    }
}