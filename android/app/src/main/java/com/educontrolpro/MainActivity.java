package com.educontrolpro;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.device.DevicePlugin;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity 
{
    private static final int DEVICE_ADMIN_REQUEST = 101;
    private static final int WRITE_SETTINGS_REQUEST = 102;
    private static final int IGNORE_BATTERY_REQUEST = 103;
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String KEY_INSTITUTO_ID = "InstitutoId";
    private static final String KEY_ADMIN_ACTIVATED = "admin_activated";
    private static final String KEY_TECH_MODE = "tech_mode";      
    private static final String KEY_BLOCK_MODE = "block_mode";    
    
    // Claves para caché local de listas
    private static final String KEY_CACHED_BLACKLIST = "cached_blacklist";
    private static final String KEY_CACHED_WHITELIST = "cached_whitelist";
    private static final String KEY_CACHED_SHIELD = "cached_shield";
    private static final String KEY_CACHED_USE_BLACKLIST = "cached_use_blacklist";
    private static final String KEY_CACHED_USE_WHITELIST = "cached_use_whitelist";
    private static final String KEY_CACHE_TIMESTAMP = "cache_timestamp";
    private static final long CACHE_VALIDITY_MS = 5 * 60 * 1000;
    
    // Configuración de NextDNS
    private static final String NEXTDNS_PROFILE_ID = "857b18";
    private static final String NEXTDNS_BASE_DOMAIN = "dns.nextdns.io";
    
    private DatabaseReference rtdb;
    private String deviceId;
    private String institutoId;
    private SharedPreferences.OnSharedPreferenceChangeListener prefsListener;
    private Handler mainHandler;
    private ScheduledExecutorService scheduler;
    
    private Set<String> globalBlacklist = new HashSet<>();
    private Set<String> globalWhitelist = new HashSet<>();
    private boolean shieldEnabled = false;
    private boolean useBlacklist = true;
    private boolean useWhitelist = true;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        mostrarToast("🚀 Iniciando EDUControlPro...");
        
        // 🔥 Crash Handler - Captura errores no controlados
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e("EDU_CRASH", "❌ Error no capturado: " + throwable.getMessage(), throwable);
            
            if (rtdb != null && deviceId != null) {
                try {
                    Map<String, Object> crashData = new HashMap<>();
                    crashData.put("error", throwable.getMessage());
                    crashData.put("stackTrace", Arrays.toString(throwable.getStackTrace()));
                    crashData.put("timestamp", System.currentTimeMillis());
                    crashData.put("deviceId", deviceId);
                    crashData.put("androidVersion", Build.VERSION.SDK_INT);
                    rtdb.child("crash_logs").child(deviceId).push().setValue(crashData);
                } catch (Exception e) {
                    Log.e("EDU_CRASH", "Error guardando crash log: " + e.getMessage());
                }
            }
            
            mainHandler.post(() -> {
                Toast.makeText(MainActivity.this, 
                    "⚠️ EduControlPro ha tenido un error. Se reiniciará automáticamente.", 
                    Toast.LENGTH_LONG).show();
            });
            
            try {
                Thread.sleep(2000);
            } catch (InterruptedException e) {}
            
            Intent intent = new Intent(getApplicationContext(), MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            android.os.Process.killProcess(android.os.Process.myPid());
            System.exit(1);
        });
        
        mainHandler = new Handler(Looper.getMainLooper());
        scheduler = Executors.newSingleThreadScheduledExecutor();
        
        try {
            registerPlugin(DevicePlugin.class);
        } catch (Exception e) {
            Log.e("EDU_Status", "Error al registrar plugins: " + e.getMessage());
            mostrarToast("❌ Error plugins: " + e.getMessage());
        }
        
        verificarPermisoWriteSettings();
        requestIgnoreBatteryOptimizations();
        cargarCacheLocal();
        
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        
        prefsListener = (sharedPreferences, key) -> {
            if (KEY_DEVICE_ID.equals(key)) {
                String newId = sharedPreferences.getString(KEY_DEVICE_ID, null);
                if (newId != null && !newId.equals(deviceId)) {
                    deviceId = newId;
                    cargarInstitutoId();
                    inicializarFirebaseYServicios();
                }
            } else if (KEY_INSTITUTO_ID.equals(key)) {
                String newInstId = sharedPreferences.getString(KEY_INSTITUTO_ID, null);
                if (newInstId != null && !newInstId.equals(institutoId)) {
                    institutoId = newInstId;
                    inicializarFirebaseYServicios();
                }
            }
        };
        prefs.registerOnSharedPreferenceChangeListener(prefsListener);

        deviceId = prefs.getString(KEY_DEVICE_ID, null);
        institutoId = prefs.getString(KEY_INSTITUTO_ID, null);
        
        mostrarToast("📱 DeviceID: " + (deviceId != null ? deviceId : "null"));
        mostrarToast("🏛️ Instituto: " + (institutoId != null ? institutoId : "null"));
        
        if (deviceId != null && !deviceId.isEmpty() && !deviceId.equals("student_unknown") &&
            institutoId != null && !institutoId.isEmpty()) {
            mostrarToast("✅ IDs válidos, iniciando servicios...");
            inicializarFirebaseYServicios();
        } else {
            mostrarToast("⚠️ Esperando vinculación con QR");
        }
        
        iniciarWatchdogServicios();
        iniciarVerificacionPeriodicaDNS();
        checkSecurityPrivileges();
        
        mostrarLog("✅ MainActivity iniciada");
    }
    
    private void mostrarToast(String mensaje) {
        mainHandler.post(() -> Toast.makeText(this, mensaje, Toast.LENGTH_SHORT).show());
        Log.d("EDU_Status", mensaje);
    }
    
    private void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                mostrarLog("⚠️ Solicitando ignorar optimización de batería");
                mostrarToast("🔋 Solicitando permiso de batería...");
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                try {
                    startActivityForResult(intent, IGNORE_BATTERY_REQUEST);
                } catch (Exception e) {
                    mostrarLog("Error solicitando optimización de batería: " + e.getMessage());
                }
            } else {
                mostrarLog("✅ App ya está optimizada para batería");
            }
        }
    }
    
    private void iniciarWatchdogServicios() {
        scheduler.scheduleAtFixedRate(() -> {
            mainHandler.post(() -> {
                if (deviceId != null && !deviceId.isEmpty()) {
                    verificarYReiniciarMonitorService();
                }
            });
        }, 30, 60, TimeUnit.SECONDS);
        mostrarLog("🔍 Watchdog de servicios iniciado (cada 60s)");
    }
    
    private void verificarYReiniciarMonitorService() {
        boolean isAccessibilityEnabled = isAccessibilityServiceEnabled();
        
        if (!isAccessibilityEnabled) {
            mostrarLog("⚠️ Servicio de accesibilidad NO activo");
            mainHandler.post(() -> {
                Toast.makeText(this, "⚠️ Para protección total, activa Accesibilidad en Ajustes", Toast.LENGTH_LONG).show();
            });
            actualizarEstadoServicio(false);
        } else {
            mostrarLog("✅ Servicio de accesibilidad activo");
            actualizarEstadoServicio(true);
        }
    }
    
    private boolean isAccessibilityServiceEnabled() {
        String serviceName = getPackageName() + "/" + MonitorService.class.getCanonicalName();
        try {
            int enabled = Settings.Secure.getInt(getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED, 0);
            if (enabled == 1) {
                String enabledServices = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
                return enabledServices != null && enabledServices.contains(serviceName);
            }
        } catch (Exception e) {
            Log.e("EDU_Status", "Error verificando accesibilidad: " + e.getMessage());
        }
        return false;
    }
    
    private void abrirConfiguracionAccesibilidad() {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e("EDU_Status", "Error abriendo configuración: " + e.getMessage());
        }
    }
    
    private void actualizarEstadoServicio(boolean activo) {
        if (rtdb != null && deviceId != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("accesibilidad_activa", activo);
            updates.put("ultima_verificacion_accesibilidad", System.currentTimeMillis());
            rtdb.child("status_dispositivos").child(deviceId).updateChildren(updates);
        }
    }
    
    private void verificarPermisoWriteSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.System.canWrite(this)) {
                mostrarLog("⚠️ Se necesita permiso WRITE_SETTINGS para configurar DNS");
                mostrarToast("🔒 Se necesita permiso para modificar la configuración de DNS");
                Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, WRITE_SETTINGS_REQUEST);
            } else {
                mostrarLog("✅ Permiso WRITE_SETTINGS ya concedido");
                configurarDNSPrivado();
            }
        } else {
            mostrarLog("✅ Android < 6.0, no requiere permiso WRITE_SETTINGS");
            configurarDNSPrivado();
        }
    }
    
    private void cargarCacheLocal() {
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        
        Set<String> cachedBlacklist = prefs.getStringSet(KEY_CACHED_BLACKLIST, null);
        if (cachedBlacklist != null) {
            globalBlacklist.clear();
            globalBlacklist.addAll(cachedBlacklist);
            mostrarLog("📦 Caché local: " + globalBlacklist.size() + " dominios en blacklist");
        }
        
        Set<String> cachedWhitelist = prefs.getStringSet(KEY_CACHED_WHITELIST, null);
        if (cachedWhitelist != null) {
            globalWhitelist.clear();
            globalWhitelist.addAll(cachedWhitelist);
            mostrarLog("📦 Caché local: " + globalWhitelist.size() + " dominios en whitelist");
        }
        
        shieldEnabled = prefs.getBoolean(KEY_CACHED_SHIELD, false);
        useBlacklist = prefs.getBoolean(KEY_CACHED_USE_BLACKLIST, true);
        useWhitelist = prefs.getBoolean(KEY_CACHED_USE_WHITELIST, true);
    }
    
    private void guardarCacheLocal() {
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        editor.putStringSet(KEY_CACHED_BLACKLIST, new HashSet<>(globalBlacklist));
        editor.putStringSet(KEY_CACHED_WHITELIST, new HashSet<>(globalWhitelist));
        editor.putBoolean(KEY_CACHED_SHIELD, shieldEnabled);
        editor.putBoolean(KEY_CACHED_USE_BLACKLIST, useBlacklist);
        editor.putBoolean(KEY_CACHED_USE_WHITELIST, useWhitelist);
        editor.putLong(KEY_CACHE_TIMESTAMP, System.currentTimeMillis());
        
        editor.apply();
        mostrarLog("💾 Caché local actualizada");
    }
    
    private void iniciarVerificacionPeriodicaDNS() {
        scheduler.scheduleAtFixedRate(() -> {
            mainHandler.post(() -> {
                if (!isNextDNSActive()) {
                    mostrarLog("⚠️ DNS no está configurado, forzando configuración...");
                    configurarDNSPrivado();
                }
            });
        }, 5, 30, TimeUnit.SECONDS);
        mostrarLog("⏰ Verificación periódica de DNS iniciada (cada 30s)");
    }
    
    private void mostrarLog(String mensaje) {
        Log.d("EDU_Status", mensaje);
        System.out.println("[EDUControlPro] " + mensaje);
    }
    
    private void cargarInstitutoId() {
        SharedPreferences prefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        institutoId = prefs.getString(KEY_INSTITUTO_ID, null);
        mostrarLog("🏛️ Instituto: " + institutoId);
    }

    private void inicializarFirebaseYServicios() {
        if (deviceId == null || deviceId.isEmpty() || deviceId.equals("student_unknown")) {
            mostrarToast("❌ Device ID no válido");
            return;
        }
        if (institutoId == null || institutoId.isEmpty()) {
            mostrarToast("❌ Instituto ID no válido");
            return;
        }
        
        mostrarToast("🔥 Conectando a Firebase...");
        rtdb = FirebaseDatabase.getInstance().getReference();
        mostrarLog("🔥 Firebase inicializado: " + deviceId);
        mostrarToast("✅ Firebase conectado");
        
        mostrarToast("🔧 Configurando DNS...");
        configurarDNSPrivado();
        
        guardarVinculacionEnFirebase();
        configurarFiltroWeb();
        escucharModosDesdePanel();
        escucharMensajesDirector();
        
        iniciarMonitorService();
        
        mostrarLog("✅ Dispositivo listo con NextDNS");
        mostrarToast("✅ Dispositivo listo");
    }
    
    private void configurarDNSPrivado() {
        mostrarToast("🔧 Iniciando configuración DNS...");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.System.canWrite(this)) {
                mostrarToast("❌ Sin permiso WRITE_SETTINGS");
                mostrarLog("⚠️ Sin permiso WRITE_SETTINGS, no se puede configurar DNS");
                return;
            }
        }
        
        String deviceIdForDNS = "dispositivo";
        if (this.deviceId != null && !this.deviceId.isEmpty()) {
            deviceIdForDNS = this.deviceId.replaceAll("[^a-zA-Z0-9-]", "");
            mostrarToast("📱 DeviceID para DNS: " + deviceIdForDNS);
        } else {
            mostrarToast("⚠️ DeviceID no disponible");
        }
        
        final String dnsHostname = deviceIdForDNS + "-" + NEXTDNS_PROFILE_ID + "." + NEXTDNS_BASE_DOMAIN;
        final String finalDeviceIdForDNS = deviceIdForDNS;
        mostrarToast("🌐 Configurando: " + dnsHostname);
        
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    try {
                        Class<?> cmClass = cm.getClass();
                        java.lang.reflect.Method setPrivateDnsMode = cmClass.getMethod("setPrivateDnsMode", String.class);
                        java.lang.reflect.Method setPrivateDnsHostname = cmClass.getMethod("setPrivateDnsHostname", String.class);
                        java.lang.reflect.Method getPrivateDnsHostname = cmClass.getMethod("getPrivateDnsHostname");
                        
                        String currentDns = (String) getPrivateDnsHostname.invoke(cm);
                        if (dnsHostname.equals(currentDns)) {
                            mostrarToast("✅ DNS ya estaba configurado");
                            actualizarEstadoNextDNS(true, dnsHostname);
                            return;
                        }
                        
                        setPrivateDnsMode.invoke(cm, "SPECIFIED");
                        setPrivateDnsHostname.invoke(cm, dnsHostname);
                        mostrarToast("✅ DNS Configurado: " + dnsHostname);
                        mostrarLog("🔒 DNS Privado CONFIGURADO: " + dnsHostname);
                        
                        actualizarEstadoNextDNS(true, dnsHostname);
                        
                        mainHandler.post(() -> {
                            Toast.makeText(this, "🔒 Filtro NextDNS activado para " + finalDeviceIdForDNS, Toast.LENGTH_LONG).show();
                        });
                    } catch (Exception e) {
                        mostrarToast("❌ Error DNS: " + e.getMessage());
                        mostrarLog("⚠️ Error configurando DNS: " + e.getMessage());
                    }
                } else {
                    mostrarToast("❌ ConnectivityManager null");
                }
            } catch (Exception e) {
                mostrarToast("❌ Error DNS: " + e.getMessage());
                mostrarLog("⚠️ Error configurando DNS: " + e.getMessage());
            }
        } else {
            mostrarToast("⚠️ Android " + Build.VERSION.SDK_INT + " no soporta DNS Privado");
        }
    }
    
    private void actualizarEstadoNextDNS(boolean activo, String hostname) {
        if (rtdb != null && deviceId != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("nextdns_active", activo);
            updates.put("nextdns_hostname", hostname);
            updates.put("nextdns_last_configured", System.currentTimeMillis());
            rtdb.child("status_dispositivos").child(deviceId).updateChildren(updates);
        }
    }
    
    public boolean isNextDNSActive() {
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    Class<?> cmClass = cm.getClass();
                    java.lang.reflect.Method getPrivateDnsHostname = cmClass.getMethod("getPrivateDnsHostname");
                    String currentDns = (String) getPrivateDnsHostname.invoke(cm);
                    return currentDns != null && currentDns.contains(NEXTDNS_PROFILE_ID);
                }
            } catch (Exception e) {
                mostrarLog("Error verificando DNS: " + e.getMessage());
            }
        }
        return false;
    }
    
    private void guardarVinculacionEnFirebase() {
        if (rtdb == null || deviceId == null || institutoId == null) return;
        
        mostrarToast("💾 Guardando vinculación...");
        
        rtdb.child("dispositivos").child(deviceId).child("InstitutoId").setValue(institutoId);
        
        Map<String, Object> statusData = new HashMap<>();
        statusData.put("InstitutoId", institutoId);
        statusData.put("online", true);
        statusData.put("ultima_actualizacion", System.currentTimeMillis());
        statusData.put("nextdns_configured", isNextDNSActive());
        statusData.put("nextdns_hostname", deviceId + "-" + NEXTDNS_PROFILE_ID + "." + NEXTDNS_BASE_DOMAIN);
        statusData.put("accesibilidad_activa", isAccessibilityServiceEnabled());
        rtdb.child("status_dispositivos").child(deviceId).updateChildren(statusData);
        
        mostrarLog("✅ Dispositivo vinculado: " + deviceId);
        mostrarToast("✅ Vinculación guardada");
    }
    
    private void configurarFiltroWeb() {
        if (rtdb == null || institutoId == null) return;
        
        DatabaseReference sedeRef = rtdb.child("config").child("instituciones").child(institutoId);
        
        sedeRef.child("blacklist").addValueEventListener(new ValueEventListener() {
            @Override 
            public void onDataChange(DataSnapshot s) {
                globalBlacklist.clear();
                for (DataSnapshot child : s.getChildren()) {
                    String v = child.getValue(String.class);
                    if (v != null) globalBlacklist.add(v);
                }
                mostrarLog("📡 Blacklist actualizada: " + globalBlacklist.size() + " dominios");
                guardarCacheLocal();
            }
            @Override 
            public void onCancelled(DatabaseError e) {}
        });
        
        sedeRef.child("whitelist").addValueEventListener(new ValueEventListener() {
            @Override 
            public void onDataChange(DataSnapshot s) {
                globalWhitelist.clear();
                for (DataSnapshot child : s.getChildren()) {
                    String v = child.getValue(String.class);
                    if (v != null) globalWhitelist.add(v);
                }
                mostrarLog("📡 Whitelist actualizada: " + globalWhitelist.size() + " dominios");
                guardarCacheLocal();
            }
            @Override 
            public void onCancelled(DatabaseError e) {}
        });
        
        sedeRef.child("shieldModeGlobal").addValueEventListener(new ValueEventListener() {
            @Override 
            public void onDataChange(DataSnapshot s) {
                shieldEnabled = s.exists() && Boolean.TRUE.equals(s.getValue(Boolean.class));
                guardarCacheLocal();
            }
            @Override 
            public void onCancelled(DatabaseError e) {}
        });
        
        sedeRef.child("useBlacklist").addValueEventListener(new ValueEventListener() {
            @Override 
            public void onDataChange(DataSnapshot s) {
                useBlacklist = s.exists() && Boolean.TRUE.equals(s.getValue(Boolean.class));
                guardarCacheLocal();
            }
            @Override 
            public void onCancelled(DatabaseError e) {}
        });
        
        sedeRef.child("useWhitelist").addValueEventListener(new ValueEventListener() {
            @Override 
            public void onDataChange(DataSnapshot s) {
                useWhitelist = s.exists() && Boolean.TRUE.equals(s.getValue(Boolean.class));
                guardarCacheLocal();
            }
            @Override 
            public void onCancelled(DatabaseError e) {}
        });
    }
    
    // ========== MÉTODOS PARA EL PANEL WEB ==========
    
    public void agregarABlacklistGlobal(String dominio) {
        if (rtdb == null || institutoId == null) return;
        globalBlacklist.add(dominio);
        guardarCacheLocal();
        rtdb.child("config").child("instituciones").child(institutoId).child("blacklist").push().setValue(dominio);
    }
    
    public void agregarAWhitelistGlobal(String dominio) {
        if (rtdb == null || institutoId == null) return;
        globalWhitelist.add(dominio);
        guardarCacheLocal();
        rtdb.child("config").child("instituciones").child(institutoId).child("whitelist").push().setValue(dominio);
    }
    
    // ========== MÉTODOS DE BLOQUEO ==========
    
    private void lanzarBloqueoTotal() {
        try {
            Intent intent = new Intent(this, BlockActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.putExtra("tipo_bloqueo", "blindaje_total");
            intent.putExtra("deviceId", deviceId);
            startActivity(intent);
        } catch (Exception e) {
            Log.e("EDU_Status", "Error lanzando bloqueo: " + e.getMessage());
        }
    }
    
    private void escucharModosDesdePanel() {
        if (rtdb == null || deviceId == null) return;
        
        rtdb.child("status_dispositivos").child(deviceId).child("shield_mode_enable")
            .addValueEventListener(new ValueEventListener() {
                @Override public void onDataChange(DataSnapshot s) {
                    boolean blockMode = s.exists() && Boolean.TRUE.equals(s.getValue(Boolean.class));
                    getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit().putBoolean(KEY_BLOCK_MODE, blockMode).apply();
                    AdminReceiver.setBlockMode(MainActivity.this, blockMode);
                    if (blockMode) lanzarBloqueoTotal();
                }
                @Override public void onCancelled(DatabaseError e) {}
            });
    }
    
    private void escucharMensajesDirector() {
        if (rtdb == null || deviceId == null) return;
        
        rtdb.child("dispositivos").child(deviceId).child("mensaje_actual")
            .addValueEventListener(new ValueEventListener() {
                @Override
                public void onDataChange(DataSnapshot snapshot) {
                    if (snapshot.exists()) {
                        String texto = snapshot.child("mensaje").getValue(String.class);
                        Boolean leido = snapshot.child("leido").getValue(Boolean.class);
                        String idMsg = snapshot.child("messageId").getValue(String.class);
                        String remitente = snapshot.child("remitente").getValue(String.class);
                        String titulo = snapshot.child("titulo").getValue(String.class);
                        
                        if (texto != null && !texto.isEmpty() && (leido == null || !leido)) {
                            try {
                                Intent intent = new Intent(MainActivity.this, MessageActivity.class);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                intent.putExtra("mensaje", texto);
                                intent.putExtra("remitente", remitente != null ? remitente : "Dirección");
                                intent.putExtra("messageId", idMsg);
                                intent.putExtra("deviceId", deviceId);
                                if (titulo != null) intent.putExtra("titulo", titulo);
                                startActivity(intent);
                            } catch (Exception e) {
                                Log.e("EDU_Status", "Error lanzando mensaje: " + e.getMessage());
                            }
                        }
                    }
                }
                @Override public void onCancelled(DatabaseError e) {}
            });
    }
    
    // ========== MÉTODOS DE SEGURIDAD ==========
    
    private void checkSecurityPrivileges() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName adminComponent = new ComponentName(this, AdminReceiver.class);
        if (dpm == null) return;
        
        if (dpm.isDeviceOwnerApp(getPackageName())) {
            try {
                dpm.setUninstallBlocked(adminComponent, getPackageName(), true);
                getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ADMIN_ACTIVATED, true).apply();
            } catch (Exception e) {
                Log.e("EDU_Status", "Error en Device Owner: " + e.getMessage());
            }
        } 
        else if (!dpm.isAdminActive(adminComponent)) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "EduControlPro requiere permisos de administrador.");
            startActivityForResult(intent, DEVICE_ADMIN_REQUEST);
        }
    }
    
    private void iniciarMonitorService() {
        try {
            Intent serviceIntent = new Intent(this, MonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            mostrarLog("🔄 MonitorService iniciado");
            mostrarToast("🔄 Servicio de monitoreo iniciado");
        } catch (Exception e) {
            Log.e("EDU_Status", "Error MonitorService: " + e.getMessage());
            mostrarToast("❌ Error MonitorService: " + e.getMessage());
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == DEVICE_ADMIN_REQUEST && resultCode == RESULT_OK) {
            getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ADMIN_ACTIVATED, true).apply();
            Toast.makeText(this, "Permisos de administrador activados", Toast.LENGTH_SHORT).show();
        } else if (requestCode == WRITE_SETTINGS_REQUEST) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.System.canWrite(this)) {
                mostrarLog("✅ Permiso WRITE_SETTINGS concedido");
                mostrarToast("✅ Permiso WRITE_SETTINGS concedido");
                configurarDNSPrivado();
            } else {
                mostrarToast("⚠️ Permiso WRITE_SETTINGS denegado");
                Toast.makeText(this, "⚠️ Permiso denegado, el filtro NextDNS no funcionará", Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == IGNORE_BATTERY_REQUEST) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    mostrarLog("✅ App optimizada para batería");
                    mostrarToast("✅ Permiso de batería concedido");
                }
            }
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        verificarYReiniciarMonitorService();
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        if (prefsListener != null) {
            getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE).unregisterOnSharedPreferenceChangeListener(prefsListener);
        }
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdown();
        }
    }
    
    // ========== GETTERS ==========
    
    public Set<String> getGlobalBlacklist() { return globalBlacklist; }
    public Set<String> getGlobalWhitelist() { return globalWhitelist; }
    public boolean isShieldEnabled() { return shieldEnabled; }
    public boolean isUseBlacklist() { return useBlacklist; }
    public boolean isUseWhitelist() { return useWhitelist; }
    public String getDeviceIdValue() { return deviceId; }
    public String getInstitutoIdValue() { return institutoId; }
}