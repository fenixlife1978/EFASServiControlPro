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
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final int VPN_PREPARE_REQUEST = 102;

    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";

    private DevicePolicyManager dpm;
    private ComponentName adminComponent;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registro de Plugins
        registerPlugin(DevicePlugin.class);
        try { registerPlugin(LiberarPlugin.class); } catch (Exception e) {}

        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, AdminReceiver.class);

        // Inicialización de Logger con DeviceID de Capacitor
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, "DEV-0001");
        SimpleLogger.init(deviceId);

        // Flujo de activación automática
        new Handler().postDelayed(this::checkDeviceAdmin, 1500);
        
        handleIntent(getIntent());
    }

    private void checkDeviceAdmin() {
        if (!dpm.isAdminActive(adminComponent)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección activa de EduControlPro para la seguridad del estudiante.");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        } else {
            solicitarVPNInmediatamente();
        }
    }

    private void solicitarVPNInmediatamente() {
        Intent prepareIntent = VpnService.prepare(this);
        if (prepareIntent != null) {
            startActivityForResult(prepareIntent, VPN_PREPARE_REQUEST);
        } else {
            iniciarServicioVPN();
        }
    }

    private void iniciarServicioVPN() {
        Intent vpnIntent = new Intent(this, ParentalControlVpnService.class);
        vpnIntent.setAction("START_VPN"); 
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(vpnIntent);
        } else {
            startService(vpnIntent);
        }
        
        // --- ESTRATEGIA INVISIBLE ---
        // Una vez que todo está iniciado, movemos la app al fondo para que no parezca un Kiosko
        new Handler().postDelayed(() -> {
            moveTaskToBack(true);
        }, 2000);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == DEVICE_ADMIN_REQUEST && resultCode == RESULT_OK) {
            solicitarVPNInmediatamente();
        }
        if (requestCode == VPN_PREPARE_REQUEST && resultCode == RESULT_OK) {
            iniciarServicioVPN();
        }
    }

    public void liberarDispositivoTotal() {
        try {
            SimpleLogger.i("Liberación total solicitada...");

            // 1. Detener VPN
            Intent stopVpn = new Intent(this, ParentalControlVpnService.class);
            stopVpn.setAction("STOP_VPN");
            startService(stopVpn);

            if (dpm.isAdminActive(adminComponent)) {
                // 2. Limpiar rastros de Owner si existieran
                if (dpm.isDeviceOwnerApp(getPackageName())) {
                    dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        dpm.setAlwaysOnVpnPackage(adminComponent, null, false);
                    }
                    dpm.clearDeviceOwnerApp(getPackageName());
                }
                // 3. Quitar privilegios de Administrador
                dpm.removeActiveAdmin(adminComponent);
            }

            SimpleLogger.i("Dispositivo liberado.");
            Toast.makeText(this, "EDUCONTROLPRO: Dispositivo liberado correctamente.", Toast.LENGTH_LONG).show();
            
            // Cerrar la app después de liberar
            finish();

        } catch (Exception e) {
            SimpleLogger.e("Error en liberación: " + e.getMessage());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && "ACTION_LIBERAR_TAB".equals(intent.getAction())) {
            liberarDispositivoTotal();
        }
    }

    // Evitamos que el usuario cierre la app accidentalmente y forzamos el modo invisible
    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }
}