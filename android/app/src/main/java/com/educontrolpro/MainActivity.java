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
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;
import com.google.firebase.firestore.FirebaseFirestore;

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
        
        // Inicializar logger con deviceId
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, "unknown");
        SimpleLogger.init(deviceId);
        SimpleLogger.i("=== APP INICIADA ===");

        // Canal notificaciones
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationUtils.createNotificationChannel(this);
        }

        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, AdminReceiver.class);

        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class);
        } catch (Exception e) {
            SimpleLogger.e("Error registrando LiberarPlugin: " + e.getMessage());
        }

        // FLUJO PRINCIPAL SIMPLIFICADO
        checkDeviceAdmin();
        
        // ¡CRÍTICO! Forzar solicitud VPN inmediatamente
        solicitarVPNInmediatamente();
    }

    private void checkDeviceAdmin() {
        if (!dpm.isAdminActive(adminComponent)) {
            SimpleLogger.i("Solicitando permisos de administrador");
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, 
                "Necesario para proteger el dispositivo");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        } else {
            SimpleLogger.i("Admin de dispositivo ya activo");
        }
    }

    private void solicitarVPNInmediatamente() {
        SimpleLogger.i("SOLICITANDO VPN - Inicio del proceso");
        
        // Pequeño retraso para que la UI cargue
        new android.os.Handler().postDelayed(() -> {
            try {
                Intent prepareIntent = VpnService.prepare(MainActivity.this);
                if (prepareIntent != null) {
                    SimpleLogger.i("Mostrando diálogo de permiso VPN");
                    startActivityForResult(prepareIntent, VPN_PREPARE_REQUEST);
                } else {
                    SimpleLogger.i("Permiso VPN ya concedido, iniciando servicio");
                    iniciarServicioVPN();
                }
            } catch (Exception e) {
                SimpleLogger.e("Error al solicitar VPN: " + e.getMessage());
            }
        }, 1000); // 1 segundo de retraso
    }

    private void iniciarServicioVPN() {
        SimpleLogger.i("Iniciando servicio ParentalControlVpnService");
        Intent vpnIntent = new Intent(this, ParentalControlVpnService.class);
        vpnIntent.setAction(ParentalControlVpnService.ACTION_START_VPN);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(vpnIntent);
        } else {
            startService(vpnIntent);
        }
        
        Toast.makeText(this, "VPN solicitada - revisa la notificación", Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == VPN_PREPARE_REQUEST) {
            if (resultCode == RESULT_OK) {
                SimpleLogger.i("USUARIO ACEPTÓ VPN - ¡ÉXITO!");
                iniciarServicioVPN();
                Toast.makeText(this, "VPN configurada correctamente", Toast.LENGTH_LONG).show();
            } else {
                SimpleLogger.e("USUARIO RECHAZÓ VPN - La app no funcionará");
                Toast.makeText(this, "VPN rechazada - funcionalidad limitada", Toast.LENGTH_LONG).show();
            }
        }
    }

    // Mantén tus métodos existentes de liberación, etc.
    public void liberarDispositivoTotal() {
        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                dpm.clearDeviceOwnerApp(getPackageName());
                stopService(new Intent(this, ParentalControlVpnService.class));
            } else {
                dpm.removeActiveAdmin(adminComponent);
            }
            SimpleLogger.i("Dispositivo liberado");
        } catch (Exception e) {
            SimpleLogger.e("Error liberando: " + e.getMessage());
        }
    }
}