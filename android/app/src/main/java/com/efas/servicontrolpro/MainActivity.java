package com.efas.servicontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    // Ajustado a CapacitorStorage para que JS y Java lean lo mismo
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Lógica de seguridad dual (Owner vs Admin)
        checkSecurityPrivileges();

        // 2. Verificar vinculación y gestionar visibilidad/servicios
        checkVinculacionYEstado();

        // 3. Iniciar monitor de actualizaciones (Mantenemos tu lógica original)
        try {
            UpdateManager updateManager = new UpdateManager(this);
            updateManager.listenForUpdates();
        } catch (Exception e) {
            Log.e("EFAS_Status", "UpdateManager no inicializado: " + e.getMessage());
        }
    }

    private void checkSecurityPrivileges() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        if (dpm.isDeviceOwnerApp(getPackageName())) {
            try {
                // Bloqueo total de desinstalación por ser Device Owner
                dpm.setUninstallBlocked(adminComponent, getPackageName(), true);
            } catch (Exception e) {
                Log.e("EFAS_Status", "Error al bloquear desinstalación: " + e.getMessage());
            }
        } else if (!dpm.isAdminActive(adminComponent)) {
            // Si no es Owner, solicita ser Administrador normal
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección necesaria para EFAS ServiControlPro.");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }

    private void checkVinculacionYEstado() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String institutoId = prefs.getString(KEY_INSTITUTO_ID, null);

        if (institutoId == null) {
            // El Frontend de Capacitor detectará esto y mostrará el escáner QR
            Log.d("EFAS_Status", "Esperando vinculación con InstitutoId...");
        } else {
            Log.d("EFAS_Status", "Dispositivo vinculado al Instituto: " + institutoId);
            
            // --- INICIO DEL SERVICIO BLOQUEADOR ---
            // Iniciamos el servicio que vigila las Apps prohibidas
            try {
                Intent serviceIntent = new Intent(this, AppBlockService.class);
                startService(serviceIntent);
            } catch (Exception e) {
                Log.e("EFAS_Status", "No se pudo iniciar AppBlockService: " + e.getMessage());
            }
            
            // Manda la app al fondo para que el usuario use su tablet normalmente (Modo Invisible)
            moveTaskToBack(true);
        }
    }
}