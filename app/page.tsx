import { loadWorkspace, mode } from "@/lib/store";
import { dayKey, initialEntries } from "@/lib/model";
import { Dashboard } from "@/components/dashboard";
import { Login } from "@/components/login";
export const dynamic = "force-dynamic";
export default async function Home() {
  const backend = mode();
  const workspace =
    backend === "demo"
      ? { version: 0, entries: initialEntries }
      : await loadWorkspace();
  return workspace ? (
    <Dashboard
      initial={workspace}
      initialDay={dayKey()}
      demo={backend === "demo"}
    />
  ) : (
    <Login supabase={backend === "supabase"} />
  );
}
