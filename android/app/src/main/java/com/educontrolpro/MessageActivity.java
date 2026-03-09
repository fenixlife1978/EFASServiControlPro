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
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.util.HashMap;
import java.util.Map;

public class MessageActivity extends AppCompatActivity {

    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private String deviceDocId = null;
    private String mensaje = "";
    private String remitente = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        // Obtener datos del intent
        Intent intent = getIntent();
        mensaje = intent.getStringExtra("mensaje");
        remitente = intent.getStringExtra("remitente");
        if (mensaje == null) mensaje = "Mensaje vacío";
        if (remitente == null) remitente = "Dirección";

        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        deviceDocId = capPrefs.getString("deviceId", null);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.BLACK);
        layout.setPadding(60, 60, 60, 60);

        TextView tvTitle = new TextView(this);
        tvTitle.setText("MENSAJE DE DIRECCIÓN");
        tvTitle.setTextColor(Color.parseColor("#FFA500")); // Naranja
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
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        Map<String, Object> updates = new HashMap<>();
        updates.put("message_viewed", true);
        updates.put("message_readAt", FieldValue.serverTimestamp());
        db.collection("dispositivos").document(deviceDocId)
            .update(updates)
            .addOnFailureListener(e -> Log.e("MessageActivity", "Error marcando como leído", e));
    }

    @Override
    public void onBackPressed() {
        // No permitir retroceder sin marcar como leído
    }
}