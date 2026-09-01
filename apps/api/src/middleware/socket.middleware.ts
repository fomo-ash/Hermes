import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { parseCookie } from "cookie";
import { env } from "../config/env";

interface JwtPayload {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

declare module "socket.io" {
  interface SocketData {
    userId: string;
    email: string;
  }
}

export async function socketMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    if (!cookieHeader) {
      return next(new Error("Authentication required"));
    }

    // parsing the cookies
    const cookies = parseCookie(cookieHeader);

    const token = cookies.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!decoded.id) {
      return next(new Error("Invalid token"));
    }

    //  attaching authenticated user
    socket.data.userId = decoded.id;
    socket.data.email = decoded.email;

    next();
    
  } catch (error) {
    console.error("Socket authentication failed:", error);

    next(new Error("Unauthorized"));
  }
}
