package com.educontrolpro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

// HÍBRIDO: Realtime DB para operaciones frecuentes
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;

// Firestore para backup (opcional, solo eventos importantes)
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class UpdateManager {
    private static final String TAG = "EDU_Update";
    private Context context;
    
    // HÍBRIDO: Realtime DB para operaciones frecuentes
    private FirebaseDatabase realtimeDb;
    private DatabaseReference deviceRef;
    private DatabaseReference configRef;
    
    // Firestore para backup (solo eventos críticos)
    private FirebaseFirestore firestore;
    
    private static final String CHANNEL_ID = "update_channel";
    
    // Preferencias
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String ADMIN_PREFS = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String KEY_BLOQUEO_PIN = "bloqueo_pin";
   
    private String deviceId = null;
    
    // Listeners
    private ValueEventListener deviceListener;
    private ValueEventListener configListener;
   
    public UpdateManager(Context context) {
        this.context = context;
        
        // Inicializar Firebase HÍBRIDO
        realtimeDb = FirebaseDatabase.getInstance();
        firestore = FirebaseFirestore.getInstance();
        
        // Obtener deviceId
        SharedPreferences capPrefs = context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE);
        deviceId = capPrefs.getString(KEY_DEVICE_ID, null);
        
        if (deviceId != null) {
            deviceRef = realtimeDb.getReference("dispositivos").child(deviceId);
            configRef = realtimeDb.getReference("config").child("app_status");
        }
        
        if (deviceId == null) {
            Log.w(TAG, "No hay deviceId disponible (dispositivo no vinculado)");
        }
    }
   
    public void listenForUpdates() {
        // 1. REALTIME DB: Escuchar actualizaciones de versión
        if (configRef != null) {
            configListener = new ValueEventListener() {
                @Override
                public void onDataChange(DataSnapshot snapshot) {
                    checkVersion(snapshot);
                }

                @Override
                public void onCancelled(DatabaseError error) {
                    Log.e(TAG, "Error en Realtime config: " + error.getMessage());
                }
            };
            configRef.addValueEventListener(configListener);
        }
      
        // 2. REALTIME DB: Escuchar cambios en el PIN y comandos
        listenForDeviceChanges();
    }
   
    private void listenForDeviceChanges() {
        if (deviceId == null || deviceRef == null) return;
        
        deviceListener = new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                if (!snapshot.exists()) return;
                
                // 1. PIN de bloqueo
                String newPin = snapshot.child("pinBloqueo").getValue(String.class);
                if (newPin != null && !newPin.isEmpty()) {
                    updateLocalPin(newPin);
                }
                
                // 2. Modo admin
                Boolean adminEnabled = snapshot.child("admin_mode_enable").getValue(Boolean.class);
                if (adminEnabled != null && !adminEnabled) {
                    ejecutarRebloqueoLocal("admin_mode_desactivado");
                }
                
                // 3. Comando de bloqueo inmediato
                Boolean bloquearComando = snapshot.child("bloquear").getValue(Boolean.class);
                if (bloquearComando != null && bloquearComando) {
                    ejecutarRebloqueoLocal("comando_bloquear");
                    
                    // Resetear después de 2 segundos
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        if (deviceRef != null) {
                            deviceRef.child("bloquear").setValue(false);
                        }
                    }, 2000);
                }
            }

            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error en Realtime device: " + error.getMessage());
            }
        };
        
        deviceRef.addValueEventListener(deviceListener);
    }
  
    private void ejecutarRebloqueoLocal(String razon) {
        SharedPreferences adminPrefs = context.getSharedPreferences(ADMIN_PREFS, Context.MODE_PRIVATE);
        boolean actualmenteDesbloqueado = adminPrefs.getBoolean(KEY_UNLOCKED, false);
    
        if (actualmenteDesbloqueado) {
            adminPrefs.edit().putBoolean(KEY_UNLOCKED, false).apply();
            Log.d(TAG, "🔒 Re-bloqueo ejecutado: " + razon);
            
            // FIRESTORE: Solo eventos críticos
            registrarEventoFirestore("SEGURIDAD_RESTAURADA", "Bloqueo remoto: " + razon);
            
            // Forzar LockActivity
            Intent lockIntent = new Intent(context, LockActivity.class);
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(lockIntent);
        }
    }
  
    // FIRESTORE: Solo para eventos importantes (backup)
    private void registrarEventoFirestore(String tipo, String descripcion) {
        if (deviceId == null) return;
        
        Map<String, Object> evento = new HashMap<>();
        evento.put("tipo", tipo);
        evento.put("descripcion", descripcion);
        evento.put("timestamp", FieldValue.serverTimestamp());
        evento.put("deviceId", deviceId);
    
        firestore.collection("eventos_criticos").add(evento)
            .addOnFailureListener(e -> Log.e(TAG, "Error backup Firestore: " + e.getMessage()));
    }
  
    private void updateLocalPin(String newPin) {
        SharedPreferences prefs = context.getSharedPreferences(ADMIN_PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_BLOQUEO_PIN, newPin).apply();
        Log.d(TAG, "PIN sincronizado: " + newPin);
    }
 
    private void checkVersion(DataSnapshot snapshot) {
        try {
            Long cloudVersion = snapshot.child("versionCode").getValue(Long.class);
            String downloadUrl = snapshot.child("downloadUrl").getValue(String.class);
            
            if (cloudVersion == null || downloadUrl == null) return;
            
            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            int currentVersion = pInfo.versionCode;
            
            if (cloudVersion > currentVersion) {
                Log.d(TAG, "Nueva versión disponible: " + cloudVersion);
                startDownload(downloadUrl);
            }
        } catch (Exception e) { 
            Log.e(TAG, "Error version", e); 
        }
    }
  
    private void startDownload(String urlString) {
        new Thread(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection c = (HttpURLConnection) url.openConnection();
                c.connect();
                
                File file = new File(context.getExternalFilesDir(null), "update.apk");
                FileOutputStream fos = new FileOutputStream(file);
                InputStream is = c.getInputStream();
                
                byte[] buffer = new byte[4096];
                int len;
                while ((len = is.read(buffer)) != -1) { 
                    fos.write(buffer, 0, len); 
                }
                
                fos.close(); 
                is.close();
                showUpdateNotification(file);
                
            } catch (Exception e) { 
                Log.e(TAG, "Error download", e); 
            }
        }).start();
    }
  
    private void showUpdateNotification(File file) {
        Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".provider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { 
            flags |= PendingIntent.FLAG_IMMUTABLE; 
        }
        
        PendingIntent pIntent = PendingIntent.getActivity(context, 0, intent, flags);
        
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Actualizaciones", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
        }
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Actualización Crítica")
                .setContentText("Instale la nueva versión.")
                .setAutoCancel(true)
                .setOngoing(true)
                .setContentIntent(pIntent);
        
        nm.notify(2, builder.build());
    }
    
    // Limpiar recursos
    public void cleanup() {
        if (deviceListener != null && deviceRef != null) {
            deviceRef.removeEventListener(deviceListener);
        }
        if (configListener != null && configRef != null) {
            configRef.removeEventListener(configListener);
        }
    }
}