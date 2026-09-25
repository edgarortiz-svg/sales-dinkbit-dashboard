// Routing Middleware de Vercel (https://vercel.com/docs/routing-middleware).
// Protege TODO el dashboard con HTTP Basic Auth antes de servir public/index.html.
// El usuario y la contraseña viven SOLO en las variables de entorno de Vercel
// (DASH_USER, DASH_PASS) — nunca en este archivo ni en el repo.
//
// Corre en el runtime de Node.js (así lo define la propiedad "proxy" de vercel.json),
// así que Buffer está disponible sin imports adicionales.

export default function proxy(request) {
  const user = process.env.DASH_USER;
  const pass = process.env.DASH_PASS;

  // Si no configuraron las variables en Vercel, bloqueamos por defecto
  // (fail closed) en vez de dejar el dashboard abierto sin darse cuenta.
  if (!user || !pass) {
    return new Response(
      "Faltan las variables de entorno DASH_USER / DASH_PASS en la configuración del proyecto en Vercel.",
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");

  if (auth && auth.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
    } catch {
      decoded = "";
    }
    const sep = decoded.indexOf(":");
    const providedUser = sep === -1 ? decoded : decoded.slice(0, sep);
    const providedPass = sep === -1 ? "" : decoded.slice(sep + 1);

    if (providedUser === user && providedPass === pass) {
      return; // credenciales correctas: deja pasar la solicitud tal cual
    }
  }

  return new Response("Autenticación requerida.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="dinkbit dashboard"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
