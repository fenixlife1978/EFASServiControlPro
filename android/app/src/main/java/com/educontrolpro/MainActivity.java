package com.educontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;
import com.google.firebase.firestore.FirebaseFirestore;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";
    
    // Constantes para sincronizar con MonitorService
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Registro de Plugins
        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class); 
        } catch (Exception e) {
            Log.e("EDU_Status", "Error al registrar LiberarPlugin: " + e.getMessage());
        }

        // 2. Lógica de seguridad (Device Owner / Admin)
        checkSecurityPrivileges();

        // 3. Verificar vinculación
        checkVinculacionYEstado();

        // 4. Monitor de actualizaciones
        try {
            UpdateManager updateManager = new UpdateManager(this);
            updateManager.listenForUpdates();
        } catch (Exception e) {
            Log.e("EDU_Status", "UpdateManager no inicializado: " + e.getMessage());
        }
    }

    // --- NUEVA FUNCIÓN: RE-ACTIVAR BLOQUEO DE ALUMNO ---
    // Llámala desde tu interfaz (Ionic/React) cuando termines el mantenimiento
    public void reactivarSeguridad() {
        // 1. Volvemos a bloquear localmente
        SharedPreferences prefs = getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_UNLOCKED, false).apply();
        
        // 2. Sincronizamos con Firebase si es posible
        try {
            String androidId = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            FirebaseFirestore.getInstance().collection("dispositivos")
                .document(androidId).update("admin_mode_enabled", false);
        } catch (Exception e) {
            Log.e("EDU_Status", "No se pudo actualizar Firebase, pero el bloqueo local es efectivo.");
        }

        Toast.makeText(this, "Seguridad activada: Ajustes bloqueados", Toast.LENGTH_LONG).show();
    }

    // --- FUNCIÓN PARA LIBERAR DISPOSITIVO TOTALMENTE ---
    public void liberarDispositivoTotal() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                dpm.clearUserRestriction(adminComponent, android.os.UserManager.DISALLOW_FACTORY_RESET);
                dpm.clearDeviceOwnerApp(getPackageName());
                
                stopService(new Intent(this, MonitorService.class));

                Log.d("EDU_Status", "¡DISPOSITIVO LIBERADO!");
                Toast.makeText(this, "Dispositivo Liberado. Reiniciando...", Toast.LENGTH_LONG).show();
                
                SharedPreferences.Editor editor = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit();
                editor.clear();
                editor.apply();

                finishAffinity();
            } else {
                dpm.removeActiveAdmin(adminComponent);
                Toast.makeText(this, "Admin eliminado.", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Log.e("EDU_Status", "Error al liberar: " + e.getMessage());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null) {
            if ("ACTION_LIBERAR_TAB".equals(intent.getAction())) {
                liberarDispositivoTotal();
            } else if ("ACTION_REBLOQUEAR_TAB".equals(intent.getAction())) {
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
                Log.d("EDU_Status", "Modo DEVICE OWNER activo.");
            } catch (Exception e) {
                Log.e("EDU_Status", "Error en Device Owner: " + e.getMessage());
            }
        } else if (!dpm.isAdminActive(adminComponent)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección obligatoria para EDUControlPro.");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }

    private void checkVinculacionYEstado() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String institutoId = prefs.getString(KEY_INSTITUTO_ID, null);

        if (institutoId == null) {
            Log.d("EDU_Status", "Dispositivo NO vinculado.");
        } else {
            Log.d("EDU_Status", "Vinculado a: " + institutoId);
            
            try {
                Intent serviceIntent = new Intent(this, MonitorService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent);
                } else {
                    startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.e("EDU_Status", "Error al iniciar MonitorService: " + e.getMessage());
            }
        }
    }
}
