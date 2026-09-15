import { getCurrentUser } from "@/lib/auth";
import { subscribeToUser, type NotifPayload } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Flux Server-Sent Events : diffusion en temps réel des notifications d'un
 * utilisateur (validation de compte, approbation de publication, nouveau
 * commentaire, signalement, blocage…).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let keepAlive: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* le flux est peut-être déjà fermé */
        }
      };

      unsubscribe = subscribeToUser(user.id, (payload: NotifPayload) => {
        send("notification", payload);
      });

      send("ready", { ok: true });
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 25000);
    },
    cancel() {
      clearInterval(keepAlive);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
