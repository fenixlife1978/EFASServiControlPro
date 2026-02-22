package com.educontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.plugin.WebView;

// Importaciones necesarias para asegurar que los plugins carguen bien
import com.capacitorjs.plugins.device.DevicePlugin;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    // IMPORTANTE: Capacitor en Android guarda los Preferences en el nombre del paquete o "CapacitorStorage"
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Registro de Plugins (Para evitar el error de "Cannot find module" o fallos de ID)
        registerPlugin(DevicePlugin.class);

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

    private void checkSecurityPrivileges() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        if (dpm.isDeviceOwnerApp(getPackageName())) {
            try {
                // Bloqueo total de desinstalación
                dpm.setUninstallBlocked(adminComponent, getPackageName(), true);
                Log.d("EDU_Status", "Modo DEVICE OWNER activo en EDUControlPro.");
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
        // Leemos de CapacitorStorage para que Java sepa qué hizo el Scanner en TS
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String institutoId = prefs.getString(KEY_INSTITUTO_ID, null);

        if (institutoId == null) {
            Log.d("EDU_Status", "Dispositivo EDUControlPro NO vinculado. Esperando Scan.");
        } else {
            Log.d("EDU_Status", "Vinculado a: " + institutoId + ". Iniciando protección...");
            
            // Iniciar servicio de bloqueo de Apps
            try {
                Intent serviceIntent = new Intent(this, AppBlockService.class);
                startService(serviceIntent);
            } catch (Exception e) {
                Log.e("EDU_Status", "Error en AppBlockService de EDUControlPro: " + e.getMessage());
            }
            
            // Mover al fondo solo si ya está vinculado
            moveTaskToBack(true);
        }
    }
}
