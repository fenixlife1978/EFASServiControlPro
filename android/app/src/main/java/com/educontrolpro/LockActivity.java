package com.educontrolpro;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;

import java.util.HashMap;
import java.util.Map;

public class LockActivity extends AppCompatActivity {

    private static final String TAG = "EDU_Lock";
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_BLOQUEO_PIN = "bloqueo_pin";

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Evitar que la actividad se cierre si intentan traerla al frente erróneamente
        if ((getIntent().getFlags() & Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT) != 0) {
            // No hacemos finish() aquí para asegurar que el bloqueo persista
        }

        // Configuración de flags para superponerse a todo
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN);

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);

        // --- Diseño de la Interfaz ---
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#1A1A1A"));
        layout.setPadding(60, 60, 60, 60);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("DISPOSITIVO RESTRINGIDO");
        tvTitle.setTextColor(Color.parseColor("#FF4444"));
        tvTitle.setTextSize(28);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 30);

        TextView tvMessage = new TextView(this);
        tvMessage.setText("Esta aplicación o sitio web no está permitido.\n\nRegresa a una actividad educativa o solicita asistencia al docente.");
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(18);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 80);

        EditText inputPin = new EditText(this);
        inputPin.setHint("PIN DE DESBLOQUEO");
        inputPin.setHintTextColor(Color.GRAY);
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.WHITE);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setTextSize(20);
        inputPin.setPadding(20, 20, 20, 20);
        inputPin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);

        // Espaciador
        TextView spacer = new TextView(this);
        spacer.setHeight(40);

        Button btnUnlock = new Button(this);
        btnUnlock.setText("ACCESO DOCENTE / AJUSTES");
        btnUnlock.setBackgroundColor(Color.parseColor("#333333"));
        btnUnlock.setTextColor(Color.WHITE);
        btnUnlock.setPadding(0, 40, 0, 40);
        btnUnlock.setOnClickListener(v -> {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            // El PIN por defecto ahora es más seguro o viene de Firestore
            String pinDispositivo = prefs.getString(KEY_BLOQUEO_PIN, "2024"); 
            String ingresado = inputPin.getText().toString();

            if (ingresado.equals(pinDispositivo)) {
                desbloquearDispositivo(prefs);
            } else {
                Toast.makeText(this, "PIN INCORRECTO", Toast.LENGTH_SHORT).show();
                registrarIntentoFallido(ingresado);
                inputPin.setText("");
            }
        });

        layout.addView(tvTitle);
        layout.addView(tvMessage);
        layout.addView(inputPin);
        layout.addView(spacer);
        layout.addView(btnUnlock);

        setContentView(layout);
    }

    private void desbloquearDispositivo(SharedPreferences prefs) {
        prefs.edit().putBoolean(KEY_UNLOCKED, true).apply();

        if (deviceDocId != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("admin_mode_enable", true);
            updates.put("ultimoDesbloqueo", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).update(updates)
                    .addOnFailureListener(e -> Log.e(TAG, "Error al actualizar nube", e));
        }

        // Al desbloquear, llevamos al docente directamente a los ajustes o app principal
        Intent intent = new Intent(Settings.ACTION_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        finish();
    }

    private void registrarIntentoFallido(String pin) {
        if (deviceDocId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("tipo", "ACCESO_FALLIDO_LOCAL");
        log.put("pin_intentado", pin);
        log.put("timestamp", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId).collection("incidencias").add(log);
    }

    // Bloqueamos el botón "Atrás" completamente
    @Override
    public void onBackPressed() {
        // No hacer nada
    }

    // Bloqueamos el cierre por la lista de apps recientes si es posible
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Esto se ejecuta cuando el usuario intenta ir al Home
        // El MonitorService volverá a lanzar esta actividad inmediatamente
    }
}