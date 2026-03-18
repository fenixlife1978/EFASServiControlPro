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

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

import java.util.Map;
import java.util.HashMap;

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

        // Inicializar Firebase
        realtimeDb = FirebaseDatabase.getInstance();
        firestore = FirebaseFirestore.getInstance();

        // Registrar plugin de Device (necesario para Capacitor)
        registerPlugin(DevicePlugin.class);

        // Solicitar permisos necesarios
        solicitarPermisosNecesarios();

        // Lógica de seguridad (admin de dispositivo)
        checkSecurityPrivileges();

        // Verificar vinculación y estado
        checkVinculacionYEstado();

        // Obtener referencia a RTDB si el dispositivo está vinculado
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        if (deviceId != null) {
            deviceRealtimeRef = realtimeDb.getReference("dispositivos").child(deviceId);
        }

        logToRealtime("APP_START", "MainActivity iniciada");
    }

    // Log a Realtime Database
    private void logToRealtime(String tipo, String mensaje) {
        try {
            SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);
            if (deviceId != null) {
                DatabaseReference logRef = realtimeDb
                    .getReference("dispositivos")
                    .child(deviceId)
                    .child("app_logs")
                    .child(String.valueOf(System.currentTimeMillis()));

                Map<String, Object> logEntry = new HashMap<>();
                logEntry.put("tipo", tipo);
                logEntry.put("mensaje", mensaje);
                logEntry.put("timestamp", System.currentTimeMillis());
                logRef.setValue(logEntry);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en logToRealtime: " + e.getMessage());
        }
    }

    private void solicitarPermisosNecesarios() {
        String[] permisos;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permisos = new String[]{
                Manifest.permission.CAMERA,
                Manifest.permission.POST_NOTIFICATIONS
            };
        } else {
            permisos = new String[]{
                Manifest.permission.CAMERA
            };
        }

        boolean necesitaSolicitud = false;
        for (String permiso : permisos) {
            if (ContextCompat.checkSelfPermission(this, permiso) != PackageManager.PERMISSION_GRANTED) {
                necesitaSolicitud = true;
                break;
            }
        }

        if (necesitaSolicitud) {
            ActivityCompat.requestPermissions(this, permisos, 1001);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1001) {
            for (int i = 0; i < permissions.length; i++) {
                if (grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "Permiso concedido: " + permissions[i]);
                    logToRealtime("PERMISO_CONCEDIDO", permissions[i]);
                } else {
                    Log.d(TAG, "Permiso denegado: " + permissions[i]);
                    logToRealtime("PERMISO_DENEGADO", permissions[i]);
                    if (permissions[i].equals(Manifest.permission.CAMERA)) {
                        Toast.makeText(this, "Se necesita permiso de cámara", Toast.LENGTH_LONG).show();
                    }
                }
            }
        }
    }

    // Reactivar bloqueo (después de modo técnico)
    public void reactivarSeguridad() {
        SharedPreferences prefs = getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_UNLOCKED, false).apply();

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);

        if (deviceId != null && deviceRealtimeRef != null) {
            deviceRealtimeRef.child("admin_mode_enable").setValue(false)
                .addOnFailureListener(e -> Log.e(TAG, "Error RTDB: " + e.getMessage()));
        }

        Map<String, Object> backup = new HashMap<>();
        backup.put("tipo", "REBLOQUEO");
        backup.put("timestamp", FieldValue.serverTimestamp());
        firestore.collection("eventos_seguridad").add(backup);

        Toast.makeText(this, "Seguridad activada", Toast.LENGTH_LONG).show();
        reiniciarMonitorService();
    }

    // Liberar dispositivo (remover admin y desinstalar)
    public void liberarDispositivoTotal() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    dpm.clearDeviceOwnerApp(getPackageName());
                }
            } else if (dpm.isAdminActive(adminComponent)) {
                dpm.removeActiveAdmin(adminComponent);
            }

            stopService(new Intent(this, MonitorService.class));
            Log.d(TAG, "DISPOSITIVO LIBERADO");
            logToRealtime("LIBERACION", "Dispositivo liberado completamente");
            Toast.makeText(this, "Dispositivo Liberado", Toast.LENGTH_LONG).show();

            SharedPreferences.Editor editor = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit();
            editor.clear();
            editor.apply();

            if (deviceRealtimeRef != null) {
                deviceRealtimeRef.child("liberado").setValue(true);
                deviceRealtimeRef.child("fecha_liberacion").setValue(System.currentTimeMillis());
            }

            finishAffinity();
        } catch (Exception e) {
            Log.e(TAG, "Error al liberar: " + e.getMessage());
            logToRealtime("LIBERACION_ERROR", e.getMessage());
        }
    }

    private void reiniciarMonitorService() {
        stopService(new Intent(this, MonitorService.class));
        Intent serviceIntent = new Intent(this, MonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null) {
            String action = intent.getAction();
            if ("ACTION_LIBERAR_TAB".equals(action)) {
                liberarDispositivoTotal();
            } else if ("ACTION_REBLOQUEAR_TAB".equals(action)) {
                reactivarSeguridad();
            }
        }
    }

    private void checkSecurityPrivileges() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        if (dpm.isDeviceOwnerApp(getPackageName())) {
            try {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), true);
                Log.d(TAG, "Modo DEVICE OWNER activo");
            } catch (Exception e) {
                Log.e(TAG, "Error en Device Owner: " + e.getMessage());
            }
        } else if (!dpm.isAdminActive(adminComponent)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección obligatoria");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }

    private void checkVinculacionYEstado() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        String institutoId = capPrefs.getString("InstitutoId", null);

        if (deviceId == null || institutoId == null) {
            Log.d(TAG, "Dispositivo NO vinculado");
        } else {
            Log.d(TAG, "Vinculado a: " + institutoId + " - " + deviceId);
            reiniciarMonitorService();
        }
    }

    @Override
    public void onDestroy() {
        logToRealtime("APP_DESTROY", "MainActivity destruida");
        super.onDestroy();
    }
}