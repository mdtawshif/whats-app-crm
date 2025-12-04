import { FastifyRequest, FastifyReply } from "fastify";

export const authMiddleware = (username: string, password: string) => {
  return (req: FastifyRequest, reply: FastifyReply, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      reply
        .header("WWW-Authenticate", "Basic realm='Bull Board'")
        .status(401)
        .send("Unauthorized");
      return;
    }

    const [scheme, encoded] = authHeader.split(" ");
    if (scheme !== "Basic" || !encoded) {
      reply.status(400).send("Invalid authorization header");
      return;
    }

    const [reqUsername, reqPassword] = Buffer.from(encoded, "base64")
      .toString()
      .split(":");

    if (reqUsername === username && reqPassword === password) {
      next();
    } else if (!(username && password)) {
      next();
    } else {
      reply
        .header("WWW-Authenticate", "Basic realm='Bull Board'")
        .status(401)
        .send("Unauthorized");
    }
  };
};
