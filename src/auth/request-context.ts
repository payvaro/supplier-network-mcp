import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestAuth {
  accessToken: string;
  clientId: string;
  userId?: string;
}

const requestContext = new AsyncLocalStorage<RequestAuth>();

export function runWithAuth<T>(auth: RequestAuth, fn: () => T): T {
  return requestContext.run(auth, fn);
}

export function getRequestAuth(): RequestAuth | undefined {
  return requestContext.getStore();
}
