import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

async function getAccessToken(sa) {
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  return (await res.json()).access_token;
}

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    const origin = req.headers.get("Origin");
    const cors = {
      ...(allowed.includes(origin) && { "Access-Control-Allow-Origin": origin }),
      "Vary": "Origin", // tells caches the response depends on the Origin header
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

    // 1. Verify the caller is the admin
    let payload;
    try {
      const idToken = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      ({ payload } = await jwtVerify(idToken, JWKS, {
        issuer: `https://securetoken.google.com/${env.PROJECT_ID}`,
        audience: env.PROJECT_ID,
      }));
    } catch (e) {
      console.log("token check failed:", e.code, e.message);
      return json({ error: "invalid token" }, 401, cors);
    }
    if (payload.sub !== env.ADMIN_UID) return json({ error: "forbidden" }, 403, cors);

    // 2. Validate input
    const { newPassword } = await req.json().catch(() => ({}));
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400, cors);
    }

    // 3. Update the basic user's password and sign out its existing sessions
    const accessToken = await getAccessToken(JSON.parse(env.SERVICE_ACCOUNT));
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${env.PROJECT_ID}/accounts:update`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          localId: env.BASIC_UID,
          password: newPassword,
          validSince: String(Math.floor(Date.now() / 1000)),
        }),
      }
    );
    if (!res.ok) return json({ error: await res.text() }, 502, cors);
    return json({ ok: true }, 200, cors);
  },
};