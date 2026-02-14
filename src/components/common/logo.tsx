import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-blue-600 p-2 rounded-lg">
        <Shield className="text-white w-6 h-6" />
      </div>
      <p className={cn("text-xl font-black tracking-tighter italic leading-none", className)}>
        <span className="text-inherit">EFAS</span>{' '}
        <span className="text-orange-500">ServiControlPro</span>
      </p>
    </div>
  );
}
