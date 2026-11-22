"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  mode,
  localLogin,
  supabase,
  saveWorkspace,
  loadWorkspace,
} from "@/lib/store";

export async function persist(entries: unknown, version: number) {
  try {
    return await saveWorkspace(entries, version);
  } catch {
    return { error: "Could not save workspace. Please try again." };
  }
}
export async function latestWorkspace() {
  return loadWorkspace();
}
export async function signIn(_: string, form: FormData) {
  const password = String(form.get("password") ?? "");
  if (mode() === "postgres") {
    if (!(await localLogin(password))) return "Incorrect password.";
  } else if (mode() === "supabase") {
    const client = await supabase();
    const { error } = await client.auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password,
    });
    if (error) return error.message;
  } else return "No account provider configured.";
  redirect("/");
}
export async function signOut() {
  if (mode() === "supabase") await (await supabase()).auth.signOut();
  (await cookies()).delete("hayati-session");
  redirect("/");
}
