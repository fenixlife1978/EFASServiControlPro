import { LayoutDashboard, Users, School, Tablet, Settings } from 'lucide-react';

export const NAV_ITEMS = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: '📊',
    roles: ['super-admin', 'director']
  },
  {
    title: 'Institutos',
    path: '/dashboard/institutions',
    icon: '🏫',
    roles: ['super-admin']
  },
  {
    title: 'Personal',
    path: '/dashboard/users',
    icon: '��',
    roles: ['super-admin']
  },
  {
    title: 'Aulas',
    path: '/dashboard/classrooms',
    icon: '🏫',
    roles: ['super-admin', 'director']
  }
];
