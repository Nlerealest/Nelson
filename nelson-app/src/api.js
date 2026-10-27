// Talks to the Nelson bot's private API (nelson/api.py on the PC).

async function request(conn, path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${conn.url}/api/${path}`, {
      method,
      headers: { Authorization: `Bearer ${conn.key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      // empty or non-JSON body
    }
    if (res.status === 401) {
      if (data.practice) {
        throw new Error('This address is running the practice demo, not your real Nelson. On the PC, close the demo window (Ctrl+C) and start Nelson with the launcher.');
      }
      throw new Error('Wrong app key. On the PC run app-setup again, restart Nelson, then scan or paste the new code.');
    }
    if (!res.ok && !data.message) throw new Error(data.error || `Nelson answered ${res.status}`);
    return data;
  } catch (e) {
    if (e.name === 'AbortError' || /cancel|abort/i.test(String(e.message))) {
      throw new Error('No answer from Nelson. Check: the address starts with https://, Tailscale is on (phone and PC), '
        + 'Nelson is running on the PC, and "tailscale serve --bg 8765" was run there.');
    }
    if (e instanceof TypeError) throw new Error('Cannot reach Nelson. Check the address, your internet, and Tailscale.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const ping = (conn) => request(conn, 'ping', { timeoutMs: 10000 });
export const getSnapshot = (conn) => request(conn, 'snapshot');
export const pause = (conn) => request(conn, 'pause', { method: 'POST', timeoutMs: 35000 });
export const resume = (conn) => request(conn, 'resume', { method: 'POST', timeoutMs: 35000 });
export const closeAll = (conn) => request(conn, 'close-all', { method: 'POST', body: { confirm: 'CLOSE' }, timeoutMs: 35000 });
export const setRisk = (conn, value) => request(conn, 'risk', { method: 'POST', body: { value }, timeoutMs: 35000 });
