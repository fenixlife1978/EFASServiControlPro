package com.educontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

// Importaciones necesarias para asegurar que los plugins carguen bien
import com.capacitorjs.plugins.device.DevicePlugin;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Registro de Plugins
        registerPlugin(DevicePlugin.class);
        registerPlugin(LiberarPlugin.class); // <-- PLUGIN REGISTRADO CORRECTAMENTE

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

    // --- FUNCIÓN DE SEGURIDAD PARA LIBERAR DISPOSITIVO ---
    // Esta función permite que si mandas un Intent desde TS, la app se desvincule de ser Owner
    private void liberarDispositivoTotal() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                // PRIMERO: Desbloqueamos la desinstalación
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                // SEGUNDO: Renunciamos a ser Device Owner
                dpm.clearDeviceOwnerApp(getPackageName());
                
                Log.d("EDU_Status", "¡DISPOSITIVO LIBERADO! Ya no es Device Owner.");
                
                // Limpiamos los SharedPreferences para que la app sepa que debe volver a vincularse
                SharedPreferences.Editor editor = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit();
                editor.clear();
                editor.apply();

                // Cerramos la app para aplicar cambios
                finishAffinity();
            }
        } catch (Exception e) {
            Log.e("EDU_Status", "Error al intentar liberar: " + e.getMessage());
        }
    }

    // Escuchamos si desde React enviamos una orden de "LIBERAR"
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && "ACTION_LIBERAR_TAB".equals(intent.getAction())) {
            liberarDispositivoTotal();
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
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String institutoId = prefs.getString(KEY_INSTITUTO_ID, null);

        if (institutoId == null) {
            Log.d("EDU_Status", "Dispositivo EDUControlPro NO vinculado. Esperando Scan.");
        } else {
            Log.d("EDU_Status", "Vinculado a: " + institutoId + ". Iniciando protección...");
            
            try {
                Intent serviceIntent = new Intent(this, AppBlockService.class);
                startService(serviceIntent);
            } catch (Exception e) {
                Log.e("EDU_Status", "Error en AppBlockService: " + e.getMessage());
            }
            // moveTaskToBack(true); // Comentado para que no se minimice siempre al abrir durante desarrollo
        }
    }
}
