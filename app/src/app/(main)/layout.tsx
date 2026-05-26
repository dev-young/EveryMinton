import { Navigation } from "@/components/Navigation";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="bg-gradient-to-r from-[#0066B3] to-[#004d8a] text-white px-5 py-4 sticky top-0 z-50">
        <h1 className="text-xl font-extrabold tracking-tight">
          Every<span className="text-[#4dd88a]">Minton</span>
        </h1>
      </header>
      <Navigation />
      <main className="flex-1">{children}</main>
    </>
  );
}
