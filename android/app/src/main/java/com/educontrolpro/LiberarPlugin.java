package com.educontrolpro;

import com.educontrolpro.MainActivity;
import com.educontrolpro.SimpleLogger;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiberarPlugin")
public class LiberarPlugin extends Plugin {

    @PluginMethod
    public void liberar(PluginCall call) {
        try {
            if (getActivity() instanceof MainActivity) {
                MainActivity mainActivity = (MainActivity) getActivity();
                
                getActivity().runOnUiThread(() -> {
                    mainActivity.liberarDispositivoTotal();
                    
                    JSObject ret = new JSObject();
                    ret.put("status", "success");
                    ret.put("message", "Dispositivo liberado satisfactoriamente");
                    call.resolve(ret);
                });
            } else {
                call.reject("No se pudo obtener la instancia de MainActivity");
            }
        } catch (Exception e) {
            SimpleLogger.e("Error en Plugin Liberar: " + e.getMessage());
            call.reject("Error al procesar liberación: " + e.getMessage());
        }
    }

    @PluginMethod
    public void rebloquear(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MainActivity.class);
            intent.setAction("ACTION_REBLOQUEAR_TAB");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("status", "success");
            ret.put("message", "Comando de rebloqueo enviado");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al enviar comando de rebloqueo: " + e.getMessage());
        }
    }
}