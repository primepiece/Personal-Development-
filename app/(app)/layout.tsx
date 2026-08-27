import { PrimeNav } from "@/components/nav/prime-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1180px] md:grid md:grid-cols-[236px_1fr]">
      <PrimeNav />
      <main className="min-w-0 flex-1 pb-24 md:pb-16">{children}</main>
    </div>
  );
}
