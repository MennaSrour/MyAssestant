import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import {
  initialEntries,
  validEntries,
  type Entry,
  type Workspace,
} from "./model";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const localOwner = "00000000-0000-4000-8000-000000000001";
export function mode() {
  if (url && key) return "supabase";
  if (url || key) throw new Error("Set both Supabase environment variables.");
  return process.env.DATABASE_URL ? "postgres" : "demo";
}
export async function supabase() {
  const jar = await cookies();
  return createServerClient(url!, key!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* App Router pages use the proxy to refresh cookies. */
        }
      },
    },
  });
}
const prismaGlobal = globalThis as typeof globalThis & {
  hayatiPrisma?: PrismaClient;
};
function prisma() {
  prismaGlobal.hayatiPrisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  return prismaGlobal.hayatiPrisma;
}
function signature(value: string) {
  const secret = process.env.LOCAL_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "LOCAL_SESSION_SECRET must contain at least 32 characters.",
    );
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function matches(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export async function localLogin(password: string) {
  const expected = process.env.LOCAL_ACCESS_PASSWORD;
  if (!expected || !matches(password, expected)) return false;
  const expires = String(Date.now() + 7 * 86400000);
  (await cookies()).set("hayati-session", expires + "." + signature(expires), {
    httpOnly: true,
    sameSite: "lax",
    secure: (await headers()).get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: 7 * 86400,
  });
  return true;
}
async function identity() {
  if (mode() === "supabase") {
    const client = await supabase();
    const { data } = await client.auth.getUser();
    return data.user ? { owner: data.user.id, client } : null;
  }
  if (mode() === "postgres") {
    const [expires, token] = (
      (await cookies()).get("hayati-session")?.value ?? ""
    ).split(".");
    if (
      Number(expires) > Date.now() &&
      token &&
      matches(token, signature(expires))
    )
      return { owner: localOwner };
  }
  return null;
}
export async function loadWorkspace(): Promise<Workspace | null> {
  const auth = await identity();
  if (!auth) return null;
  if (auth.client) {
    const table = auth.client.from("workspaces");
    const existing = await table
      .select("version, entries")
      .eq("owner_id", auth.owner)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return existing.data as Workspace;
    const seed = await table.upsert(
      { owner_id: auth.owner, entries: initialEntries },
      { onConflict: "owner_id", ignoreDuplicates: true },
    );
    if (seed.error) throw new Error(seed.error.message);
    const row = await table
      .select("version, entries")
      .eq("owner_id", auth.owner)
      .single();
    if (row.error) throw new Error(row.error.message);
    return row.data as Workspace;
  }
  const row = await prisma().workspace.upsert({
    where: { ownerId: auth.owner },
    update: {},
    create: { ownerId: auth.owner, entries: initialEntries },
  });
  return { version: row.version, entries: row.entries as Entry[] };
}
export async function saveWorkspace(entries: unknown, version: number) {
  if (!validEntries(entries) || !Number.isSafeInteger(version) || version < 0)
    return { error: "Invalid workspace data." };
  const auth = await identity();
  if (!auth) return { error: "Please sign in again." };
  if (auth.client) {
    const row = await auth.client
      .from("workspaces")
      .update({
        entries,
        version: version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", auth.owner)
      .eq("version", version)
      .select("version")
      .maybeSingle();
    if (row.error) throw new Error(row.error.message);
    return row.data
      ? { version: row.data.version as number }
      : {
          error: "Workspace changed on another device. Refresh before editing.",
        };
  }
  const row = await prisma().workspace.updateMany({
    where: { ownerId: auth.owner, version },
    data: { entries, version: { increment: 1 } },
  });
  return row.count
    ? { version: version + 1 }
    : { error: "Workspace changed on another device. Refresh before editing." };
}
