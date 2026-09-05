import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Home/Hero";
import Features from "@/components/Home/Section1";
import FAQ from "@/components/Home/Questions";
import FinalCTA from "@/components/Home/Cierre";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080b08] text-zinc-100">
      <Navbar />

      <Hero />
      <Features />

      <FAQ />
      <FinalCTA />

      <Footer />
    </main>
  );
}
