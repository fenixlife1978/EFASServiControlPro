'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/common/logo';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

// ============================================================
// USUARIOS CON ACCESO ABSOLUTO - NO necesitan Firebase Auth
// ============================================================
const ABSOLUTE_ACCESS_USERS = [
  { email: 'generaextra@gmail.com', role: 'director-supervisor', redirect: '/dashboard/supervisor' },
  { email: 'vallecondo@gmail.com', role: 'super-admin', redirect: '/dashboard/admin' }
];

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
    setError('');
  };

  const handleAbsoluteAccess = (user: typeof ABSOLUTE_ACCESS_USERS[0]) => {
    console.log('✅ Acceso absoluto concedido a:', user.email, 'como', user.role);
    
    // Guardar en localStorage para mantener sesión
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('absoluteAccess', 'true');
    localStorage.setItem('isLoggedIn', 'true');
    
    toast({
      title: "Acceso concedido",
      description: `Bienvenido ${user.role === 'director-supervisor' ? 'Director Supervisor' : 'Super Administrador'}`,
    });
    
    // Redirigir inmediatamente
    router.push(user.redirect);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const cleanEmail = formData.email.trim().toLowerCase();
    const password = formData.password;

    // ============================================================
    // ACCESO ABSOLUTO - COMPLETAMENTE SIN FIREBASE AUTH
    // ============================================================
    const absoluteUser = ABSOLUTE_ACCESS_USERS.find(u => u.email === cleanEmail);
    
    if (absoluteUser) {
      setIsLoading(false);
      handleAbsoluteAccess(absoluteUser);
      return;
    }

    // ============================================================
    // Para otros usuarios: mostrar mensaje
    // ============================================================
    setError('Acceso no autorizado. Solo usuarios autorizados pueden ingresar.');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4">
      <Card className="w-full max-w-md bg-[#0f1117] border-slate-800 shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Logo className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-black italic uppercase text-white tracking-tighter">
            EDU<span className="text-orange-500">ControlPro</span>
          </CardTitle>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Sistema de Gestión y Seguridad Escolar
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Correo Electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10 bg-slate-900 border-slate-700 text-white text-sm focus:border-orange-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-10 bg-slate-900 border-slate-700 text-white text-sm focus:border-orange-500"
                  required
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  INICIANDO SESIÓN...
                </>
              ) : (
                'INGRESAR AL SISTEMA'
              )}
            </button>

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-[8px] text-slate-600 uppercase tracking-wider">
                Sistema de Control y Monitoreo Educacional
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
