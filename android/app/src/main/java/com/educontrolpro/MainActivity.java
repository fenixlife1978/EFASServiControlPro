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
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;
import com.educontrolpro.services.LocalVpnService;
import com.educontrolpro.services.MonitorService;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.firestore.FirebaseFirestore;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity implements LocalVpnService.VpnCallback {
    
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final int VPN_REQUEST_CODE = 102;
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String TAG = "MainActivity";
    
    private FirebaseDatabase realtimeDb;
    private DatabaseReference deviceRealtimeRef;
    private FirebaseFirestore firestore;
    private WebView webView;
    private boolean vpnPermissionGranted = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Inicializar Firebase
        realtimeDb = FirebaseDatabase.getInstance();
        firestore = FirebaseFirestore.getInstance();
        
        // Registrar Plugins de Capacitor
        registerPlugin(DevicePlugin.class);
        
        // Configurar WebView Bridge para comunicación con VPN
        setupWebViewBridge();
        
        // Configurar callback de VPN
        LocalVpnService.setCallback(this);
        
        // Solicitar permisos y privilegios
        solicitarPermisosBasicos();
        checkSecurityPrivileges();
        iniciarEscudoVpn();
        checkVinculacionYEstado();
        
        logToRealtime("APP_START", "MainActivity iniciada correctamente");
    }
    
    /**
     * Configura el WebView y el bridge para comunicación con la Web App
     */
    private void setupWebViewBridge() {
        // Buscar el WebView dentro de la actividad de Capacitor
        // Capacitor maneja su propia vista, necesitamos inyectar el bridge
        // Si usas una WebView propia, configúrala aquí
        
        // Ejemplo: si tienes un WebView en tu layout
        // webView = findViewById(R.id.webview);
        // if (webView != null) {
        //     webView.getSettings().setJavaScriptEnabled(true);
        //     webView.addJavascriptInterface(new WebAppInterface(), "EduControl");
        //     webView.setWebViewClient(new WebViewClient() {
        //         @Override
        //         public void onPageFinished(WebView view, String url) {
        //             super.onPageFinished(view, url);
        //         }
        //     });
        // }
        
        // Nota: Como Capacitor maneja su propia WebView, 
        // necesitarás inyectar el bridge desde el lado de JavaScript
        // o usar la configuración de Capacitor para exponer métodos nativos.
        
        Log.d(TAG, "WebView Bridge configurado");
    }
    
    /**
     * Callback de la VPN cuando se bloquea un dominio
     */
    @Override
    public void onBlockedDomain(String domain) {
        Log.w(TAG, "VPN bloqueó dominio: " + domain);
        
        // Mostrar mensaje en WebView
        runOnUiThread(() -> {
            // Llamar a función JavaScript en la Web App
            String jsCode = "javascript:if(typeof mostrarBloqueo === 'function') { mostrarBloqueo('" + domain.replace("'", "\\'") + "'); }";
            
            // Si tienes acceso al WebView de Capacitor
            // bridge.getWebView().loadUrl(jsCode);
            
            // Alternativa: enviar evento a través de Capacitor
            // NotifyPlugin.sendEvent("domain_blocked", domain);
            
            Toast.makeText(this, "Acceso bloqueado: " + domain, Toast.LENGTH_SHORT).show();
        });
        
        logToRealtime("DOMAIN_BLOCKED", domain);
    }
    
    // --- LÓGICA DE LOGS ---
    private void logToRealtime(String tipo, String mensaje) {
        try {
            SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            String deviceId = prefs.getString(KEY_DEVICE_ID, null);
            if (deviceId != null) {
                DatabaseReference logRef = realtimeDb.getReference("dispositivos")
                    .child(deviceId).child("system_logs").child(String.valueOf(System.currentTimeMillis()));
                
                Map<String, Object> logEntry = new HashMap<>();
                logEntry.put("tipo", tipo);
                logEntry.put("mensaje", mensaje);
                logEntry.put("timestamp", System.currentTimeMillis());
                logRef.setValue(logEntry);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error log: " + e.getMessage());
        }
    }
    
    // --- PERMISOS ---
    private void solicitarPermisosBasicos() {
        String[] permisos = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) ?
            new String[]{Manifest.permission.CAMERA, Manifest.permission.POST_NOTIFICATIONS} :
            new String[]{Manifest.permission.CAMERA};
        
        boolean necesitaSolicitud = false;
        for (String p : permisos) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                necesitaSolicitud = true;
                break;
            }
        }
        if (necesitaSolicitud) {
            ActivityCompat.requestPermissions(this, permisos, 1001);
        }
    }
    
    // --- SEGURIDAD ---
    public void reactivarSeguridad() {
        getSharedPreferences(ADMIN_PREFS, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, false).apply();
        reiniciarMonitorService();
        Toast.makeText(this, "Protección Reactivada", Toast.LENGTH_SHORT).show();
    }
    
    public void liberarDispositivoTotal() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, AdminReceiver.class);
        try {
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                dpm.setUninstallBlocked(admin, getPackageName(), false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    dpm.clearDeviceOwnerApp(getPackageName());
                }
                stopService(new Intent(this, MonitorService.class));
                
                // Detener VPN
                Intent vpnIntent = new Intent(this, LocalVpnService.class);
                vpnIntent.setAction("STOP_VPN");
                startService(vpnIntent);
                
                logToRealtime("LIBERACION", "Dispositivo liberado");
                
                getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit().clear().apply();
                finishAffinity();
            }
        } catch (Exception e) {
            logToRealtime("LIBERACION_ERROR", e.getMessage());
        }
    }
    
    private void reiniciarMonitorService() {
        Intent intent = new Intent(this, MonitorService.class);
        stopService(intent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }
    
    private void checkSecurityPrivileges() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, AdminReceiver.class);
        
        if (!dpm.isDeviceOwnerApp(getPackageName()) && !dpm.isAdminActive(admin)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Protección requerida para el control parental.");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }
    
    private void checkVinculacionYEstado() {
        SharedPreferences cap = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        String dId = cap.getString(KEY_DEVICE_ID, null);
        if (dId != null) {
            deviceRealtimeRef = realtimeDb.getReference("dispositivos").child(dId);
            reiniciarMonitorService();
        }
    }
    
    /**
     * Inicia la VPN solicitando permiso si es necesario
     */
    private void iniciarEscudoVpn() {
        Intent vpnIntent = VpnService.prepare(this);
        if (vpnIntent != null) {
            // Solicitar permiso al usuario
            startActivityForResult(vpnIntent, VPN_REQUEST_CODE);
        } else {
            // Permiso ya concedido
            vpnPermissionGranted = true;
            startLocalVpnService();
        }
    }
    
    private void startLocalVpnService() {
        Intent intent = new Intent(this, LocalVpnService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                startForegroundService(intent);
            } catch (Exception e) {
                startService(intent);
            }
        } else {
            startService(intent);
        }
        Log.d(TAG, "LocalVpnService iniciado");
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == RESULT_OK) {
                vpnPermissionGranted = true;
                startLocalVpnService();
                logToRealtime("VPN", "Permiso concedido");
            } else {
                Log.e(TAG, "Permiso VPN denegado");
                Toast.makeText(this, "Se requiere permiso VPN para el control parental", Toast.LENGTH_LONG).show();
                // Intentar nuevamente después de unos segundos
                new android.os.Handler().postDelayed(this::iniciarEscudoVpn, 3000);
            }
        }
        
        if (requestCode == DEVICE_ADMIN_REQUEST && resultCode == RESULT_OK) {
            logToRealtime("ADMIN", "Device Admin activado");
        }
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getAction() != null) {
            if (intent.getAction().equals("ACTION_LIBERAR_TAB")) {
                liberarDispositivoTotal();
            } else if (intent.getAction().equals("ACTION_REBLOQUEAR_TAB")) {
                reactivarSeguridad();
            }
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        // Limpiar callback al destruir
        LocalVpnService.setCallback(null);
    }
}