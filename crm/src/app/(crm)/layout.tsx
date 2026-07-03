import { AppSidebar } from '@/components/layout/AppSidebar';
import { AuthGuard } from '@/components/layout/AuthGuard';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-full w-full overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </AuthGuard>
  );
}
