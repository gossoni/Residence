import { EventEmitter } from "node:events";

/**
 * Bus d'événements en mémoire pour la diffusion temps réel des notifications
 * (équivalent applicatif de Supabase Realtime pour un déploiement mono-process).
 */
const globalForEvents = globalThis as typeof globalThis & {
  __mrNotifEmitter?: EventEmitter;
};

export const notifEmitter =
  globalForEvents.__mrNotifEmitter ?? new EventEmitter();
notifEmitter.setMaxListeners(0);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.__mrNotifEmitter = notifEmitter;
}

export type NotifPayload = {
  id: number;
  type: string;
  titre: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function emitNotification(userId: number, payload: NotifPayload): void {
  notifEmitter.emit(`user:${userId}`, payload);
}

export function subscribeToUser(
  userId: number,
  listener: (payload: NotifPayload) => void,
): () => void {
  const channel = `user:${userId}`;
  notifEmitter.on(channel, listener);
  return () => notifEmitter.off(channel, listener);
}
