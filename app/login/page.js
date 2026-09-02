import { redirect } from "next/navigation";

import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";
import Navbar from "@/components/Navbar";

import { getCurrentUser } from "@/lib/firebase/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#080b08] text-zinc-100">
      <Navbar />

      <section className="relative flex min-h-[calc(100vh-76px)] items-center justify-center overflow-hidden px-6 py-16 lg:px-10">
        {/* GRID DE FONDO */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(163,255,0,0.25) 1px, transparent 1px),
              linear-gradient(90deg, rgba(163,255,0,0.25) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
            maskImage:
              "radial-gradient(circle at center, black 15%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(circle at center, black 15%, transparent 75%)",
          }}
        />

        {/* GLOW */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/5 blur-[120px]" />

        {/* LOGIN */}
        <div className="relative z-10 w-full max-w-md">
          <LoginForm />
        </div>
      </section>

      <Footer />
    </main>
  );
}
