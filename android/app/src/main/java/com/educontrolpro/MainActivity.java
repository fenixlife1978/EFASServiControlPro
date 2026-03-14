package com.educontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;
import com.google.firebase.firestore.FirebaseFirestore;

// IMPORTACIONES NUEVAS PARA VPN
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";
    
    // Controlador de VPN
    private VpnController vpnController;
    
    // Variables para el estado de la VPN
    private boolean vpnActiva = false;

    // ActivityResultLauncher para pedir permiso VPN
    private final ActivityResultLauncher<Intent> vpnPermissionLauncher = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(),
        result -> {
            if (result.getResultCode() == RESULT_OK) {
                // Permiso concedido, iniciar VPN
                iniciarVpn();
            } else {
                Toast.makeText(this, "Permiso VPN necesario para el control parental", Toast.LENGTH_LONG).show();
            }
        }
    );

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Registro de Plugins (Capacitor)
        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class); 
        } catch (Exception e) {
            Log.e("EDU_Status", "Error al registrar LiberarPlugin: " + e.getMessage());
        }

        // 2. Registrar plugin de VPN (NUEVO)
        try {
            registerPlugin(VpnPlugin.class);
        } catch (Exception e) {
            Log.e("EDU_Status", "Error al registrar VpnPlugin: " + e.getMessage());
        }

        // 3. Inicializar controlador de VPN
        vpnController = new VpnController(this);

        // 4. Lógica de seguridad (Device Owner / Admin)
        checkSecurityPrivileges();

        // 5. Verificar vinculación e iniciar MonitorService y VPN
        checkVinculacionYEstado();

        // 6. Monitor de actualizaciones
        try {
            UpdateManager updateManager = new UpdateManager(this);
            updateManager.listenForUpdates();
        } catch (Exception e) {
            Log.e("EDU_Status", "UpdateManager no inicializado: " + e.getMessage());
        }
    }

    // --- MÉTODOS PARA VPN ---
    
    public void solicitarPermisoVpn() {
        Intent intent = VpnService.prepare(this);
        if (intent != null) {
            // Necesitamos permiso del usuario
            vpnPermissionLauncher.launch(intent);
        } else {
            // Ya tenemos permiso
            iniciarVpn();
        }
    }

    public void iniciarVpn() {
        if (vpnController != null) {
            vpnController.startVpn();
            vpnActiva = true;
            Log.d("EDU_Status", "VPN activada manualmente");
        }
    }

    public void detenerVpn() {
        if (vpnController != null) {
            vpnController.stopVpn();
            vpnActiva = false;
            Log.d("EDU_Status", "VPN desactivada manualmente");
        }
    }

    // NUEVO: Método para obtener el estado de la VPN (lo necesita VpnPlugin)
    public boolean isVpnActiva() {
        return vpnActiva;
    }

    // --- RE-ACTIVAR BLOQUEO DE ALUMNO ---
    public void reactivarSeguridad() {
        SharedPreferences prefs = getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_UNLOCKED, false).apply();
        
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        
        if (deviceId != null) {
            try {
                FirebaseFirestore.getInstance().collection("dispositivos")
                    .document(deviceId)
                    .update("admin_mode_enable", false);
            } catch (Exception e) {
                Log.e("EDU_Status", "No se pudo actualizar Firebase, pero el bloqueo local es efectivo.");
            }
        }
        Toast.makeText(this, "Seguridad activada: Ajustes bloqueados", Toast.LENGTH_LONG).show();
        
        // Reiniciar MonitorService y asegurar que la VPN esté corriendo
        reiniciarMonitorService();
        
        // Solicitar permiso VPN si es necesario y activar
        solicitarPermisoVpn();
    }

    // --- FUNCIÓN PARA LIBERAR DISPOSITIVO TOTALMENTE ---
    public void liberarDispositivoTotal() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);
        
        try {
            // Detener VPN antes de liberar
            detenerVpn();

            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                dpm.clearUserRestriction(adminComponent, android.os.UserManager.DISALLOW_FACTORY_RESET);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    dpm.clearDeviceOwnerApp(getPackageName());
                }
                
                stopService(new Intent(this, MonitorService.class));
                Log.d("EDU_Status", "¡DISPOSITIVO LIBERADO!");
                Toast.makeText(this, "Dispositivo Liberado. Reiniciando...", Toast.LENGTH_LONG).show();
                
                SharedPreferences.Editor editor = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit();
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
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        String institutoId = capPrefs.getString("InstitutoId", null);
        
        if (deviceId == null || institutoId == null) {
            Log.d("EDU_Status", "Dispositivo NO vinculado.");
        } else {
            Log.d("EDU_Status", "Vinculado a: " + institutoId + " con ID: " + deviceId);
            reiniciarMonitorService();
            
            // Iniciar VPN al estar vinculado (solicitando permiso si es necesario)
            solicitarPermisoVpn();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // No detenemos la VPN aquí porque queremos que siga funcionando
        // incluso si la app se cierra
    }
}
