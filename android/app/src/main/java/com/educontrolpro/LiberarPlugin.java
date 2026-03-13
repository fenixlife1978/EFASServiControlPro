package com.educontrolpro;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiberarPlugin")
public class LiberarPlugin extends Plugin {

    /**
     * Llama al proceso de liberación total. 
     * Se usa 'runOnUiThread' para asegurar que el cambio de permisos de sistema
     * y el cierre de la VPN no bloqueen la app.
     */
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

    /**
     * Reinicia el flujo de seguridad (Admin + VPN)
     */
    @PluginMethod
    public void rebloquear(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MainActivity.class);
            // Esta acción disparará el flujo normal de onCreate/onNewIntent en MainActivity
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