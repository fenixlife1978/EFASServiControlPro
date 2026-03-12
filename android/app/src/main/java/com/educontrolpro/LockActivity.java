package com.educontrolpro;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.TextView;
import android.widget.EditText;
import android.widget.Button;
import android.widget.LinearLayout;
import android.graphics.Color;
import android.view.Gravity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.Toast;

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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Obtener el sitio bloqueado
        if (getIntent() != null && getIntent().hasExtra("sitio_bloqueado")) {
            sitioBloqueado = getIntent().getStringExtra("sitio_bloqueado");
        }

        // Bloqueo total - evitar que el usuario salga
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN);

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);

        // UI
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#1A1A1A"));
        layout.setPadding(60, 60, 60, 60);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("🔒 ACCESO RESTRINGIDO");
        tvTitle.setTextColor(Color.parseColor("#FF4444"));
        tvTitle.setTextSize(26);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 20);

        TextView tvMessage = new TextView(this);
        if (!sitioBloqueado.isEmpty()) {
            tvMessage.setText("⛔ Sitio bloqueado:\n\n" + sitioBloqueado + "\n\nPara desbloquear, ingresa el PIN de 8 dígitos");
        } else {
            tvMessage.setText("⛔ Acceso no permitido\n\nPara desbloquear, ingresa el PIN de 8 dígitos");
        }
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(18);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 60);

        EditText inputPin = new EditText(this);
        inputPin.setHint("🔑 PIN (8 DÍGITOS)");
        inputPin.setHintTextColor(Color.LTGRAY);
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.WHITE);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        inputPin.setMaxLines(1);
        
        Button btnUnlock = new Button(this);
        btnUnlock.setText("DESBLOQUEAR");
        btnUnlock.setPadding(0, 30, 0, 30);
        btnUnlock.setTextSize(16);
        btnUnlock.setBackgroundColor(Color.parseColor("#4CAF50"));
        btnUnlock.setTextColor(Color.WHITE);
        
        btnUnlock.setOnClickListener(v -> {
            String ingresado = inputPin.getText().toString().trim();
            
            // Verificar longitud 8 dígitos
            if (ingresado.length() != 8) {
                Toast.makeText(this, "❌ El PIN debe tener 8 dígitos", Toast.LENGTH_SHORT).show();
                inputPin.setText("");
                return;
            }

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String pinDocente = prefs.getString(KEY_BLOQUEO_PIN, "12345678");
            String masterPin = prefs.getString(KEY_MASTER_PIN, "00000000");

            if (ingresado.equals(pinDocente) || ingresado.equals(masterPin)) {
                desbloquearDispositivo();
            } else {
                Toast.makeText(this, "❌ PIN INCORRECTO", Toast.LENGTH_SHORT).show();
                registrarIntentoFallido(ingresado);
                inputPin.setText("");
            }
        });

        // Botón "SALIR DEL SITIO" - Limpia y cierra el bloqueo
        Button btnExit = new Button(this);
        btnExit.setText("🚪 SALIR DEL SITIO");
        btnExit.setPadding(0, 30, 0, 30);
        btnExit.setTextSize(16);
        btnExit.setBackgroundColor(Color.parseColor("#FF4444"));
        btnExit.setTextColor(Color.WHITE);
        
        btnExit.setOnClickListener(v -> {
            // Registrar salida voluntaria
            if (deviceDocId != null) {
                Map<String, Object> log = new HashMap<>();
                log.put("tipo", "SALIDA_VOLUNTARIA");
                log.put("sitio", sitioBloqueado);
                log.put("timestamp", FieldValue.serverTimestamp());
                db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(log);
            }
            
            // Cerrar bloqueo - permitir nueva búsqueda
            finish();
        });

        layout.addView(tvTitle);
        layout.addView(tvMessage);
        layout.addView(inputPin);
        layout.addView(btnUnlock);
        
        // Separador
        TextView tvSeparator = new TextView(this);
        tvSeparator.setText("──────────  O  ──────────");
        tvSeparator.setTextColor(Color.GRAY);
        tvSeparator.setGravity(Gravity.CENTER);
        tvSeparator.setPadding(0, 30, 0, 30);
        layout.addView(tvSeparator);
        
        layout.addView(btnExit);

        setContentView(layout);
    }

    private void desbloquearDispositivo() {
        // Marcar como desbloqueado
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_UNLOCKED, true)
                .apply();

        if (deviceDocId != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("admin_mode_enable", true);
            updates.put("ultimoDesbloqueo", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).update(updates);
            
            // Registrar desbloqueo
            Map<String, Object> log = new HashMap<>();
            log.put("tipo", "DESBLOQUEO_EXITOSO");
            log.put("sitio", sitioBloqueado);
            log.put("timestamp", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(log);
        }

        Toast.makeText(this, "✅ Dispositivo desbloqueado", Toast.LENGTH_SHORT).show();
        
        // Ir a home
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
        // Bloqueado - no hacer nada
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Si intentan minimizar, regresar
        Intent intent = new Intent(this, LockActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        if (!sitioBloqueado.isEmpty()) {
            intent.putExtra("sitio_bloqueado", sitioBloqueado);
        }
        startActivity(intent);
    }
}