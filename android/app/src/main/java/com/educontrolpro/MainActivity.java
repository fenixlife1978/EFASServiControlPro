package com.educontrolpro;

import android.Manifest;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;

// IMPORTACIONES PARA PERMISOS Y VPN
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

// HÍBRIDO: Realtime DB + Firestore
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

// IMPORTACIONES FALTANTES
import java.util.Map;
import java.util.HashMap;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final int VPN_REQUEST_CODE = 102; // NUEVO: código para VPN
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String TAG = "MainActivity";
    
    // HÍBRIDO: Realtime DB para operaciones frecuentes
    private FirebaseDatabase realtimeDb;
    private DatabaseReference deviceRealtimeRef;
    private DatabaseReference logsRef; // NUEVO: referencia para logs
    
    // Firestore para respaldo (opcional)
    private FirebaseFirestore firestore;
    
    // Controlador de VPN
    private VpnController vpnController;
    
    // Variables para el estado de la VPN
    private boolean vpnActiva = false;

    // ActivityResultLauncher para pedir permiso VPN (versión moderna)
    private final ActivityResultLauncher<Intent> vpnPermissionLauncher = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(),
        result -> {
            if (result.getResultCode() == RESULT_OK) {
                logToRealtime("VPN_PERMISO", "Permiso concedido por usuario");
                iniciarVpn();
            } else {
                logToRealtime("VPN_PERMISO", "Permiso denegado por usuario");
                Toast.makeText(this, "Permiso VPN necesario para el control parental", Toast.LENGTH_LONG).show();
            }
        }
    );

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Inicializar Firebase HÍBRIDO
        realtimeDb = FirebaseDatabase.getInstance();
        firestore = FirebaseFirestore.getInstance();
        
        // Obtener deviceId para logs
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        if (deviceId != null) {
            logsRef = realtimeDb.getReference("dispositivos").child(deviceId).child("app_logs");
        }
        
        logToRealtime("APP_START", "MainActivity iniciada");
        
        // 1. Registro de Plugins (Capacitor)
        registerPlugin(DevicePlugin.class);
        try {
            registerPlugin(LiberarPlugin.class); 
        } catch (Exception e) {
            Log.e(TAG, "Error al registrar LiberarPlugin: " + e.getMessage());
        }

        // 2. Registrar plugin de VPN
        try {
            registerPlugin(VpnPlugin.class);
        } catch (Exception e) {
            Log.e(TAG, "Error al registrar VpnPlugin: " + e.getMessage());
        }

        // 3. Inicializar controlador de VPN
        vpnController = new VpnController(this);

        // 4. Solicitar permisos necesarios
        solicitarPermisosNecesarios();

        // 5. Lógica de seguridad
        checkSecurityPrivileges();

        // 6. Verificar vinculación
        checkVinculacionYEstado();

        // 7. Obtener referencia Realtime DB si está vinculado
        if (deviceId != null) {
            deviceRealtimeRef = realtimeDb.getReference("dispositivos").child(deviceId);
        }

        // 8. Monitor de actualizaciones
        try {
            UpdateManager updateManager = new UpdateManager(this);
            updateManager.listenForUpdates();
        } catch (Exception e) {
            Log.e(TAG, "UpdateManager no inicializado: " + e.getMessage());
        }
    }

    // NUEVO: Método para logs a Realtime Database
    private void logToRealtime(String tipo, String mensaje) {
        try {
            SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);
            
            if (deviceId != null) {
                DatabaseReference logRef = realtimeDb
                    .getReference("dispositivos")
                    .child(deviceId)
                    .child("vpn_logs")
                    .child(String.valueOf(System.currentTimeMillis()));
                
                Map<String, Object> logEntry = new HashMap<>();
                logEntry.put("tipo", tipo);
                logEntry.put("mensaje", mensaje);
                logEntry.put("timestamp", System.currentTimeMillis());
                logEntry.put("origen", "MainActivity");
                
                logRef.setValue(logEntry);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en logToRealtime: " + e.getMessage());
        }
    }

    private void solicitarPermisosNecesarios() {
        String[] permisos;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permisos = new String[]{
                Manifest.permission.CAMERA,
                Manifest.permission.POST_NOTIFICATIONS
            };
        } else {
            permisos = new String[]{
                Manifest.permission.CAMERA
            };
        }
        
        // 1. Solicitar permisos de cámara
        boolean necesitaSolicitud = false;
        for (String permiso : permisos) {
            if (ContextCompat.checkSelfPermission(this, permiso) != PackageManager.PERMISSION_GRANTED) {
                necesitaSolicitud = true;
                break;
            }
        }
        
        if (necesitaSolicitud) {
            ActivityCompat.requestPermissions(this, permisos, 1001);
        }
        
        // 2. Solicitar permiso VPN (si no está concedido)
        checkAndRequestVpnPermission();
    }

    // NUEVO: Verificar y solicitar permiso VPN
    private void checkAndRequestVpnPermission() {
        Intent vpnIntent = VpnService.prepare(this);
        if (vpnIntent != null) {
            logToRealtime("VPN_CHECK", "Permiso VPN no concedido, solicitando...");
            // Usar el método moderno con ActivityResultLauncher
            vpnPermissionLauncher.launch(vpnIntent);
        } else {
            logToRealtime("VPN_CHECK", "Permiso VPN ya concedido");
            // El permiso ya está concedido, podemos iniciar VPN si es necesario
            if (vpnController != null && vpnActiva) {
                iniciarVpn();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == 1001) {
            for (int i = 0; i < permissions.length; i++) {
                if (grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "Permiso concedido: " + permissions[i]);
                    logToRealtime("PERMISO_CONCEDIDO", permissions[i]);
                } else {
                    Log.d(TAG, "Permiso denegado: " + permissions[i]);
                    logToRealtime("PERMISO_DENEGADO", permissions[i]);
                    if (permissions[i].equals(Manifest.permission.CAMERA)) {
                        Toast.makeText(this, "Se necesita permiso de cámara", Toast.LENGTH_LONG).show();
                    }
                }
            }
        }
    }

    // --- MÉTODOS PARA VPN ---
    
    public void solicitarPermisoVpn() {
        Intent intent = VpnService.prepare(this);
        if (intent != null) {
            vpnPermissionLauncher.launch(intent);
        } else {
            iniciarVpn();
        }
    }

    public void iniciarVpn() {
        if (vpnController != null) {
            vpnController.startVpn();
            vpnActiva = true;
            Log.d(TAG, "VPN activada");
            logToRealtime("VPN_START", "Servicio VPN iniciado");
        }
    }

    public void detenerVpn() {
        if (vpnController != null) {
            vpnController.stopVpn();
            vpnActiva = false;
            Log.d(TAG, "VPN desactivada");
            logToRealtime("VPN_STOP", "Servicio VPN detenido");
        }
    }

    public boolean isVpnActiva() {
        return vpnActiva;
    }

    // --- RE-ACTIVAR BLOQUEO ---
    public void reactivarSeguridad() {
        SharedPreferences prefs = getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_UNLOCKED, false).apply();
        
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        
        if (deviceId != null) {
            if (deviceRealtimeRef != null) {
                deviceRealtimeRef.child("admin_mode_enable").setValue(false)
                    .addOnFailureListener(e -> Log.e(TAG, "Error Realtime DB: " + e.getMessage()));
            }
            
            Map<String, Object> backup = new HashMap<>();
            backup.put("tipo", "REBLOQUEO");
            backup.put("timestamp", FieldValue.serverTimestamp());
            firestore.collection("eventos_seguridad").add(backup);
        }
        
        Toast.makeText(this, "Seguridad activada", Toast.LENGTH_LONG).show();
        reiniciarMonitorService();
        
        // Verificar permiso VPN al reactivar
        checkAndRequestVpnPermission();
    }

    // --- LIBERAR DISPOSITIVO ---
    public void liberarDispositivoTotal() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);
        
        try {
            detenerVpn();

            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), false);
                dpm.clearUserRestriction(adminComponent, android.os.UserManager.DISALLOW_FACTORY_RESET);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    dpm.clearDeviceOwnerApp(getPackageName());
                }
                
                stopService(new Intent(this, MonitorService.class));
                Log.d(TAG, "DISPOSITIVO LIBERADO");
                logToRealtime("LIBERACION", "Dispositivo liberado completamente");
                Toast.makeText(this, "Dispositivo Liberado", Toast.LENGTH_LONG).show();
                
                SharedPreferences.Editor editor = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit();
                editor.clear();
                editor.apply();
                
                if (deviceRealtimeRef != null) {
                    deviceRealtimeRef.child("liberado").setValue(true);
                    deviceRealtimeRef.child("fecha_liberacion").setValue(System.currentTimeMillis());
                }
                
                finishAffinity();
            } else {
                dpm.removeActiveAdmin(adminComponent);
                Toast.makeText(this, "Admin eliminado", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error al liberar: " + e.getMessage());
            logToRealtime("LIBERACION_ERROR", e.getMessage());
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
                Log.d(TAG, "Modo DEVICE OWNER activo");
            } catch (Exception e) {
                Log.e(TAG, "Error en Device Owner: " + e.getMessage());
            }
        } else if (!dpm.isAdminActive(adminComponent)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección obligatoria");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }

    private void checkVinculacionYEstado() {
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        String institutoId = capPrefs.getString("InstitutoId", null);
        
        if (deviceId == null || institutoId == null) {
            Log.d(TAG, "Dispositivo NO vinculado");
        } else {
            Log.d(TAG, "Vinculado a: " + institutoId + " - " + deviceId);
            
            // Inicializar referencia Realtime
            deviceRealtimeRef = realtimeDb.getReference("dispositivos").child(deviceId);
            
            reiniciarMonitorService();
            
            // Verificar permiso VPN al iniciar si está vinculado
            checkAndRequestVpnPermission();
        }
    }

    @Override
    public void onDestroy() {
        logToRealtime("APP_DESTROY", "MainActivity destruida");
        super.onDestroy();
    
    }
}