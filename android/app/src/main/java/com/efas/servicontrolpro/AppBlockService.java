package com.efas.servicontrolpro;

import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.IBinder;
import android.os.Handler;
import android.util.Log;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

public class AppBlockService extends Service {
    private Handler handler = new Handler();
    private Runnable monitorTask;
    private String lastReportedApp = "";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        monitorTask = new Runnable() {
            @Override
            public void run() {
                checkForegroundApp();
                handler.postDelayed(this, 2000); // Revisamos cada 2 segundos para no saturar
            }
        };
        handler.post(monitorTask);
        return START_STICKY;
    }

    private void checkForegroundApp() {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        long time = System.currentTimeMillis();
        List<UsageStats> appList = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, time - 10000, time);
        
        if (appList != null && !appList.isEmpty()) {
            SortedMap<Long, UsageStats> mySortedMap = new TreeMap<>();
            for (UsageStats usageStats : appList) {
                mySortedMap.put(usageStats.getLastTimeUsed(), usageStats);
            }
            
            if (!mySortedMap.isEmpty()) {
                String currentApp = mySortedMap.get(mySortedMap.lastKey()).getPackageName();
                
                // Lista de ejemplo de apps prohibidas
                if (currentApp.contains("instagram") || currentApp.contains("tiktok") || currentApp.contains("facebook") || currentApp.contains("youtube")) {
                    
                    // Solo reportamos si es una app distinta a la última para no duplicar alertas
                    if (!currentApp.equals(lastReportedApp)) {
                        reportarIncidencia(currentApp);
                        lastReportedApp = currentApp;
                    }

                    // Lanzar pantalla de bloqueo
                    Intent lockIntent = new Intent(this, LockActivity.class);
                    lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(lockIntent);
                }
            }
        }
    }

    private void reportarIncidencia(String packageName) {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        String institutoId = prefs.getString("InstitutoId", "desconocido");
        
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        Map<String, Object> incidencia = new HashMap<>();
        incidencia.put("tipo", "ACCESO_PROHIBIDO");
        incidencia.put("app", packageName);
        incidencia.put("InstitutoId", institutoId);
        incidencia.put("timestamp", com.google.firebase.Timestamp.now());
        incidencia.put("status", "pendiente");

        db.collection("incidencias")
            .add(incidencia)
            .addOnSuccessListener(documentReference -> Log.d("EFAS", "Incidencia reportada"))
            .addOnFailureListener(e -> Log.e("EFAS", "Error al reportar", e));
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
