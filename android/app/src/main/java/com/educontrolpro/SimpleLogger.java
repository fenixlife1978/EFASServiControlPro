package com.educontrolpro;

import android.util.Log;

public class SimpleLogger {
    private static final String TAG = "EduControlPro";
    
    // Control de logs - Cambiar a false para producción
    private static final boolean ENABLE_LOGS = true;
    private static final boolean ENABLE_VERBOSE = true;

    // Niveles de Log
    public static void v(String message) {
        if (ENABLE_LOGS && ENABLE_VERBOSE) {
            Log.v(TAG, message);
        }
    }

    public static void i(String message) {
        if (ENABLE_LOGS) {
            Log.i(TAG, message);
        }
    }

    public static void d(String message) {
        if (ENABLE_LOGS) {
            Log.d(TAG, message);
        }
    }

    public static void w(String message) {
        if (ENABLE_LOGS) {
            Log.w(TAG, message);
        }
    }

    public static void e(String message) {
        if (ENABLE_LOGS) {
            Log.e(TAG, message);
        }
    }
    
    public static void wtf(String message) {
        if (ENABLE_LOGS) {
            Log.wtf(TAG, message);
        }
    }

    // Versiones con TAG personalizado para mejor organización
    public static void v(String tag, String message) {
        if (ENABLE_LOGS && ENABLE_VERBOSE) {
            Log.v(TAG + "/" + tag, message);
        }
    }

    public static void i(String tag, String message) {
        if (ENABLE_LOGS) {
            Log.i(TAG + "/" + tag, message);
        }
    }

    public static void d(String tag, String message) {
        if (ENABLE_LOGS) {
            Log.d(TAG + "/" + tag, message);
        }
    }

    public static void w(String tag, String message) {
        if (ENABLE_LOGS) {
            Log.w(TAG + "/" + tag, message);
        }
    }

    public static void e(String tag, String message) {
        if (ENABLE_LOGS) {
            Log.e(TAG + "/" + tag, message);
        }
    }
    
    public static void wtf(String tag, String message) {
        if (ENABLE_LOGS) {
            Log.wtf(TAG + "/" + tag, message);
        }
    }
    
    // Métodos para registro de eventos importantes con formato estructurado
    public static void logEvent(String category, String action, String detail) {
        if (ENABLE_LOGS) {
            String eventLog = String.format("[EVENT] %s | %s | %s | %d", 
                category, action, detail, System.currentTimeMillis());
            Log.i(TAG + "/Events", eventLog);
        }
    }
    
    public static void logSecurity(String action, String detail) {
        if (ENABLE_LOGS) {
            String securityLog = String.format("[SECURITY] %s | %s | %d", 
                action, detail, System.currentTimeMillis());
            Log.w(TAG + "/Security", securityLog);
        }
    }
    
    public static void logBlock(String tipo, String motivo, String deviceId) {
        if (ENABLE_LOGS) {
            String blockLog = String.format("[BLOCK] Tipo: %s | Motivo: %s | Device: %s | %d", 
                tipo, motivo, deviceId, System.currentTimeMillis());
            Log.w(TAG + "/Block", blockLog);
        }
    }
    
    // Método para registrar errores con stacktrace
    public static void logError(String tag, String message, Throwable throwable) {
        if (ENABLE_LOGS) {
            Log.e(TAG + "/" + tag, message, throwable);
        }
    }
    
    // Método para registrar inicio de métodos importantes
    public static void logMethodEntry(String className, String methodName) {
        if (ENABLE_LOGS && ENABLE_VERBOSE) {
            Log.d(TAG + "/Trace", "→ " + className + "." + methodName + "()");
        }
    }
    
    // Método para registrar salida de métodos importantes
    public static void logMethodExit(String className, String methodName) {
        if (ENABLE_LOGS && ENABLE_VERBOSE) {
            Log.d(TAG + "/Trace", "← " + className + "." + methodName + "()");
        }
    }
    
    // Método para obtener el estado actual de logs
    public static boolean isLoggingEnabled() {
        return ENABLE_LOGS;
    }
    
    // Método para obtener información de versión
    public static void logVersionInfo(String versionName, int versionCode) {
        if (ENABLE_LOGS) {
            Log.i(TAG, "========================================");
            Log.i(TAG, "EduControlPro v" + versionName + " (" + versionCode + ")");
            Log.i(TAG, "Logs habilitados: " + ENABLE_LOGS);
            Log.i(TAG, "Modo verbose: " + ENABLE_VERBOSE);
            Log.i(TAG, "========================================");
        }
    }
}