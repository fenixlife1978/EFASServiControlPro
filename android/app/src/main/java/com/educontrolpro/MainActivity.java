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
        
        // 1. Registrar Plugins
        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class);
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Error registrando LiberarPlugin", e);
        }

        // 2. Inicializar componentes
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, "unknown");
        SimpleLogger.init(deviceId);
        
        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, AdminReceiver.class);

        // 3. Procesar Intent inicial (si se lanza desde una notificación o comando)
        handleIntent(getIntent());

        // 4. Flujo de inicio
        verificarConexionFirestore();
        checkDeviceAdmin();
        solicitarVPNInmediatamente();
    }

    // RECEPTOR DE INTENTS (Para LiberarPlugin)
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            SimpleLogger.i("Intent recibido en MainActivity: " + action);

            if (action.equals("ACTION_LIBERAR_TAB")) {
                liberarDispositivoTotal();
            } else if (action.equals("ACTION_REBLOQUEAR_TAB")) {
                // Aquí podrías forzar el re-bloqueo si es necesario
                checkDeviceAdmin();
                solicitarVPNInmediatamente();
                SimpleLogger.i("Comando de rebloqueo ejecutado");
            }
        }
    }

    private void verificarConexionFirestore() {
        try {
            FirebaseFirestore db = FirebaseFirestore.getInstance();
            Map<String, Object> testData = new HashMap<>();
            testData.put("timestamp", System.currentTimeMillis());
            testData.put("message", "Conexión desde MainActivity");

            db.collection("app_logs").document("test_connection")
                .set(testData)
                .addOnSuccessListener(aVoid -> SimpleLogger.i("Firestore OK"))
                .addOnFailureListener(e -> SimpleLogger.e("Firestore Error: " + e.getMessage()));
        } catch (Exception e) {
            SimpleLogger.e("Error Firestore: " + e.getMessage());
        }
    }

    private void checkDeviceAdmin() {
        if (!dpm.isAdminActive(adminComponent)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección de EDUControlPro");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }

    private void solicitarVPNInmediatamente() {
        new Handler().postDelayed(() -> {
            try {
                Intent prepareIntent = VpnService.prepare(MainActivity.this);
                if (prepareIntent != null) {
                    startActivityForResult(prepareIntent, VPN_PREPARE_REQUEST);
                } else {
                    iniciarServicioVPN();
                }
            } catch (Exception e) {
                SimpleLogger.e("Error VPN: " + e.getMessage());
            }
        }, 1500);
    }

    private void iniciarServicioVPN() {
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
        if (requestCode == DEVICE_ADMIN_REQUEST && resultCode == RESULT_OK) {
            SimpleLogger.i("Admin concedido");
        }
        if (requestCode == VPN_PREPARE_REQUEST && resultCode == RESULT_OK) {
            iniciarServicioVPN();
        }
    }

    public void liberarDispositivoTotal() {
        try {
            // Detener VPN primero
            stopService(new Intent(this, ParentalControlVpnService.class));

            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                dpm.clearDeviceOwnerApp(getPackageName());
            }
            dpm.removeActiveAdmin(adminComponent);
            
            SimpleLogger.i("Dispositivo liberado exitosamente");
            Toast.makeText(this, "Dispositivo Liberado", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            SimpleLogger.e("Error liberando: " + e.getMessage());
        }
    }
}