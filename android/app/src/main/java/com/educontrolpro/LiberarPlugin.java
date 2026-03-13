package com.educontrolpro;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiberarPlugin")
public class LiberarPlugin extends Plugin {

    // Cambié el nombre a 'liberar' para que coincida con lo que suele llamar el botón
    @PluginMethod
    public void liberar(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MainActivity.class);
            // Esta acción debe ser procesada en el onNewIntent de MainActivity si quieres que sea instantáneo
            intent.setAction("ACTION_LIBERAR_TAB");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("status", "success");
            ret.put("message", "Comando de liberación enviado al sistema nativo");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al enviar comando de liberación: " + e.getMessage());
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