package com.educontrolpro;

import android.os.Bundle;
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
    private static final String KEY_MASTER_PIN = "master_pin";

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.BLACK);
        layout.setPadding(60, 60, 60, 60);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("ACCESO NO PERMITIDO");
        tvTitle.setTextColor(Color.RED);
        tvTitle.setTextSize(24);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(Gravity.CENTER);
        tvTitle.setPadding(0, 0, 0, 30);

        TextView tvMessage = new TextView(this);
        tvMessage.setText("EDUControlPro ha bloqueado este acceso por razones de seguridad.\n\nSi eres docente, introduce tu PIN para continuar.");
        tvMessage.setTextColor(Color.WHITE);
        tvMessage.setTextSize(18);
        tvMessage.setGravity(Gravity.CENTER);
        tvMessage.setPadding(0, 0, 0, 50);

        EditText inputPin = new EditText(this);
        inputPin.setHint("INTRODUCE PIN DOCENTE");
        inputPin.setHintTextColor(Color.GRAY);
        inputPin.setTextColor(Color.BLACK);
        inputPin.setBackgroundColor(Color.WHITE);
        inputPin.setGravity(Gravity.CENTER);
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        inputPin.setPadding(20, 20, 20, 20);

        Button btnUnlock = new Button(this);
        btnUnlock.setText("INGRESAR");
        btnUnlock.setOnClickListener(v -> {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String pinDispositivo = prefs.getString(KEY_BLOQUEO_PIN, "");
            String pinMaestro = prefs.getString(KEY_MASTER_PIN, "1234");
            String ingresado = inputPin.getText().toString();

            if (ingresado.equals(pinDispositivo) || ingresado.equals(pinMaestro)) {
                desbloquearDispositivo(prefs);
            } else {
                Toast.makeText(this, "PIN Incorrecto - Intento registrado", Toast.LENGTH_SHORT).show();
                registrarIntentoFallido(ingresado);
            }
        });

        Button btnEmergency = new Button(this);
        btnEmergency.setText("CONTACTAR SOPORTE");
        btnEmergency.setBackgroundColor(Color.parseColor("#333333"));
        btnEmergency.setTextColor(Color.WHITE);
        btnEmergency.setOnClickListener(v -> {
            Toast.makeText(this, "Comunícate con el administrador de la sede", Toast.LENGTH_LONG).show();
        });

        layout.addView(tvTitle);
        layout.addView(tvMessage);
        layout.addView(inputPin);
        layout.addView(btnUnlock);
        layout.addView(btnEmergency);

        setContentView(layout);
    }

    private void desbloquearDispositivo(SharedPreferences prefs) {
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean(KEY_UNLOCKED, true);
        editor.apply();

        if (deviceDocId != null) {
            Map<String, Object> updates = new HashMap<>();
            updates.put("admin_mode_enable", true);
            updates.put("ultimoAcceso", FieldValue.serverTimestamp());
            updates.put("ultimoDesbloqueo", FieldValue.serverTimestamp());

            db.collection("dispositivos").document(deviceDocId)
                .update(updates)
                .addOnSuccessListener(aVoid -> Log.d("LockActivity", "Dispositivo desbloqueado en Firestore"))
                .addOnFailureListener(e -> Log.e("LockActivity", "Error actualizando Firestore", e));
        }

        Toast.makeText(this, "MODO ADMINISTRADOR ACTIVADO", Toast.LENGTH_SHORT).show();

        Intent intent = new Intent(Settings.ACTION_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);

        finish();
    }

    private void registrarIntentoFallido(String pinIngresado) {
        if (deviceDocId == null) return;

        Map<String, Object> intento = new HashMap<>();
        intento.put("tipo", "PIN_INCORRECTO");
        intento.put("pin_intentado", pinIngresado);
        intento.put("timestamp", FieldValue.serverTimestamp());
        intento.put("deviceId", deviceDocId);

        db.collection("dispositivos").document(deviceDocId)
            .collection("intentos_fallidos")
            .add(intento)
            .addOnFailureListener(e -> Log.e("LockActivity", "Error registrando intento", e));
    }

    @Override
    public void onBackPressed() {
        Toast.makeText(this, "Acción no permitida", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        Intent intent = new Intent(this, LockActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }
}
