import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    plugins: [nextCookies()],
    emailAndPassword: {
        enabled: true,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 días
        updateAge: 60 * 60 * 24, // renueva si falta menos de 1 día
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "PARTICIPANT",
                // El cliente no lo escribe (input) ni lo lee (returned).
                // La autorización lee el rol de la DB en app/lib/authz.ts.
                input: false,
                returned: false,
            },
        },
    },
});