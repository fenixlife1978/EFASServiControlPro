'use client';
import { useInstitution } from "@/app/(admin)/institution-context";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Skeleton } from "../ui/skeleton";
import type { Institution } from "@/lib/firestore-types";
import { AdminUserNav } from "../common/admin-user-nav";
import { SidebarTrigger } from "../ui/sidebar";
import { Logo } from "../common/logo";

export function DashboardHeader() {
  const { institutionId } = useInstitution();
  const firestore = useFirestore();

  const institutionRef = useMemoFirebase(() => {
    if (!firestore || !institutionId) return null;
    return doc(firestore, 'institutions', institutionId);
  }, [firestore, institutionId]);

  const { data: institution, isLoading } = useDoc<Institution>(institutionRef);

  return (
    <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
          <div className="md:hidden">
              <SidebarTrigger/>
          </div>
          <div className="hidden md:block">
            {isLoading ? (
              <Skeleton className="h-6 w-72" />
            ) : (
              <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
                {institution?.nombre || 'Institución no encontrada'}
              </h2>
            )}
          </div>
          <div className="md:hidden">
            <Logo />
          </div>
      </div>
      <div className="flex items-center gap-2">
        <AdminUserNav />
      </div>
    </div>
  );
}
