'use client';
import React, { useState } from 'react';
import { db, auth } from '@/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { useRouter } from 'next/navigation';

export default function RegistroPersonal() {
  const { institutionId } = useInstitution();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('profesor');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const isSuperAdmin = auth.currentUser?.email === 'vallecondo@gmail.com';

  const manejarRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        nombre: nombre,
        email: email,
        rol: isSuperAdmin ? rol : 'profesor',
        InstitutoId: institutionId,
        fechaRegistro: new Date().toISOString()
      });

      setMensaje({ tipo: 'exito', texto: `¡Perfecto! El ${rol} ha sido registrado.` });
      setEmail(''); setPassword(''); setNombre('');
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: "Error: " + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <button 
        onClick={() => router.back()}
        className="mb-8 flex items-center gap-3 text-slate-400 hover:text-orange-500 font-black uppercase text-[10px] tracking-widest transition-all group"
      >
        <span className="bg-white h-10 w-10 flex items-center justify-center rounded-full shadow-sm group-hover:shadow-orange-200 group-hover:scale-110 transition-all text-lg font-bold">
          ←
        </span>
        Volver
      </button>

      <div className="max-w-2xl bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-black italic uppercase text-slate-900 tracking-tighter leading-none">
            Registro de <span className="text-orange-500">Personal</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">
            {isSuperAdmin ? 'Panel de Super Admin' : `Gestión de Instituto: ${institutionId}`}
          </p>
        </header>

        <form onSubmit={manejarRegistro} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre Completo</label>
              <input 
                required
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-orange-500 outline-none font-bold text-slate-700 transition-colors"
                value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del docente"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cargo / Rol</label>
              <select 
                disabled={!isSuperAdmin}
                className="w-full bg-slate-100 border-2 border-slate-100 p-4 rounded-2xl outline-none font-black italic uppercase text-sm text-slate-800 cursor-pointer disabled:opacity-70"
                value={rol} onChange={(e) => setRol(e.target.value)}
              >
                <option value="profesor">Profesor (Monitor)</option>
                <option value="director">Director (Administrador)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Email Institucional</label>
            <input 
              required type="email"
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-orange-500 outline-none font-bold text-slate-700"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Contraseña de acceso</label>
            <input 
              required type="password"
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-orange-500 outline-none font-bold text-slate-700"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {mensaje.texto && (
            <div className={`p-4 rounded-2xl font-bold text-sm text-center animate-pulse ${mensaje.tipo === 'exito' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {mensaje.texto}
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-orange-500 text-white font-black italic uppercase py-5 rounded-[2rem] transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Sincronizando...' : 'Dar de alta en el sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
