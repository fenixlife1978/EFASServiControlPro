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

import androidx.core.app.NotificationManagerCompat;

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
    private FirebaseFirestore db;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        db = FirebaseFirestore.getInstance();
        logToFirestore("onCreate", "Actividad iniciada");

        // Crear canal de notificaciones para Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationUtils.createNotificationChannel(this);
            logToFirestore("onCreate", "Canal de notificaciones creado");
        }

        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, AdminReceiver.class);

        // Registro de Plugins
        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class);
            logToFirestore("onCreate", "LiberarPlugin registrado");
        } catch (Exception e) {
            logToFirestore("onCreate", "Error al registrar LiberarPlugin: " + e.getMessage());
        }

        // --- FLUJO DE PROTECCIÓN V10.3 ---
        checkSecurityPrivileges();
        ejecutarFlujoConfiguracion();

        try {
            UpdateManager updateManager = new UpdateManager(this);
            updateManager.listenForUpdates();
            logToFirestore("onCreate", "UpdateManager iniciado");
        } catch (Exception e) {
            logToFirestore("onCreate", "UpdateManager no inicializado: " + e.getMessage());
        }
    }

    private void logToFirestore(String metodo, String mensaje) {
        Map<String, Object> logEntry = new HashMap<>();
        logEntry.put("timestamp", System.currentTimeMillis());
        logEntry.put("metodo", metodo);
        logEntry.put("mensaje", mensaje);
        logEntry.put("dispositivo", Build.MODEL);
        logEntry.put("androidVersion", Build.VERSION.SDK_INT);

        db.collection("logs")
                .add(logEntry)
                .addOnFailureListener(e -> {
                    // Si falla, no podemos hacer mucho, pero al menos lo imprimimos en consola (si es que hay)
                    android.util.Log.e(TAG, "Error guardando log en Firestore: " + e.getMessage());
                });
    }

    private void ejecutarFlujoConfiguracion() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);

        if (deviceId != null) {
            logToFirestore("ejecutarFlujoConfiguracion", "Device ID encontrado: " + deviceId);
        } else {
            logToFirestore("ejecutarFlujoConfiguracion", "No hay deviceId, forzando verificación de todos modos para pruebas");
        }
        verificarYActivarTodo(); // Siempre se ejecuta para pruebas
    }

    public void verificarYActivarTodo() {
        logToFirestore("verificarYActivarTodo", "Ejecutándose");

        // A. Optimización de Batería (comentado para pruebas)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                logToFirestore("verificarYActivarTodo", "Solicitando optimización de batería");
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
                // No hacemos return para continuar con la VPN (en pruebas)
            }
        }

        // B. Accesibilidad (comentado para pruebas)
        // if (!isAccessibilityServiceEnabled()) {
        //     Toast.makeText(this, "EDUControl: Active el Servicio de Monitoreo", Toast.LENGTH_LONG).show();
        //     startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        //     return;
        // }

        // C. VPN - parte clave
        requestVpnPermissionAndConfigure();

        // D. Limpiar Apps de terceros
        disablePreinstalledVpnApps();
    }

    private boolean isAccessibilityServiceEnabled() {
        String pref = Settings.Secure.getString(
                getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        return pref != null && pref.contains(getPackageName());
    }

    private void checkSecurityPrivileges() {
        if (dpm.isDeviceOwnerApp(getPackageName())) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    dpm.setOrganizationName(adminComponent, "EDUControlPro - Gestión Institucional");
                }
                dpm.setUninstallBlocked(adminComponent, getPackageName(), true);
                logToFirestore("checkSecurityPrivileges", "Modo DEVICE OWNER y Organización configurados.");
            } catch (Exception e) {
                logToFirestore("checkSecurityPrivileges", "Error configurando privilegios: " + e.getMessage());
            }
        } else if (!dpm.isAdminActive(adminComponent)) {
            logToFirestore("checkSecurityPrivileges", "Solicitando administrador de dispositivo");
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Protección obligatoria para EDUControlPro."
            );
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }

    private void requestVpnPermissionAndConfigure() {
        logToFirestore("requestVpnPermissionAndConfigure", "Llamado");
        Intent prepareIntent = VpnService.prepare(this);
        if (prepareIntent != null) {
            logToFirestore("requestVpnPermissionAndConfigure", "Se necesita permiso VPN. Lanzando diálogo...");
            startActivityForResult(prepareIntent, VPN_PREPARE_REQUEST);
        } else {
            logToFirestore("requestVpnPermissionAndConfigure", "Permiso VPN ya concedido. Iniciando servicio directamente.");
            iniciarServicioVPN();
        }
    }

    private void iniciarServicioVPN() {
        logToFirestore("iniciarServicioVPN", "Llamado");
        Intent vpnIntent = new Intent(this, ParentalControlVpnService.class);
        vpnIntent.setAction(ParentalControlVpnService.ACTION_START_VPN);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(vpnIntent);
            logToFirestore("iniciarServicioVPN", "startForegroundService llamado");
        } else {
            startService(vpnIntent);
            logToFirestore("iniciarServicioVPN", "startService llamado");
        }

        // Always-On VPN (opcional)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && dpm.isAdminActive(adminComponent)) {
            try {
                dpm.setAlwaysOnVpnPackage(adminComponent, getPackageName(), true);
                logToFirestore("iniciarServicioVPN", "Always-On VPN activado.");
            } catch (Exception e) {
                logToFirestore("iniciarServicioVPN", "Error Always-On: " + e.getMessage());
            }
        }
    }

    // --- MÉTODOS DE CONTROL ---
    public void reactivarSeguridad() {
        getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_UNLOCKED, false)
                .apply();
        actualizarEstadoFirebase(false);
        Toast.makeText(this, "Seguridad activada", Toast.LENGTH_SHORT).show();

        stopService(new Intent(this, MonitorService.class));
        startService(new Intent(this, MonitorService.class));
        logToFirestore("reactivarSeguridad", "Seguridad reactivada");
    }

    public void liberarDispositivoTotal() {
        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                dpm.clearUserRestriction(adminComponent, android.os.UserManager.DISALLOW_FACTORY_RESET);
                dpm.clearDeviceOwnerApp(getPackageName());

                stopService(new Intent(this, MonitorService.class));
                stopService(new Intent(this, ParentalControlVpnService.class));

                getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit().clear().apply();
                finishAffinity();
            } else {
                dpm.removeActiveAdmin(adminComponent);
            }
            Toast.makeText(this, "¡DISPOSITIVO LIBERADO!", Toast.LENGTH_LONG).show();
            logToFirestore("liberarDispositivoTotal", "Dispositivo liberado");
        } catch (Exception e) {
            logToFirestore("liberarDispositivoTotal", "Error al liberar: " + e.getMessage());
        }
    }

    private void actualizarEstadoFirebase(boolean enabled) {
        String deviceId = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE)
                .getString(KEY_DEVICE_ID, null);
        if (deviceId != null) {
            FirebaseFirestore.getInstance()
                    .collection("dispositivos")
                    .document(deviceId)
                    .update("admin_mode_enable", enabled)
                    .addOnSuccessListener(aVoid -> logToFirestore("actualizarEstadoFirebase", "Estado actualizado a " + enabled))
                    .addOnFailureListener(e -> logToFirestore("actualizarEstadoFirebase", "Error: " + e.getMessage()));
        }
    }

    private void disablePreinstalledVpnApps() {
        if (!dpm.isAdminActive(adminComponent)) return;
        String[] vpnPackages = {
                "com.secure.vpn",
                "com.hotspotshield.android",
                "com.tunnelbear.android",
                "com.nordvpn.android"
        };
        for (String pkg : vpnPackages) {
            try {
                dpm.setApplicationHidden(adminComponent, pkg, true);
                logToFirestore("disablePreinstalledVpnApps", "App oculta: " + pkg);
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_PREPARE_REQUEST) {
            if (resultCode == RESULT_OK) {
                logToFirestore("onActivityResult", "Permiso VPN concedido");
                iniciarServicioVPN();
            } else {
                logToFirestore("onActivityResult", "Permiso VPN denegado");
                Toast.makeText(this, "Permiso de VPN denegado. La protección no funcionará.", Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == DEVICE_ADMIN_REQUEST) {
            if (resultCode == RESULT_OK) {
                logToFirestore("onActivityResult", "Admin de dispositivo concedido");
            } else {
                logToFirestore("onActivityResult", "Admin de dispositivo denegado");
            }
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
}