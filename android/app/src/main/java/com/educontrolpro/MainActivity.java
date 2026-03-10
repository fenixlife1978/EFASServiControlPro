package com.educontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;
import com.google.firebase.firestore.FirebaseFirestore;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final int VPN_PREPARE_REQUEST = 102;
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registro de Plugins
        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class); 
        } catch (Exception e) {
            Log.e("EDU_Status", "Error al registrar LiberarPlugin: " + e.getMessage());
        }

        // Lógica de seguridad
        checkSecurityPrivileges();

        // Verificar vinculación e iniciar servicios
        checkVinculacionYEstado();

        // Monitor de actualizaciones
        try {
            UpdateManager updateManager = new UpdateManager(this);
            updateManager.listenForUpdates();
        } catch (Exception e) {
            Log.e("EDU_Status", "UpdateManager no inicializado: " + e.getMessage());
        }

        // --- BOTÓN DE PRUEBA (puedes eliminarlo después) ---
        runOnUiThread(() -> {
            Button btn = new Button(this);
            btn.setText("SOLICITAR PERMISO VPN");
            btn.setOnClickListener(v -> requestVpnPermissionAndConfigure());
            addContentView(btn, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        });
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
        
        reiniciarMonitorService();
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
            
            disablePreinstalledVpnApps();

            // Iniciar MonitorService
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

            // Iniciar EduVpnService
            try {
                Intent vpnIntent = new Intent(this, EduVpnService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(vpnIntent);
                } else {
                    startService(vpnIntent);
                }
                Log.d("EDU_Status", "EduVpnService iniciado");
            } catch (Exception e) {
                Log.e("EDU_Status", "Error al iniciar EduVpnService: " + e.getMessage());
            }

            // Esperar un poco antes de solicitar permiso VPN (para dar tiempo a que la UI se estabilice)
            new Handler().postDelayed(this::requestVpnPermissionAndConfigure, 2000);
        }
    }

    /**
     * Solicita permiso de VPN al usuario y luego configura como siempre activa.
     */
    private void requestVpnPermissionAndConfigure() {
        Log.d("EDU_Status", "Preparando solicitud de permiso VPN...");
        Intent prepareIntent = VpnService.prepare(this);
        if (prepareIntent != null) {
            // El usuario aún no ha concedido permiso
            Log.d("EDU_Status", "Lanzando diálogo de permiso VPN");
            prepareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivityForResult(prepareIntent, VPN_PREPARE_REQUEST);
        } else {
            // Ya tiene permiso, proceder a configurar como siempre activa
            Log.d("EDU_Status", "Permiso VPN ya concedido, configurando siempre activa");
            configureVpnAlwaysOn();
        }
    }

    /**
     * Configura la VPN como siempre activa.
     */
    private void configureVpnAlwaysOn() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        if (!dpm.isAdminActive(adminComponent)) {
            Log.e("EDU_Status", "Admin no activo, no se puede configurar VPN siempre activa");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.setAlwaysOnVpnPackage(adminComponent, getPackageName(), true);
                Log.d("EDU_Status", "VPN configurada como siempre activa (API 24+)");
            } else {
                dpm.setAlwaysOnVpnPackage(adminComponent, getPackageName(), true);
                Log.d("EDU_Status", "VPN configurada como siempre activa (API 21-23)");
            }
        } catch (SecurityException e) {
            Log.e("EDU_Status", "Sin permisos para configurar VPN siempre activa", e);
        } catch (Exception e) {
            Log.e("EDU_Status", "Error configurando VPN siempre activa", e);
        }
    }

    /**
     * Deshabilita aplicaciones VPN preinstaladas.
     */
    private void disablePreinstalledVpnApps() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);

        if (!dpm.isAdminActive(adminComponent)) {
            Log.e("EDU_Status", "No se pueden ocultar apps: Admin no activo");
            return;
        }

        String[] vpnPackages = {
            "com.secure.vpn",
            "com.hotspotshield.android",
            "com.tunnelbear.android",
            "org.getlantern.lantern",
            "com.windscribe.vpn",
            "com.expressvpn.vpn",
            "com.nordvpn.android",
        };

        for (String pkg : vpnPackages) {
            try {
                boolean hidden = dpm.setApplicationHidden(adminComponent, pkg, true);
                if (hidden) {
                    Log.d("EDU_Status", "VPN oculta/deshabilitada: " + pkg);
                } else {
                    Log.d("EDU_Status", "No se pudo ocultar " + pkg);
                }
            } catch (Exception e) {
                // Ignorar
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_PREPARE_REQUEST) {
            if (resultCode == RESULT_OK) {
                Log.d("EDU_Status", "Permiso de VPN concedido por el usuario");
                configureVpnAlwaysOn();
                // Forzar el reinicio del servicio VPN para que intente iniciar
                Intent vpnIntent = new Intent(this, EduVpnService.class);
                vpnIntent.setAction("START_VPN");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(vpnIntent);
                } else {
                    startService(vpnIntent);
                }
                Toast.makeText(this, "Reiniciando servicio VPN...", Toast.LENGTH_SHORT).show();
            } else {
                Log.e("EDU_Status", "Permiso de VPN denegado por el usuario");
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }
}