// Host half of dsh-arcade.
//
// The game itself lives in the browser bundle (client.js). The host half only
// does two things:
//   1. write a small activation breadcrumb so the install can be verified from
//      the outside, and
//   2. expose a tiny same-origin diagnostics route the client half pings once
//      it mounted (also used by the standalone preview harness).
//
// Routes live under /arcade/* and never touch session or workspace data.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const LOG_PATH = join(tmpdir(), 'dsh-arcade', 'diagnostics.log');

function note(line) {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* diagnostics must never break the host */
  }
}

export const name = '@kennielearngames/dsh-arcade';
export const inject = ['webServer'];

export function apply(ctx) {
  note('host: applied');
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/arcade',
    handler(req, res) {
      const url = new URL(req.url ?? '/', 'http://dsh.invalid');
      if (url.pathname === '/arcade/ping') {
        note(`client: ping ${url.search.slice(1)}`);
        res.writeHead(204, { 'cache-control': 'no-store' });
        res.end();
        return;
      }
      note(`route: ${req.method ?? 'GET'} ${url.pathname}${url.search}`);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, plugin: '@kennielearngames/dsh-arcade' }));
    },
  }), 'arcade: diagnostics route');
}

export function dispose() {
  note('host: disposed');
}

export default { name, inject, apply, dispose };
