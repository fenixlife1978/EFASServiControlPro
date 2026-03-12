package com.educontrolpro;

import android.os.Bundle;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.EditText;
import android.widget.Button;
import android.widget.LinearLayout;
import android.graphics.Color;
import android.view.Gravity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.Toast;
import android.content.Context;

import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.util.HashMap;
import java.util.Map;

public class LockActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_BLOQUEO_PIN = "bloqueo_pin";
    private static final String KEY_MASTER_PIN = "master_pin";

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId = null;
    private String sitioBloqueado = "";
    private String tipoBloqueo = "SITIO";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Obtener datos del intent
        if (getIntent() != null) {
            if (getIntent().hasExtra("sitio_bloqueado")) {
                sitioBloqueado = getIntent().getStringExtra("sitio_bloqueado");
                tipoBloqueo = "SITIO";
            } else if (getIntent().hasExtra("tipo_bloqueo") && 
                       getIntent().getStringExtra("tipo_bloqueo").equals("CONFIGURACION")) {
                tipoBloqueo = "CONFIGURACION";
                sitioBloqueado = "Ajustes del sistema";
            }
        }

        // Bloquear solo esta actividad
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);

        // UI
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#1A1A1A"));
        layout.setPadding(60, 60, 60, 60);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("⚠️ ACCESO RESTRINGIDO");
        tvTitle.setTextColor(Color.parseColor("#FF4444"));
        tvTitle.setTextSize(24);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 20);

        TextView tvMessage = new TextView(this);
        if (tipoBloqueo.equals("CONFIGURACION")) {
            tvMessage.setText("No tienes permiso para acceder a Ajustes.\n\nPresiona SALIR para volver al inicio.");
        } else if (!sitioBloqueado.isEmpty()) {
            tvMessage.setText("El sitio \"" + sitioBloqueado + "\" no está permitido.\n\nPresiona SALIR DEL SITIO para continuar.");
        } else {
            tvMessage.setText("Esta acción no está permitida.\n\nPresiona SALIR DEL SITIO para continuar.");
        }
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(16);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 40);

        // Botón "SALIR"
        Button btnExit = new Button(this);
        btnExit.setText(tipoBloqueo.equals("CONFIGURACION") ? "🚪 SALIR" : "🚪 SALIR DEL SITIO");
        btnExit.setPadding(0, 30, 0, 30);
        btnExit.setTextSize(18);
        btnExit.setBackgroundColor(Color.parseColor("#4CAF50"));
        btnExit.setTextColor(Color.WHITE);
        
        btnExit.setOnClickListener(v -> {
            // Registrar salida voluntaria
            if (deviceDocId != null) {
                Map<String, Object> log = new HashMap<>();
                log.put("tipo", tipoBloqueo.equals("CONFIGURACION") ? "INTENTO_CONFIGURACION" : "SALIDA_VOLUNTARIA");
                log.put("sitio", sitioBloqueado);
                log.put("timestamp", FieldValue.serverTimestamp());
                db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(log);
            }
            
            // Simplemente cerrar la actividad
            Toast.makeText(this, "Puedes continuar usando el dispositivo", Toast.LENGTH_SHORT).show();
            finish();
        });

        // Separador
        TextView tvSeparator = new TextView(this);
        tvSeparator.setText("──────────  O  ──────────");
        tvSeparator.setTextColor(Color.GRAY);
        tvSeparator.setGravity(Gravity.CENTER);
        tvSeparator.setPadding(0, 30, 0, 30);
        
        // Área de PIN para desbloqueo PERMANENTE
        TextView tvPinTitle = new TextView(this);
        tvPinTitle.setText("🔑 DESBLOQUEO PERMANENTE");
        tvPinTitle.setTextColor(Color.parseColor("#FFA500"));
        tvPinTitle.setTextSize(16);
        tvPinTitle.setGravity(Gravity.CENTER);
        tvPinTitle.setPadding(0, 20, 0, 10);

        EditText inputPin = new EditText(this);
        inputPin.setHint("PIN de 8 dígitos");
        inputPin.setHintTextColor(Color.LTGRAY);
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.WHITE);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        inputPin.setMaxLines(1);
        
        Button btnUnlock = new Button(this);
        btnUnlock.setText("DESBLOQUEAR PERMANENTEMENTE");
        btnUnlock.setPadding(0, 20, 0, 20);
        btnUnlock.setTextSize(14);
        btnUnlock.setBackgroundColor(Color.parseColor("#FFA500"));
        btnUnlock.setTextColor(Color.WHITE);
        
        btnUnlock.setOnClickListener(v -> {
            String ingresado = inputPin.getText().toString().trim();
            
            if (ingresado.length() != 8) {
                Toast.makeText(this, "❌ El PIN debe tener 8 dígitos", Toast.LENGTH_SHORT).show();
                inputPin.setText("");
                return;
            }

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String pinDocente = prefs.getString(KEY_BLOQUEO_PIN, "12345678");
            String masterPin = prefs.getString(KEY_MASTER_PIN, "00000000");

            if (ingresado.equals(pinDocente) || ingresado.equals(masterPin)) {
                desbloquearPermanente();
            } else {
                Toast.makeText(this, "❌ PIN INCORRECTO", Toast.LENGTH_SHORT).show();
                registrarIntentoFallido(ingresado);
                inputPin.setText("");
            }
        });

        layout.addView(tvTitle);
        layout.addView(tvMessage);
        layout.addView(btnExit);
        layout.addView(tvSeparator);
        layout.addView(tvPinTitle);
        layout.addView(inputPin);
        layout.addView(btnUnlock);

        setContentView(layout);
    }

    private void desbloquearPermanente() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_UNLOCKED, true)
                .apply();

        if (deviceDocId != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("admin_mode_enable", true);
            updates.put("ultimoDesbloqueo", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).update(updates);
            
            Map<String, Object> log = new HashMap<>();
            log.put("tipo", "DESBLOQUEO_PERMANENTE");
            log.put("timestamp", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(log);
        }

        Toast.makeText(this, "✅ Dispositivo desbloqueado permanentemente", Toast.LENGTH_LONG).show();
        
        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
        homeIntent.addCategory(Intent.CATEGORY_HOME);
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(homeIntent);
        
        finish();
    }

    private void registrarIntentoFallido(String pin) {
        if (deviceDocId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("tipo", "ACCESO_FALLIDO_LOCAL");
        log.put("pin", pin);
        log.put("sitio", sitioBloqueado);
        log.put("timestamp", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(log);
    }

    @Override
    public void onBackPressed() {
        // Bloqueamos el back button
    }
}