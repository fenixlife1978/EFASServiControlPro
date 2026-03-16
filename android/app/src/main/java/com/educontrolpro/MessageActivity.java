package com.educontrolpro;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import android.widget.TextView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.graphics.Color;
import android.view.Gravity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;

import java.util.HashMap;
import java.util.Map;

public class MessageActivity extends AppCompatActivity {
   
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String TAG = "MessageActivity";
    
    // HÍBRIDO: Realtime DB para operaciones rápidas
    private FirebaseDatabase realtimeDb;
    private DatabaseReference deviceRealtimeRef;
    
    // Firestore para respaldo
    private FirebaseFirestore firestore;
    
    private String deviceDocId = null;
    private String mensaje = "";
    private String remitente = "";
    private String messageId = null;
   
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
       
        // Configuración de pantalla
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        
        // Inicializar Firebase HÍBRIDO
        realtimeDb = FirebaseDatabase.getInstance();
        firestore = FirebaseFirestore.getInstance();
        
        // Obtener datos del intent
        Intent intent = getIntent();
        mensaje = intent.getStringExtra("mensaje");
        remitente = intent.getStringExtra("remitente");
        messageId = intent.getStringExtra("messageId"); // ID único del mensaje
        
        if (mensaje == null) mensaje = "Mensaje vacío";
        if (remitente == null) remitente = "Dirección";
       
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);
        
        if (deviceDocId != null) {
            deviceRealtimeRef = realtimeDb.getReference("dispositivos").child(deviceDocId).child("mensajes").child(messageId != null ? messageId : "actual");
        }
       
        // Crear UI
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.BLACK);
        layout.setPadding(60, 60, 60, 60);
       
        TextView tvTitle = new TextView(this);
        tvTitle.setText("MENSAJE DE DIRECCIÓN");
        tvTitle.setTextColor(Color.parseColor("#FFA500"));
        tvTitle.setTextSize(24);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 30);
       
        TextView tvMessage = new TextView(this);
        tvMessage.setText(mensaje);
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(18);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 50);
       
        TextView tvSender = new TextView(this);
        tvSender.setText("Remitente: " + remitente);
        tvSender.setTextColor(Color.GRAY);
        tvSender.setTextSize(14);
        tvSender.setGravity(Gravity.CENTER);
        tvSender.setPadding(0, 0, 0, 30);
       
        Button btnOk = new Button(this);
        btnOk.setText("ENTENDIDO");
        btnOk.setOnClickListener(v -> {
            marcarComoLeido();
            finish();
        });
       
        layout.addView(tvTitle);
        layout.addView(tvMessage);
        layout.addView(tvSender);
        layout.addView(btnOk);
        
        setContentView(layout);
    }
   
    private void marcarComoLeido() {
        if (deviceDocId == null) return;
        
        long now = System.currentTimeMillis();
        
        // 1. REALTIME DB: Marcar como leído (rápido, bajo costo)
        if (deviceRealtimeRef != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("leido", true);
            updates.put("leido_en", now);
            
            deviceRealtimeRef.updateChildren(updates)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "✓ Mensaje marcado como leído en Realtime DB"))
                .addOnFailureListener(e -> Log.e(TAG, "✗ Error en Realtime DB: " + e.getMessage()));
        }
        
        // 2. FIRESTORE: Backup para histórico (solo eventos importantes)
        Map<String, Object> backupEvent = new HashMap<>();
        backupEvent.put("tipo", "MENSAJE_LEIDO");
        backupEvent.put("messageId", messageId);
        backupEvent.put("remitente", remitente);
        backupEvent.put("timestamp", FieldValue.serverTimestamp());
        backupEvent.put("deviceId", deviceDocId);
        
        firestore.collection("eventos_mensajes")
            .add(backupEvent)
            .addOnFailureListener(e -> Log.e(TAG, "Error backup Firestore: " + e.getMessage()));
        
        // 3. También actualizar el mensaje actual en Realtime (opcional)
        if (deviceRealtimeRef != null) {
            deviceRealtimeRef.child("estado").setValue("leido");
        }
    }
    
    @Override
    public void onBackPressed() {
        // No permitir retroceder sin marcar como leído
        // Podríamos forzar a marcar como leído si intentan salir
        marcarComoLeido();
        finish();
    }
}
