'use client';
import React, { useState, useEffect } from 'react';
import { db, rtdb, auth } from '@/firebase/config';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Loader2, UserPlus, ShieldCheck, AlertCircle, CheckCircle, Key } from 'lucide-react';

export default function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    nombre: '', 
    email: '', 
    password: '',
    adminPassword: '', // Contraseña del Super Admin
    role: 'director', 
    InstitutoId: '',
    aulaId: '',
    seccion: ''
  });
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  
  // Guardar el email del Super Admin actual
  const [superAdminEmail, setSuperAdminEmail] = useState<string | null>(null);

  // Obtener el email del Super Admin actual
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setSuperAdminEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Cargar instituciones desde Firestore
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "institutions")), (snapshot) => {
      setInstitutions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Cargar aulas cuando cambia la institución
  useEffect(() => {
    if (!formData.InstitutoId) {
      setAulas([]);
      return;
    }
    const unsub = onSnapshot(collection(db, "institutions", formData.InstitutoId, "Aulas"), (snapshot) => {
      setAulas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [formData.InstitutoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.email || !formData.InstitutoId || !formData.nombre) {
      setError('Completa los campos obligatorios');
      return;
    }
    
    if (!formData.password || formData.password.length < 6) {
      setError('La contraseña del nuevo usuario debe tener al menos 6 caracteres');
      return;
    }
    
    if (!formData.adminPassword) {
      setError('Ingresa tu contraseña de administrador para continuar');
      return;
    }
    
    if (!superAdminEmail) {
      setError('No se pudo identificar la sesión del administrador');
      return;
    }
    
    setLoading(true);

    try {
      const cleanEmail = formData.email.toLowerCase().trim();
      const cleanPassword = formData.password;
      const adminEmail = superAdminEmail;
      const adminPassword = formData.adminPassword;
      
      // 1. CREAR USUARIO EN FIREBASE AUTH (esto cambiará la sesión temporalmente)
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        cleanEmail, 
        cleanPassword
      );
      const user = userCredential.user;
      
      // 2. Generar ID limpio
      const customId = formData.nombre
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      
      // 3. Guardar en RTDB
      const userRTDBRef = ref(rtdb, `usuarios/${user.uid}`);
      await set(userRTDBRef, {
        uid: user.uid,
        id: customId,
        nombre: formData.nombre.trim(),
        email: cleanEmail,
        role: formData.role,
        InstitutoId: formData.InstitutoId,
        aulaId: formData.aulaId || '',
        seccion: formData.seccion || '',
        createdAt: Date.now(),
        status: 'active'
      });
      
      // 4. Guardar por email para búsqueda rápida
      const emailKey = cleanEmail.replace(/\./g, '_');
      const emailRTDBRef = ref(rtdb, `usuarios_por_email/${emailKey}`);
      await set(emailRTDBRef, {
        uid: user.uid,
        nombre: formData.nombre.trim(),
        email: cleanEmail
      });
      
      // 5. Guardar en Firestore
      const userFSRef = doc(db, "usuarios", user.uid);
      await setDoc(userFSRef, {
        uid: user.uid,
        id: customId,
        nombre: formData.nombre.trim(),
        email: cleanEmail,
        role: formData.role,
        InstitutoId: formData.InstitutoId,
        aulaId: formData.aulaId || '',
        seccion: formData.seccion || '',
        createdAt: serverTimestamp(),
        status: 'active'
      });
      
      // 6. IMPORTANTE: Volver a iniciar sesión con el Super Admin
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      
      // 7. Limpiar formulario (mantener solo la contraseña del admin por si quiere crear otro)
      setFormData({ 
        nombre: '', 
        email: '', 
        password: '',
        adminPassword: '', // Limpiar también la contraseña del admin
        role: 'director', 
        InstitutoId: '', 
        aulaId: '', 
        seccion: '' 
      });
      
      setSuccess(`✅ Usuario "${formData.nombre}" creado exitosamente. Email: ${cleanEmail}`);
      
      // Limpiar mensaje de éxito después de 5 segundos
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (error: any) {
      console.error("Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado');
      } else if (error.code === 'auth/weak-password') {
        setError('La contraseña es muy débil. Usa al menos 6 caracteres.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Contraseña de administrador incorrecta');
      } else if (error.code === 'auth/user-not-found') {
        setError('No se encontró la sesión del administrador');
      } else {
        setError(error.message || 'Error al crear usuario');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-xs transition-all placeholder:text-slate-600";
  const selectStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-xs transition-all appearance-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="text-orange-500 w-5 h-5" />
        <h3 className="text-sm font-black uppercase text-white tracking-widest italic">Nuevo Operador</h3>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="text-red-500 w-4 h-4" />
          <span className="text-red-400 text-xs font-bold">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle className="text-green-500 w-4 h-4" />
          <span className="text-green-400 text-xs font-bold">{success}</span>
        </div>
      )}
      
      <input 
        required 
        className={inputStyle} 
        value={formData.nombre} 
        onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
        placeholder="NOMBRE COMPLETO" 
      />
      
      <input 
        required 
        type="email" 
        className={inputStyle} 
        value={formData.email} 
        onChange={(e) => setFormData({...formData, email: e.target.value})} 
        placeholder="CORREO ELECTRÓNICO" 
      />
      
      <input 
        required 
        type="password" 
        className={inputStyle} 
        value={formData.password} 
        onChange={(e) => setFormData({...formData, password: e.target.value})} 
        placeholder="CONTRASEÑA DEL NUEVO USUARIO (mínimo 6 caracteres)" 
      />
      
      <div className="border-t border-slate-800/50 my-4 pt-2">
        <div className="flex items-center gap-2 mb-3">
          <Key className="text-orange-500 w-4 h-4" />
          <p className="text-[9px] font-black text-slate-400 uppercase italic">Verificación de Administrador</p>
        </div>
        <input 
          required 
          type="password" 
          className={inputStyle} 
          value={formData.adminPassword} 
          onChange={(e) => setFormData({...formData, adminPassword: e.target.value})} 
          placeholder="TU CONTRASEÑA DE ADMINISTRADOR" 
        />
        <p className="text-[7px] text-slate-600 mt-1 ml-2">
          Ingresa tu contraseña para confirmar la creación del usuario
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <select className={selectStyle} value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
          <option value="director" style={{color: 'white', backgroundColor: '#1a1d26'}}>Director</option>
          <option value="profesor" style={{color: 'white', backgroundColor: '#1a1d26'}}>Profesor</option>
        </select>
        
        <select 
          required 
          className={selectStyle} 
          value={formData.InstitutoId} 
          onChange={(e) => setFormData({...formData, InstitutoId: e.target.value, aulaId: '', seccion: ''})}
        >
          <option value="" style={{color: 'white', backgroundColor: '#1a1d26'}}>Seleccionar Sede</option>
          {institutions.map(inst => (
            <option key={inst.id} value={inst.id} style={{color: 'white', backgroundColor: '#1a1d26'}}>
              {inst.name || inst.nombre || inst.id}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <select className={selectStyle} value={formData.seccion} onChange={(e) => setFormData({...formData, seccion: e.target.value, aulaId: ''})}>
          <option value="" style={{color: 'white', backgroundColor: '#1a1d26'}}>Sección (Opcional)</option>
          {[...new Set(aulas.map(a => a.seccion))].filter(Boolean).map(sec => (
            <option key={sec} value={sec} style={{color: 'white', backgroundColor: '#1a1d26'}}>{sec}</option>
          ))}
        </select>

        <select className={selectStyle} value={formData.aulaId} onChange={(e) => setFormData({...formData, aulaId: e.target.value})}>
          <option value="" style={{color: 'white', backgroundColor: '#1a1d26'}}>Aula (Opcional)</option>
          {aulas.filter(a => !formData.seccion || a.seccion === formData.seccion).map(aula => (
            <option key={aula.id} value={aula.id} style={{color: 'white', backgroundColor: '#1a1d26'}}>
              {aula.aulaId || aula.nombre || aula.id}
            </option>
          ))}
        </select>
      </div>

      <button 
        disabled={loading} 
        type="submit" 
        className="w-full bg-slate-900 hover:bg-orange-500 text-white font-black italic uppercase py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 text-xs mt-4 border border-slate-800 disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
        {loading ? 'Creando...' : 'Vincular al Sistema'}
      </button>
      
      <p className="text-[8px] text-slate-500 text-center mt-4">
        El usuario recibirá un correo de verificación automáticamente
      </p>
    </form>
  );
}
