import "./globals.css";

export const metadata = {
  title: "Watch Party",
  description: "Mirá videos con tus amigos en tiempo real",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="scroll-smooth dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
