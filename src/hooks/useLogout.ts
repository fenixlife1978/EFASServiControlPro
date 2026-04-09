import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/config';
import { signOut } from 'firebase/auth';

export const useLogout = () => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // 1. Limpiar localStorage
      localStorage.removeItem('InstitutoId');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('absoluteAccess');
      localStorage.removeItem('userUid');
      localStorage.removeItem('isLoggedIn');
      
      // 2. Limpiar cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // 3. Cerrar sesión en Firebase (esto detiene los listeners)
      await signOut(auth);
      
      // 4. Pequeño delay para asegurar que Firebase limpie los listeners
      setTimeout(() => {
        // Redirigir
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      // Fallback: redirigir directamente
      window.location.href = '/login';
    }
  };

  return { handleLogout };
};
