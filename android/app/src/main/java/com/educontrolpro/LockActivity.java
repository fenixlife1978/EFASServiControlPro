package com.educontrolpro;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import android.widget.TextView;
import android.widget.EditText;
import android.widget.Button;
import android.widget.LinearLayout;
import android.graphics.Color;
import android.view.Gravity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.Toast;
import android.provider.Settings;
import android.util.Log;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.util.HashMap;
import java.util.Map;

public class LockActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_BLOQUEO_PIN = "bloqueo_pin";

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId = null;
    
    private Handler autoCloseHandler = new Handler(Looper.getMainLooper());
    private Runnable autoCloseRunnable;
    private int secondsRemaining = 8;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Bloqueo total de interacción con el sistema
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN);

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);

        // UI Dinámica
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#1A1A1A")); // Gris muy oscuro, más profesional
        layout.setPadding(60, 60, 60, 60);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("CONTENIDO RESTRINGIDO");
        tvTitle.setTextColor(Color.parseColor("#FF4444"));
        tvTitle.setTextSize(26);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 20);

        TextView tvTimer = new TextView(this);
        tvTimer.setText("Retornando en: 8s");
        tvTimer.setTextColor(Color.YELLOW);
        tvTimer.setTextSize(16);
        tvTimer.setGravity(Gravity.CENTER);
        tvTimer.setPadding(0, 0, 0, 40);

        TextView tvMessage = new TextView(this);
        tvMessage.setText("El acceso a este sitio o app no está permitido en horario escolar.");
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(16);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 60);

        EditText inputPin = new EditText(this);
        inputPin.setHint("PIN DOCENTE");
        inputPin.setHintTextColor(Color.LTGRAY);
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.WHITE);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        
        Button btnUnlock = new Button(this);
        btnUnlock.setText("DESBLOQUEAR (MODO DOCENTE)");
        btnUnlock.setPadding(0, 30, 0, 30);
        btnUnlock.setOnClickListener(v -> {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String pinDispositivo = prefs.getString(KEY_BLOQUEO_PIN, "1234"); // Default seguro
            String ingresado = inputPin.getText().toString();

            if (ingresado.equals(pinDispositivo)) {
                cancelarAutoCierre();
                desbloquearDispositivo(prefs);
            } else {
                Toast.makeText(this, "PIN INCORRECTO", Toast.LENGTH_SHORT).show();
                registrarIntentoFallido(ingresado);
                inputPin.setText("");
            }
        });

        layout.addView(tvTitle);
        layout.addView(tvTimer);
        layout.addView(tvMessage);
        layout.addView(inputPin);
        layout.addView(btnUnlock);

        setContentView(layout);

        iniciarCuentaRegresiva(tvTimer);
    }

    private void iniciarCuentaRegresiva(TextView tv) {
        autoCloseRunnable = new Runnable() {
            @Override
            public void run() {
                if (secondsRemaining > 0) {
                    secondsRemaining--;
                    tv.setText("Retornando en: " + secondsRemaining + "s");
                    autoCloseHandler.postDelayed(this, 1000);
                } else {
                    finish();
                }
            }
        };
        autoCloseHandler.postDelayed(autoCloseRunnable, 1000);
    }

    private void cancelarAutoCierre() {
        if (autoCloseHandler != null) autoCloseHandler.removeCallbacksAndMessages(null);
    }

    private void desbloquearDispositivo(SharedPreferences prefs) {
        prefs.edit().putBoolean(KEY_UNLOCKED, true).apply();

        if (deviceDocId != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("admin_mode_enable", true);
            updates.put("ultimoDesbloqueo", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).update(updates);
        }

        startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }

    private void registrarIntentoFallido(String pin) {
        if (deviceDocId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("tipo", "ACCESO_FALLIDO_LOCAL");
        log.put("pin", pin);
        log.put("timestamp", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(log);
    }

    @Override
    public void onBackPressed() { /* Bloqueado */ }

    @Override
    protected void onPause() {
        super.onPause();
        // Si intentan usar el botón de "Recientes" para salir, la traemos de vuelta
        if (secondsRemaining > 0) {
            Intent intent = new Intent(this, LockActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(intent);
        }
    }
}