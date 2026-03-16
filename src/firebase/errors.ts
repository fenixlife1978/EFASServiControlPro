'use client';
import { getAuth, type User } from 'firebase/auth';

/**
 * Contexto extendido para operaciones de seguridad híbridas.
 */
type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write' | 'read' | 'patch';
  requestResourceData?: any;
};

interface FirebaseAuthToken {
  name: string | null;
  email: string | null;
  email_verified: boolean;
  phone_number: string | null;
  sub: string;
  firebase: {
    identities: Record<string, string[]>;
    sign_in_provider: string;
    tenant: string | null;
  };
}

interface FirebaseAuthObject {
  uid: string;
  token: FirebaseAuthToken;
}

interface SecurityRuleRequest {
  auth: FirebaseAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Estructura de contexto específica para Realtime Database.
 */
interface RTDBSecurityContext {
  auth: FirebaseAuthObject | null;
  data: any;
  newData?: any;
  path: string;
}

/**
 * Construye un objeto auth compatible con las reglas de seguridad de Firebase.
 */
function buildAuthObject(currentUser: User | null): FirebaseAuthObject | null {
  if (!currentUser) return null;

  const token: FirebaseAuthToken = {
    name: currentUser.displayName,
    email: currentUser.email,
    email_verified: currentUser.emailVerified,
    phone_number: currentUser.phoneNumber,
    sub: currentUser.uid,
    firebase: {
      identities: currentUser.providerData.reduce((acc, p) => {
        if (p.providerId) acc[p.providerId] = [p.uid];
        return acc;
      }, {} as Record<string, string[]>),
      sign_in_provider: currentUser.providerData[0]?.providerId || 'custom',
      tenant: currentUser.tenantId,
    },
  };

  return { uid: currentUser.uid, token };
}

/**
 * Clase para errores de Firestore (Documentos y Colecciones).
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    let authObject: FirebaseAuthObject | null = null;
    try {
      const currentUser = getAuth().currentUser;
      if (currentUser) authObject = buildAuthObject(currentUser);
    } catch {}

    const requestObject: SecurityRuleRequest = {
      auth: authObject,
      method: context.operation,
      path: `/databases/(default)/documents/${context.path}`,
      resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
    };

    super(`Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(requestObject, null, 2)}`);
    
    this.name = 'FirestorePermissionError';
    this.request = requestObject;
  }
}

/**
 * Clase para errores de Realtime Database (Nodos de control y tiempo real).
 */
export class RTDBPermissionError extends Error {
  public readonly context: RTDBSecurityContext;

  constructor(context: SecurityRuleContext) {
    let authObject: FirebaseAuthObject | null = null;
    try {
      const currentUser = getAuth().currentUser;
      if (currentUser) authObject = buildAuthObject(currentUser);
    } catch {}

    const rtdbContext: RTDBSecurityContext = {
      auth: authObject,
      data: null, // Representa el estado actual en el nodo
      newData: context.requestResourceData, // Lo que se intentó escribir
      path: context.path,
    };

    super(`Permission Denied: The following operation was denied by Realtime Database Rules:
Path: ${context.path}
Operation: ${context.operation}
Context: ${JSON.stringify(rtdbContext, null, 2)}`);

    this.name = 'RTDBPermissionError';
    this.context = rtdbContext;
  }
}
