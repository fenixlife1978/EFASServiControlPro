package com.educontrolpro;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiberarPlugin")
public class LiberarPlugin extends Plugin {
    
    private static final String TAG = "LiberarPlugin";

    @PluginMethod
    public void liberar(PluginCall call) {
        try {
            if (getActivity() instanceof MainActivity) {
                MainActivity mainActivity = (MainActivity) getActivity();
                
                getActivity().runOnUiThread(() -> {
                    SimpleLogger.i(TAG, "Ejecutando liberación de dispositivo");
                    mainActivity.liberarDispositivoTotal();
                    
                    JSObject ret = new JSObject();
                    ret.put("status", "success");
                    ret.put("message", "Dispositivo liberado");
                    call.resolve(ret);
                    SimpleLogger.i(TAG, "Liberación completada");
                });
            } else {
                SimpleLogger.e(TAG, "MainActivity no disponible");
                call.reject("No se pudo obtener la instancia de MainActivity");
            }
        } catch (Exception e) {
            SimpleLogger.e(TAG, "Error en liberar: " + e.getMessage());
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void rebloquear(PluginCall call) {
        try {
            SimpleLogger.i(TAG, "Enviando comando de rebloqueo");
            
            Intent intent = new Intent(getContext(), MainActivity.class);
            intent.setAction("ACTION_REBLOQUEAR_TAB");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("status", "success");
            ret.put("message", "Comando enviado");
            call.resolve(ret);
            
            SimpleLogger.i(TAG, "Comando de rebloqueo enviado");
            
        } catch (Exception e) {
            SimpleLogger.e(TAG, "Error en rebloquear: " + e.getMessage());
            call.reject("Error: " + e.getMessage());
        }
    }
}