// Exportamos todo desde config (aquí están useAuth, useFirestore, useUser y las claves)
export * from './config';

// Exportamos el nuevo proveedor y el contexto unificado
export * from './client-provider';

// Exportamos el resto de utilidades
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
