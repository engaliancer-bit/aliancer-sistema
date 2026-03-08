interface PendingRequest {
  controller: AbortController;
  timestamp: number;
  key: string;
}

const pendingRequests = new Map<string, PendingRequest>();

export function createRequestKey(
  category: string,
  resource: string,
  params?: Record<string, any>
): string {
  const paramStr = params ? JSON.stringify(params) : '';
  return `${category}:${resource}:${paramStr}`;
}

export function cancelPreviousRequest(key: string): void {
  const existing = pendingRequests.get(key);
  if (existing) {
    existing.controller.abort();
    pendingRequests.delete(key);
  }
}

export function cancelRequestsByCategory(category: string): void {
  const keysToCancel: string[] = [];
  pendingRequests.forEach((request, key) => {
    if (key.startsWith(`${category}:`)) {
      request.controller.abort();
      keysToCancel.push(key);
    }
  });
  keysToCancel.forEach(key => pendingRequests.delete(key));
}

export function cancelAllRequests(): void {
  pendingRequests.forEach(request => {
    request.controller.abort();
  });
  pendingRequests.clear();
}

export function registerRequest(key: string): AbortController {
  cancelPreviousRequest(key);

  const controller = new AbortController();
  pendingRequests.set(key, {
    controller,
    timestamp: Date.now(),
    key
  });

  return controller;
}

export function unregisterRequest(key: string): void {
  pendingRequests.delete(key);
}

export function getPendingRequestCount(): number {
  return pendingRequests.size;
}

export function getPendingRequests(): PendingRequest[] {
  return Array.from(pendingRequests.values());
}

export function cleanupStaleRequests(maxAgeMs: number = 30000): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  pendingRequests.forEach((request, key) => {
    if (now - request.timestamp > maxAgeMs) {
      request.controller.abort();
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => pendingRequests.delete(key));
}

export function withRequestCancellation<T, R extends any[]>(
  fn: (...args: R) => Promise<T>,
  key: string
): (...args: R) => Promise<T> {
  return async (...args: R) => {
    const controller = registerRequest(key);

    try {
      return await fn(...args);
    } finally {
      unregisterRequest(key);
    }
  };
}

setInterval(() => {
  cleanupStaleRequests();
}, 10000);
