import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

const validRequestId = /^[A-Za-z0-9._-]{1,100}$/;

export default function requestId(request: Request, response: Response, next: NextFunction) {
  const received = request.header("x-request-id")?.trim();
  request.requestId = received && validRequestId.test(received) ? received : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
}
