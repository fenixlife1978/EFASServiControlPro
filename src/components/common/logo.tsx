import { cn } from '@/lib/utils';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function Logo({ className }: { className?: string }) {
  const efasLogo = PlaceHolderImages.find(img => img.id === 'efas-logo');

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-8 h-8">
        {efasLogo ? (
          <Image 
            src={efasLogo.imageUrl} 
            alt="EFAS Logo" 
            fill 
            className="object-contain"
            data-ai-hint={efasLogo.imageHint}
          />
        ) : (
          <div className="w-full h-full bg-slate-200 rounded-md"></div>
        )}
      </div>
      <p className={cn("text-xl font-black tracking-tighter italic leading-none", className)}>
        <span className="text-inherit">EFAS</span>{' '}
        <span className="text-orange-500">ServiControlPro</span>
      </p>
    </div>
  );
}
