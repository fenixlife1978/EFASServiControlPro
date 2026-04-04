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

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

public class BlockActivity extends AppCompatActivity {
    
    private static final String TAG = "BlockActivity";
    private FirebaseDatabase realtimeDb;
    private DatabaseReference blindajeRef;
    private ValueEventListener blindajeListener;
    
    private String tipoBloqueo = "";
    private String deviceId = "";
    private String mensajePersonalizado = "";
    private boolean isFinishing = false;
    private boolean isCreated = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "=== BlockActivity onCreate ===");
        
        if (isCreated) {
            Log.d(TAG, "Activity ya creada, finalizando instancia duplicada");
            finish();
            return;
        }
        isCreated = true;
        
        // Configuración de ventana de Máxima Prioridad
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN);
        
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        
        // Pantalla completa
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);

        realtimeDb = FirebaseDatabase.getInstance();
        
        // Extraer datos del Intent
        tipoBloqueo = getIntent().getStringExtra("tipo_bloqueo");
        deviceId = getIntent().getStringExtra("deviceId");
        mensajePersonalizado = getIntent().getStringExtra("mensaje");
        
        Log.d(TAG, "Tipo bloqueo: " + tipoBloqueo);

        // Construir Interfaz
        crearInterfazProfesional();

        // Escuchar desbloqueo para blindaje total (solo si se desactiva desde el panel)
        if ("blindaje_total".equals(tipoBloqueo) && deviceId != null && !deviceId.equals("student_unknown")) {
            configurarEscuchaDesbloqueo(deviceId);
        }
    }

    private void configurarEscuchaDesbloqueo(String deviceId) {
        blindajeRef = realtimeDb.getReference("status_dispositivos").child(deviceId).child("shield_mode_enable");
        blindajeListener = new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                Boolean activo = snapshot.getValue(Boolean.class);
                Log.d(TAG, "Estado blindaje: " + activo);
                if (activo != null && !activo && !isFinishing) {
                    Log.d(TAG, "Blindaje desactivado desde panel - cerrando bloqueo");
                    limpiarTodoYSalir();
                }
            }
            @Override
            public void onCancelled(DatabaseError error) {
                Log.e(TAG, "Error escuchando desbloqueo: " + error.getMessage());
            }
        };
        blindajeRef.addValueEventListener(blindajeListener);
    }

    private void crearInterfazProfesional() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(40, 40, 40, 40);
        
        GradientDrawable gradient = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.parseColor("#1a1a2e"), Color.parseColor("#16213e"), Color.parseColor("#0f0f1f")}
        );
        layout.setBackground(gradient);

        Animation fadeIn = AnimationUtils.loadAnimation(this, android.R.anim.fade_in);
        fadeIn.setDuration(500);

        // --- ICONO SEGÚN TIPO DE BLOQUEO ---
        ImageView icon = new ImageView(this);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(180, 180);
        iconParams.bottomMargin = 40;
        icon.setLayoutParams(iconParams);
        
        if ("mensaje_director".equals(tipoBloqueo)) {
            icon.setImageResource(android.R.drawable.ic_dialog_email);
            icon.setColorFilter(Color.parseColor("#00BFFF"));
        } else {
            // Blindaje total
            icon.setImageResource(android.R.drawable.ic_lock_lock);
            icon.setColorFilter(Color.parseColor("#FF4444"));
        }
        icon.startAnimation(fadeIn);
        
        // --- TÍTULO PRINCIPAL ---
        TextView txtTitle = new TextView(this);
        txtTitle.setTextSize(28);
        txtTitle.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        txtTitle.setGravity(Gravity.CENTER);
        txtTitle.setPadding(0, 0, 0, 20);
        
        String titulo = "";
        if ("blindaje_total".equals(tipoBloqueo)) {
            titulo = "⚠️ BLOQUEO TOTAL ⚠️";
            txtTitle.setTextColor(Color.parseColor("#FF4444"));
        } else if ("mensaje_director".equals(tipoBloqueo)) {
            titulo = "📨 MENSAJE DE DIRECCIÓN";
            txtTitle.setTextColor(Color.parseColor("#00BFFF"));
        } else {
            titulo = "🔒 SISTEMA BLOQUEADO";
            txtTitle.setTextColor(Color.WHITE);
        }
        txtTitle.setText(titulo);
        txtTitle.startAnimation(fadeIn);

        // --- MENSAJE DESCRIPTIVO ---
        TextView txtMessage = new TextView(this);
        txtMessage.setTextSize(18);
        txtMessage.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        txtMessage.setGravity(Gravity.CENTER);
        txtMessage.setPadding(40, 20, 40, 30);
        txtMessage.setTextColor(Color.parseColor("#CCCCCC"));
        
        String mensaje = mensajePersonalizado;
        if (mensaje == null || mensaje.isEmpty()) {
            if ("blindaje_total".equals(tipoBloqueo)) {
                mensaje = "El dispositivo ha sido bloqueado por seguridad.\n\nContacta a tu profesor para desbloquear.";
            } else if ("mensaje_director".equals(tipoBloqueo)) {
                mensaje = "Mensaje desde la dirección del centro educativo.";
            } else {
                mensaje = "El sistema ha sido bloqueado por medidas de seguridad.";
            }
        }
        txtMessage.setText(mensaje);
        txtMessage.startAnimation(fadeIn);

        View divider = new View(this);
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 2);
        dividerParams.topMargin = 20;
        dividerParams.bottomMargin = 30;
        divider.setLayoutParams(dividerParams);
        divider.setBackgroundColor(Color.parseColor("#FFA500"));

        // --- INSTRUCCIÓN PARA CERRAR ---
        TextView txtWarning = new TextView(this);
        txtWarning.setTextSize(12);
        txtWarning.setTypeface(Typeface.create("sans-serif", Typeface.ITALIC));
        txtWarning.setGravity(Gravity.CENTER);
        txtWarning.setTextColor(Color.parseColor("#888888"));
        txtWarning.setPadding(0, 20, 0, 0);
        
        if ("mensaje_director".equals(tipoBloqueo)) {
            txtWarning.setText("⏺ Para continuar, presiona el botón ENTENDIDO");
        } else {
            txtWarning.setText("⏺ Este bloqueo solo puede ser removido por un administrador autorizado");
        }

        layout.addView(icon);
        layout.addView(txtTitle);
        layout.addView(txtMessage);
        layout.addView(divider);
        layout.addView(txtWarning);
        
        // --- BOTÓN ENTENDIDO (SOLO PARA MENSAJES DEL DIRECTOR) ---
        if ("mensaje_director".equals(tipoBloqueo)) {
            Button btnEntendido = new Button(this);
            btnEntendido.setText("ENTENDIDO");
            btnEntendido.setTextColor(Color.BLACK);
            btnEntendido.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
            btnEntendido.setTextSize(16);
            
            GradientDrawable btnShape = new GradientDrawable();
            btnShape.setCornerRadius(30);
            btnShape.setColor(Color.WHITE);
            btnEntendido.setBackground(btnShape);
            
            LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, 120);
            btnParams.topMargin = 50;
            btnParams.leftMargin = 40;
            btnParams.rightMargin = 40;
            btnEntendido.setLayoutParams(btnParams);
            
            btnEntendido.setOnClickListener(v -> confirmarLecturaYSalir());
            layout.addView(btnEntendido);
        }

        setContentView(layout);
    }

    private void confirmarLecturaYSalir() {
        if (deviceId != null && !deviceId.equals("student_unknown")) {
            DatabaseReference msgRef = realtimeDb.getReference("mensajes_dispositivos")
                    .child(deviceId).child("ultimo_mensaje");
            msgRef.child("leido").setValue(true);
            msgRef.child("fecha_lectura").setValue(System.currentTimeMillis());
        }
        limpiarTodoYSalir();
    }

    private void limpiarTodoYSalir() {
        if (isFinishing) return;
        isFinishing = true;
        
        Log.d(TAG, "Limpiando y saliendo de BlockActivity");
        
        if (blindajeRef != null && blindajeListener != null) {
            blindajeRef.removeEventListener(blindajeListener);
        }
        
        // Volver al home
        Intent startMain = new Intent(Intent.ACTION_MAIN);
        startMain.addCategory(Intent.CATEGORY_HOME);
        startMain.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(startMain);
        
        // Finalizar esta actividad
        finish();
    }

    @Override
    public void onBackPressed() {
        // Bloquear botón back
        Log.d(TAG, "Back pressed - ignorado");
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d(TAG, "onResume");
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause - isFinishing: " + isFinishing);
        // No relanzar nada
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy");
        isCreated = false;
    }
}