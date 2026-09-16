import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { auth } from "@/app/lib/auth";
import { session, user } from "@/auth-schema";
import { db } from "@/db";

type SuperAdminSeed = {
  email: string;
  password: string;
  name?: string;
};

/**
 * Prueba que quien corre el seed controla la cuenta antes de promoverla.
 * Sin esto, cualquiera que se registre público con el email del seed obtendría
 * SUPER_ADMIN en la siguiente corrida.
 */
async function assertOwnsAccount(email: string, password: string) {
  let signedIn;

  try {
    signedIn = await auth.api.signInEmail({ body: { email, password } });
  } catch (error) {
    if (error instanceof APIError) {
      throw new Error(
        `Ya existe una cuenta con ${email} y la contraseña del seed no coincide; no se promueve a SUPER_ADMIN.`,
      );
    }

    throw error;
  }

  await dropSession(signedIn.token);
}

/** El seed no entrega la sesión que abre para validar: queda viva sin dueño. */
async function dropSession(token: string | null | undefined) {
  if (token) {
    await db.delete(session).where(eq(session.token, token));
  }
}

/**
 * Idempotente: si el email ya existe solo garantiza el rol SUPER_ADMIN y nunca
 * pisa la contraseña. El alta va por Better Auth para que el hash y la fila de
 * `account` los genere la librería, no este script.
 */
export async function seedSuperAdmin({ email: rawEmail, password, name }: SuperAdminSeed) {
  // Better Auth persiste el email en minúsculas (sign-up.mjs:165). Sin normalizar,
  // un email mixed-case no encontraría al usuario existente y el sign-up siguiente
  // devolvería la respuesta sintética de protección contra enumeración.
  const email = rawEmail.trim().toLowerCase();

  const [existing] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email));

  if (existing) {
    await assertOwnsAccount(email, password);

    if (existing.role !== "SUPER_ADMIN") {
      await db
        .update(user)
        .set({ role: "SUPER_ADMIN" })
        .where(eq(user.id, existing.id));
    }

    return { id: existing.id, email, created: false };
  }

  const created = await auth.api.signUpEmail({
    body: { name: name ?? "Super Admin", email, password },
  });
  await dropSession(created.token);

  // `role` tiene input: false, así que no se puede setear en el sign-up.
  // Si el UPDATE no toca ninguna fila, el sign-up devolvió un usuario sintético
  // (alguien registró este email entre el SELECT y el alta): abortamos.
  const promoted = await db
    .update(user)
    .set({ role: "SUPER_ADMIN" })
    .where(eq(user.id, created.user.id))
    .returning({ id: user.id });

  if (promoted.length === 0) {
    throw new Error(
      `No se pudo promover ${email}: el sign-up no creó la cuenta. Reintentá el seed.`,
    );
  }

  return { id: created.user.id, email, created: true };
}

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL y SUPER_ADMIN_PASSWORD deben estar definidos");
  }

  const result = await seedSuperAdmin({ email, password });
  console.log(
    result.created
      ? `Super admin creado: ${result.email}`
      : `Super admin ya existía: ${result.email}`,
  );

  await db.$client.end();
}

// ponytail: sin top-level await — el archivo se carga como CJS (package.json
// no declara "type": "module") y un módulo async rompe el require de tsx.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
