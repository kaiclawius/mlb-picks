export type Rpc = <T = unknown>(method: string, params?: unknown[]) => Promise<T>;

export function makeRpc(url: string): Rpc {
  return async <T>(method: string, params: unknown[] = []) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`RPC ${method}: HTTP ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: { message: string } };
    if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
    return json.result as T;
  };
}
