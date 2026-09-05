import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";

const SESSION_COOKIE_NAME = "__session"; // Cambia esto por el nombre de tu cookie

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    return await getAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

export default async function WatchPartyLayout({ children, params }) {
  const user = await getCurrentUser();
  const displayName = user?.name || user?.email || "Anon";

  return (
    <div>
      {/* Pasar el nombre del usuario como atributo data */}
      <div data-user-name={displayName}>{children}</div>
    </div>
  );
}
