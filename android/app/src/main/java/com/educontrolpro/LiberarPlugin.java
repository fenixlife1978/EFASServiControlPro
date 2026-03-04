package com.educontrolpro;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiberarPlugin")
public class LiberarPlugin extends Plugin {

    @PluginMethod
    public void ejecutarLiberacion(PluginCall call) {
        // Esta es la señal que el MainActivity está esperando
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setAction("ACTION_LIBERAR_TAB");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        
        // Enviamos la orden al MainActivity
        getContext().startActivity(intent);

        // Le avisamos a React que todo salió bien
        JSObject ret = new JSObject();
        ret.put("status", "comando_enviado");
        call.resolve(ret);
    }
}