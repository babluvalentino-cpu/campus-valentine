// worker/src/worker.ts
export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Signup stub
    if (url.pathname === "/api/signup" && request.method === "POST") {
      return new Response(
        JSON.stringify({
          user: { id: "user-1", username: "demo-user" },
          token: "mock-token",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // Login stub
    if (url.pathname === "/api/login" && request.method === "POST") {
      return new Response(
        JSON.stringify({
          user: { id: "user-1", username: "demo-user" },
          token: "mock-token",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Me stub
    if (url.pathname === "/api/me" && request.method === "GET") {
      return new Response(
        JSON.stringify({ user: { id: "user-1", username: "demo-user" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};

