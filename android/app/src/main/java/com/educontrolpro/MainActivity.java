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
import com.google.firebase.firestore.FirebaseFirestore;

import java.util.HashMap;
import java.util.Map;

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
        
        // 1. Registro de Plugins
        registerPlugin(DevicePlugin.class);
        try { registerPlugin(LiberarPlugin.class); } catch (Exception e) {}

        // 2. Inicialización de componentes
        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, AdminReceiver.class);

        // 3. Obtener ID y Logger (Paso previo a la red)
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, "DEV-0001");
        SimpleLogger.init(deviceId);

        // 4. INICIO DEL FLUJO EN ORDEN: Primero Admin, luego el resto
        new Handler().postDelayed(this::checkDeviceAdmin, 1000);
        
        handleIntent(getIntent());
    }

    private void checkDeviceAdmin() {
        if (!dpm.isAdminActive(adminComponent)) {
            SimpleLogger.i("Paso 1: Solicitando Administrador de Dispositivo");
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección activa de EduControlPro");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        } else {
            SimpleLogger.i("Admin ya activo. Pasando a validar vinculación.");
            verificarConexionFirestore(); // Aquí es donde validas el dispositivo
            solicitarVPNInmediatamente();
        }
    }

    private void solicitarVPNInmediatamente() {
        SimpleLogger.i("Paso 2: Preparando Túnel VPN");
        Intent prepareIntent = VpnService.prepare(this);
        if (prepareIntent != null) {
            startActivityForResult(prepareIntent, VPN_PREPARE_REQUEST);
        } else {
            iniciarServicioVPN();
        }
    }

    private void iniciarServicioVPN() {
        SimpleLogger.i("Paso 3: Iniciando Servicio en Foreground");
        Intent vpnIntent = new Intent(this, ParentalControlVpnService.class);
        vpnIntent.setAction("START_VPN"); 
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(vpnIntent);
        } else {
            startService(vpnIntent);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        // Manejo secuencial: Si termina uno, dispara el otro
        if (requestCode == DEVICE_ADMIN_REQUEST) {
            if (resultCode == RESULT_OK) {
                SimpleLogger.i("Admin concedido. Ahora pidiendo VPN.");
                verificarConexionFirestore();
                solicitarVPNInmediatamente();
            } else {
                SimpleLogger.e("Admin necesario. Re-intentando...");
                checkDeviceAdmin();
            }
        }

        if (requestCode == VPN_PREPARE_REQUEST) {
            if (resultCode == RESULT_OK) {
                iniciarServicioVPN();
            } else {
                SimpleLogger.e("VPN necesaria para el filtrado. Re-intentando...");
                solicitarVPNInmediatamente();
            }
        }
    }

    private void verificarConexionFirestore() {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        Map<String, Object> log = new HashMap<>();
        log.put("timestamp", System.currentTimeMillis());
        log.put("message", "Dispositivo vinculado y verificado");
        db.collection("app_logs").document("test_connection").set(log);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && "ACTION_LIBERAR_TAB".equals(intent.getAction())) {
            liberarDispositivoTotal();
        }
    }

    public void liberarDispositivoTotal() {
        try {
            stopService(new Intent(this, ParentalControlVpnService.class));
            dpm.removeActiveAdmin(adminComponent);
            SimpleLogger.i("Dispositivo liberado");
        } catch (Exception e) {
            SimpleLogger.e("Error liberando: " + e.getMessage());
        }
    }
}