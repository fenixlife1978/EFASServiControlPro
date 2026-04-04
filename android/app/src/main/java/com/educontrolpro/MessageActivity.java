package com.educontrolpro;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.firestore.FirebaseFirestore;

import java.util.HashMap;
import java.util.Map;

public class MessageActivity extends AppCompatActivity {
    
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String TAG = "MessageActivity";
    
    private FirebaseDatabase realtimeDb;
    private FirebaseFirestore firestore;
    
    private String deviceId = null;
    private String mensaje = "";
    private String remitente = "";
    private String messageId = null;
    private String titulo = "";
    private boolean isFinishing = false;
   
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "=== MessageActivity onCreate ===");
       
        // Configuración de pantalla
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        
        // Pantalla completa
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        
        try {
            realtimeDb = FirebaseDatabase.getInstance();
            firestore = FirebaseFirestore.getInstance();
            Log.d(TAG, "✅ Firebase inicializado");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error inicializando Firebase: " + e.getMessage());
        }
        
        // Obtener datos del intent
        Intent intent = getIntent();
        if (intent != null) {
            mensaje = intent.getStringExtra("mensaje");
            remitente = intent.getStringExtra("remitente");
            messageId = intent.getStringExtra("messageId");
            deviceId = intent.getStringExtra("deviceId");
            titulo = intent.getStringExtra("titulo");
            
            Log.d(TAG, "📨 DATOS RECIBIDOS:");
            Log.d(TAG, "   - messageId: " + messageId);
            Log.d(TAG, "   - remitente: " + remitente);
            Log.d(TAG, "   - deviceId: " + deviceId);
            Log.d(TAG, "   - titulo: " + titulo);
            Log.d(TAG, "   - mensaje: " + (mensaje != null ? (mensaje.length() > 100 ? mensaje.substring(0, 100) + "..." : mensaje) : "null"));
        } else {
            Log.e(TAG, "❌ Intent es NULL!");
        }
        
        // Valores por defecto si faltan
        if (mensaje == null || mensaje.isEmpty()) {
            mensaje = "Mensaje desde Dirección";
            Log.w(TAG, "Mensaje vacío, usando valor por defecto");
        }
        if (remitente == null || remitente.isEmpty()) {
            remitente = "Dirección";
        }
        if (deviceId == null) {
            deviceId = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString("deviceId", null);
            Log.d(TAG, "DeviceId recuperado de SharedPreferences: " + deviceId);
        }
        
        crearInterfazProfesional();
        
        // Registrar en logs que se mostró el mensaje
        registrarVisualizacion();
    }
    
    private void registrarVisualizacion() {
        try {
            if (realtimeDb != null && deviceId != null && messageId != null) {
                Map<String, Object> evento = new HashMap<>();
                evento.put("tipo", "mensaje_mostrado");
                evento.put("messageId", messageId);
                evento.put("timestamp", System.currentTimeMillis());
                evento.put("deviceId", deviceId);
                realtimeDb.getReference("eventos_mensajes").child(deviceId).push().setValue(evento);
                Log.d(TAG, "✅ Evento de visualización registrado");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error registrando visualización: " + e.getMessage());
        }
    }
    
    private void crearInterfazProfesional() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(40, 60, 40, 60);
        
        GradientDrawable gradient = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.parseColor("#0f2027"), Color.parseColor("#203a43"), Color.parseColor("#2c5364")}
        );
        gradient.setCornerRadius(0);
        layout.setBackground(gradient);
        
        Animation fadeIn = AnimationUtils.loadAnimation(this, android.R.anim.fade_in);
        fadeIn.setDuration(600);
        
        ImageView icon = new ImageView(this);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(120, 120);
        iconParams.bottomMargin = 30;
        icon.setLayoutParams(iconParams);
        icon.setImageResource(android.R.drawable.ic_dialog_email);
        icon.setColorFilter(Color.parseColor("#00BFFF"));
        icon.startAnimation(fadeIn);
        
        TextView tvTitle = new TextView(this);
        String tituloMostrar = (titulo != null && !titulo.isEmpty()) ? titulo : "📨 MENSAJE DE DIRECCIÓN";
        tvTitle.setText(tituloMostrar);
        tvTitle.setTextColor(Color.parseColor("#00BFFF"));
        tvTitle.setTextSize(26);
        tvTitle.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 20);
        tvTitle.startAnimation(fadeIn);
        
        LinearLayout cardLayout = new LinearLayout(this);
        cardLayout.setOrientation(LinearLayout.VERTICAL);
        cardLayout.setGravity(Gravity.CENTER);
        cardLayout.setPadding(30, 30, 30, 30);
        
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.parseColor("#33FFFFFF"));
        cardBg.setCornerRadius(25);
        cardLayout.setBackground(cardBg);
        
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.bottomMargin = 40;
        cardParams.topMargin = 20;
        cardLayout.setLayoutParams(cardParams);
        
        TextView tvMessage = new TextView(this);
        tvMessage.setText(mensaje);
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(18);
        tvMessage.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(20, 20, 20, 20);
        tvMessage.setLineSpacing(8, 1.2f);
        
        View divider = new View(this);
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 1);
        dividerParams.topMargin = 15;
        dividerParams.bottomMargin = 15;
        divider.setLayoutParams(dividerParams);
        divider.setBackgroundColor(Color.parseColor("#88FFFFFF"));
        
        TextView tvSender = new TextView(this);
        tvSender.setText("✉️ " + remitente);
        tvSender.setTextColor(Color.parseColor("#CCCCCC"));
        tvSender.setTextSize(14);
        tvSender.setTypeface(Typeface.create("sans-serif", Typeface.ITALIC));
        tvSender.setGravity(Gravity.CENTER);
        
        cardLayout.addView(tvMessage);
        cardLayout.addView(divider);
        cardLayout.addView(tvSender);
        
        Button btnOk = new Button(this);
        btnOk.setText("ENTENDIDO");
        btnOk.setTextColor(Color.parseColor("#0f2027"));
        btnOk.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        btnOk.setTextSize(16);
        
        GradientDrawable btnShape = new GradientDrawable();
        btnShape.setCornerRadius(40);
        btnShape.setColor(Color.WHITE);
        btnOk.setBackground(btnShape);
        
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 120);
        btnParams.topMargin = 20;
        btnParams.leftMargin = 40;
        btnParams.rightMargin = 40;
        btnOk.setLayoutParams(btnParams);
        
        btnOk.setOnClickListener(v -> {
            marcarComoLeido();
            cerrarDefinitivamente();
        });
        
        TextView tvInfo = new TextView(this);
        tvInfo.setText("⏺ Esta confirmación será registrada en el sistema");
        tvInfo.setTextColor(Color.parseColor("#88FFFFFF"));
        tvInfo.setTextSize(11);
        tvInfo.setGravity(Gravity.CENTER);
        tvInfo.setPadding(0, 30, 0, 0);
        
        layout.addView(icon);
        layout.addView(tvTitle);
        layout.addView(cardLayout);
        layout.addView(btnOk);
        layout.addView(tvInfo);
        
        setContentView(layout);
    }
    
    private void cerrarDefinitivamente() {
        if (isFinishing) return;
        isFinishing = true;
        
        Log.d(TAG, "✅ Cerrando MessageActivity definitivamente");
        
        // Volver al home
        Intent startMain = new Intent(Intent.ACTION_MAIN);
        startMain.addCategory(Intent.CATEGORY_HOME);
        startMain.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(startMain);
        
        // Finalizar esta actividad
        finish();
    }
    
    private void setupImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
   
    private void marcarComoLeido() {
        if (deviceId == null || deviceId.isEmpty() || deviceId.equals("student_unknown")) {
            Log.w(TAG, "❌ Device ID no disponible para marcar como leído");
            return;
        }
        
        long now = System.currentTimeMillis();
        
        Log.d(TAG, "📝 Marcando mensaje como leído - Device: " + deviceId + ", MessageId: " + messageId);
        
        // 1. Actualizar mensaje_actual
        try {
            DatabaseReference mensajeActualRef = realtimeDb.getReference("dispositivos")
                .child(deviceId)
                .child("mensaje_actual");
            
            Map<String, Object> updates = new HashMap<>();
            updates.put("leido", true);
            updates.put("leido_en", now);
            updates.put("fecha_lectura", now);
            
            mensajeActualRef.updateChildren(updates)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "✓ Mensaje marcado como leído"))
                .addOnFailureListener(e -> Log.e(TAG, "✗ Error: " + e.getMessage()));
        } catch (Exception e) {
            Log.e(TAG, "Error actualizando mensaje_actual: " + e.getMessage());
        }
        
        // 2. Si hay messageId, actualizar historial
        if (messageId != null && !messageId.isEmpty()) {
            try {
                DatabaseReference historialRef = realtimeDb.getReference("dispositivos")
                    .child(deviceId)
                    .child("mensajes_historial")
                    .child(messageId);
                
                Map<String, Object> historialUpdates = new HashMap<>();
                historialUpdates.put("leido", true);
                historialUpdates.put("leido_en", now);
                
                historialRef.updateChildren(historialUpdates);
                Log.d(TAG, "✓ Historial actualizado");
            } catch (Exception e) {
                Log.e(TAG, "Error actualizando historial: " + e.getMessage());
            }
        }
        
        // 3. Guardar en historial de leídos
        try {
            DatabaseReference mensajesLeidosRef = realtimeDb.getReference("dispositivos")
                .child(deviceId)
                .child("mensajes_leidos")
                .push();
            
            Map<String, Object> leidoData = new HashMap<>();
            leidoData.put("messageId", messageId != null ? messageId : "unknown");
            leidoData.put("mensaje", mensaje);
            leidoData.put("remitente", remitente);
            leidoData.put("leido_en", now);
            
            mensajesLeidosRef.setValue(leidoData);
            Log.d(TAG, "✓ Guardado en mensajes_leidos");
        } catch (Exception e) {
            Log.e(TAG, "Error guardando en mensajes_leidos: " + e.getMessage());
        }
        
        // 4. Backup en Firestore
        try {
            Map<String, Object> backupEvent = new HashMap<>();
            backupEvent.put("tipo", "MENSAJE_LEIDO");
            backupEvent.put("messageId", messageId != null ? messageId : "unknown");
            backupEvent.put("mensaje", mensaje);
            backupEvent.put("remitente", remitente);
            backupEvent.put("timestamp", now);
            backupEvent.put("deviceId", deviceId);
            
            firestore.collection("eventos_mensajes").add(backupEvent);
            Log.d(TAG, "✓ Backup en Firestore");
        } catch (Exception e) {
            Log.e(TAG, "Error en backup: " + e.getMessage());
        }
        
        Log.d(TAG, "✅ Mensaje marcado como leído completo");
    }
    
    @Override
    public void onBackPressed() {
        // Bloquear botón back - solo se puede salir con el botón ENTENDIDO
        Log.d(TAG, "Back pressed - ignorado");
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        setupImmersiveMode();
        Log.d(TAG, "onResume - MessageActivity visible");
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause - isFinishing: " + isFinishing);
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy - MessageActivity destruida");
    }
}