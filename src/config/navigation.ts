import { LayoutDashboard, Users, School, Tablet, Settings } from 'lucide-react';

export const NAV_ITEMS = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: ['super-admin', 'director', 'profesor']
  },
  {
    title: 'Institutos',
    path: '/dashboard/institutions',
    icon: School,
    roles: ['super-admin']
  },
  {
    title: 'Personal',
    path: '/dashboard/users',
    icon: Users,
    roles: ['super-admin']
  },
  {
    title: 'Aulas',
    path: '/dashboard/classrooms',
    icon: Tablet,
    roles: ['super-admin', 'director', 'profesor']
  },
  {
    title: 'Seguridad',
    path: '/dashboard/security',
    icon: Settings,
    roles: ['super-admin', 'director']
  }
];
