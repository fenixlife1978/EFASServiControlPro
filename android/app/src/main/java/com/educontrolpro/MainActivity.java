package com.educontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;
import com.google.firebase.firestore.FirebaseFirestore;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final int VPN_PREPARE_REQUEST = 102;
    private static final String TAG = "EDU_Status";
    
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";

    private DevicePolicyManager dpm;
    private ComponentName adminComponent;
    private boolean isRequestingBatteryOptimization = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, AdminReceiver.class);

        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class); 
        } catch (Exception e) {
            Log.e(TAG, "Error al registrar LiberarPlugin: " + e.getMessage());
        }

        checkSecurityPrivileges();
        ejecutarFlujoConfiguracion();

        try {
            UpdateManager updateManager = new UpdateManager(this);
            updateManager.listenForUpdates();
        } catch (Exception e) {
            Log.e(TAG, "UpdateManager no inicializado.");
        }
    }

    @Override
    public void onResume() {   // Ahora es public para sobrescribir correctamente
        super.onResume();
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        if (deviceId != null && !isRequestingBatteryOptimization) {
            verificarYActivarTodo();
        }
        isRequestingBatteryOptimization = false;
    }

    private void ejecutarFlujoConfiguracion() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);

        if (deviceId != null) {
            verificarYActivarTodo();
        } else {
            Log.d(TAG, "Esperando vinculación inicial vía QR...");
        }
    }

    public void verificarYActivarTodo() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                isRequestingBatteryOptimization = true;
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
                return;
            }
        }

        if (!isAccessibilityServiceEnabled()) {
            Toast.makeText(this, "EDUControl: Active el Servicio de Monitoreo en Accesibilidad", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            return;
        }

        requestVpnPermissionAndConfigure();
        disablePreinstalledVpnApps();
    }

    private boolean isAccessibilityServiceEnabled() {
        String pref = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return pref != null && pref.contains(getPackageName());
    }

    private void checkSecurityPrivileges() {
        if (dpm.isDeviceOwnerApp(getPackageName())) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    dpm.setOrganizationName(adminComponent, "EDUControlPro - Gestión Institucional");
                }
                dpm.setUninstallBlocked(adminComponent, getPackageName(), true);
                Log.d(TAG, "Modo DEVICE OWNER y Organización configurados.");
            } catch (Exception e) {
                Log.e(TAG, "Error configurando privilegios: " + e.getMessage());
            }
        } else if (!dpm.isAdminActive(adminComponent)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección obligatoria para EDUControlPro.");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }

    private void requestVpnPermissionAndConfigure() {
        Intent prepareIntent = VpnService.prepare(this);
        if (prepareIntent != null) {
            startActivityForResult(prepareIntent, VPN_PREPARE_REQUEST);
        } else {
            iniciarServicioVPN();
        }
    }

    private void iniciarServicioVPN() {
        Intent vpnIntent = new Intent(this, EduVpnService.class);
        vpnIntent.setAction(EduVpnService.ACTION_START_VPN);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(vpnIntent);
        } else {
            startService(vpnIntent);
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && dpm.isAdminActive(adminComponent)) {
            try {
                dpm.setAlwaysOnVpnPackage(adminComponent, getPackageName(), true);
                Log.d(TAG, "Always-On VPN activado.");
            } catch (Exception e) {
                Log.e(TAG, "Error Always-On: " + e.getMessage());
            }
        }
    }

    public void reactivarSeguridad() {
        getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, false).apply();
        actualizarEstadoFirebase(false);
        Toast.makeText(this, "Seguridad activada", Toast.LENGTH_SHORT).show();
        
        stopService(new Intent(this, MonitorService.class));
        startService(new Intent(this, MonitorService.class));
    }

    public void liberarDispositivoTotal() {
        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                dpm.clearUserRestriction(adminComponent, android.os.UserManager.DISALLOW_FACTORY_RESET);
                dpm.clearDeviceOwnerApp(getPackageName());
                
                stopService(new Intent(this, MonitorService.class));
                stopService(new Intent(this, EduVpnService.class));

                getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit().clear().apply();
                finishAffinity();
            } else {
                dpm.removeActiveAdmin(adminComponent);
            }
            Toast.makeText(this, "¡DISPOSITIVO LIBERADO!", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Log.e(TAG, "Error al liberar: " + e.getMessage());
        }
    }

    private void actualizarEstadoFirebase(boolean enabled) {
        String deviceId = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).getString(KEY_DEVICE_ID, null);
        if (deviceId != null) {
            FirebaseFirestore.getInstance().collection("dispositivos").document(deviceId)
                    .update("admin_mode_enable", enabled);
        }
    }

    private void disablePreinstalledVpnApps() {
        if (!dpm.isAdminActive(adminComponent)) return;
        String[] vpnPackages = {"com.secure.vpn", "com.hotspotshield.android", "com.tunnelbear.android", "com.nordvpn.android"};
        for (String pkg : vpnPackages) {
            try { dpm.setApplicationHidden(adminComponent, pkg, true); } catch (Exception e) {}
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_PREPARE_REQUEST && resultCode == RESULT_OK) {
            iniciarServicioVPN();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null) {
            if ("ACTION_LIBERAR_TAB".equals(intent.getAction())) liberarDispositivoTotal();
            else if ("ACTION_REBLOQUEAR_TAB".equals(intent.getAction())) reactivarSeguridad();
        }
    }
}