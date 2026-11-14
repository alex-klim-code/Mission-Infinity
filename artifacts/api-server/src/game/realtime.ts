import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { clerkClient } from "@clerk/express";
import { activeMembership, resolveUser } from "./players";
import { attachRealtime, isOnline, markConnected, markDisconnected } from "./presence";
import { reconcilePresence } from "./sessions";
import { notifyPresence } from "./social";
import { validateOrigin } from "../routes/game";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { logger } from "../lib/logger";

export function startRealtime(server: HttpServer) {
  const io = new Server(server, {
    path: "/api/socket.io",
    maxHttpBufferSize: 16 * 1024,
    serveClient: false,
    allowRequest(req, callback) {
      try { validateOrigin(req); callback(null, true); }
      catch { callback("Origin not permitted", false); }
    },
    connectionStateRecovery: { maxDisconnectionDuration: 120_000, skipMiddlewares: false },
  });
  attachRealtime(io);
  io.use(async (socket, next) => {
    try {
      const req = socket.request;
      const host = getClerkProxyHost(req);
      if (!host) { next(new Error("Invalid host.")); return; }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const webRequest = new Request(`https://${host}${req.url}`, { headers });
      const state = await clerkClient.authenticateRequest(webRequest, {
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      });
      const auth = state.toAuth();
      if (!auth?.userId) { next(new Error("Sign in to connect to mission control.")); return; }
      socket.data.userId = await resolveUser(auth.userId);
      next();
    } catch {
      // Never log cookies, tokens or OAuth parameters.
      next(new Error("Unable to authenticate mission connection."));
    }
  });
  io.on("connection", socket => {
    const id = socket.data.userId as string;
    const synchronize = async () => {
      await socket.join(`user:${id}`);
      markConnected(id, socket.id);
      const membership = await activeMembership(id);
      if (membership) await socket.join(`session:${membership.session_id}`);
      await Promise.all([notifyPresence(id), reconcilePresence(id)]);
      socket.emit("game:changed", {});
      socket.emit("social:changed", {});
    };
    void synchronize().catch(err => {
      logger.error({ err }, "Realtime initialization failed");
      socket.disconnect(true);
    });
    socket.on("disconnect", () => {
      markDisconnected(id, socket.id);
      void Promise.all([notifyPresence(id), reconcilePresence(id)]).catch(err => logger.error({ err }, "Presence synchronization failed"));
      const timer = setTimeout(() => {
        if (!isOnline(id)) {
          void reconcilePresence(id, true).catch(err => logger.error({ err }, "Host transfer failed"));
        }
      }, 15_000);
      timer.unref();
    });
    // Clients cannot mutate state or join arbitrary rooms by sending socket events.
    // All commands go through validated, authenticated, transaction-backed HTTP.
  });
  return io;
}
