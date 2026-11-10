function compilePath(path) {
  const keys = [];
  const pattern = path.split('/').map(segment => {
    if (segment.startsWith(':')) {
      keys.push(segment.slice(1));
      return '([^/]+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { keys, expression: new RegExp(`^${pattern}/?$`) };
}

export function createRouter() {
  const routes = [];
  let middleware = [];
  const router = {
    use(handler) {
      middleware = [...middleware, handler];
      return router;
    }
  };

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    router[method.toLowerCase()] = (path, ...handlers) => {
      const { keys, expression } = compilePath(path);
      routes.push({ method, keys, expression, handlers: [...middleware, ...handlers] });
      return router;
    };
  }

  router.dispatch = async (req, res) => {
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.expression.exec(req.path);
      if (!match) continue;
      req.params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      let completed = false;
      const run = async index => {
        if (completed) return;
        if (index >= route.handlers.length) {
          completed = true;
          return;
        }
        let nextPromise;
        const next = error => {
          if (error) throw error;
          nextPromise = run(index + 1);
          return nextPromise;
        };
        await route.handlers[index](req, res, next);
        if (nextPromise) await nextPromise;
      };
      await run(0);
      return true;
    }
    return false;
  };
  return router;
}

export class JsonResponse {
  constructor() {
    this.statusCode = 200;
    this.body = null;
    this.headers = new Headers();
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(body) {
    this.body = body;
    return this;
  }

  cookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`, 'HttpOnly', 'SameSite=Lax'];
    if (options.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    if (options.secure) parts.push('Secure');
    this.headers.append('Set-Cookie', parts.join('; '));
    return this;
  }

  clearCookie(name, options = {}) {
    const parts = [`${name}=`, `Path=${options.path || '/'}`, 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (options.secure) parts.push('Secure');
    this.headers.append('Set-Cookie', parts.join('; '));
    return this;
  }
}
