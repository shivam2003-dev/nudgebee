import { getToken } from 'next-auth/jwt';
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { context, propagation, trace, SpanStatusCode } from '@opentelemetry/api';
import { tryBypassGraphQL } from '@lib/rpcGateway';

const SLOW_THRESHOLD_MS = 500;

// We may stream large bodies through this handler, so the framework's 4MB
// warning is not useful signal — disable it to cut log noise. Our own
// bytes_out timing field replaces it.
export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const t0 = performance.now();
  const tracer = trace.getTracer('graphql-api');
  const operationName = req.body?.operationName || 'unknown';

  // --- Extract or create traceparent ---
  let traceParent: string;
  const requestIds = req.headers['traceparent'];
  if (requestIds && requestIds.length > 0) {
    traceParent = Array.isArray(requestIds) ? requestIds[0] : requestIds;
  } else {
    const version = Buffer.alloc(1).toString('hex');
    const traceId = crypto.randomBytes(16).toString('hex');
    const id = crypto.randomBytes(8).toString('hex');
    const flags = '01';
    traceParent = `${version}-${traceId}-${id}-${flags}`;
  }

  const parentCtx = propagation.extract(context.active(), { traceparent: traceParent });
  const span = tracer.startSpan('graphql-handler', undefined, parentCtx);

  await context.with(trace.setSpan(context.active(), span), async () => {
    const requestId =
      Array.isArray(req.headers['x-request-id']) && req.headers['x-request-id'].length > 0
        ? req.headers['x-request-id'][0]
        : (req.headers['x-request-id'] as string) || traceParent;

    const timing: Record<string, number> = {};

    try {
      const body = req.body;

      // --- Step 1: Authentication (NextAuth session only) ---
      // The Hasura-proxy fallback path supported a Bearer-token-only flow
      // (Authorization header carrying an encrypted token, no NextAuth cookie)
      // that proxied to Hasura for JWT validation. With Hasura deleted, the
      // only remaining caller of /api/graphql is the browser frontend, which
      // always carries a NextAuth cookie. Bearer-only callers should use
      // /api/rpc once it grows JWT-payload decode.
      const authSpan = tracer.startSpan('authenticateUser', undefined, trace.setSpan(context.active(), span));
      const tGetToken = performance.now();
      const jwtSessionToken = await getToken({ req });
      timing.getToken_ms = Math.round(performance.now() - tGetToken);

      if (!jwtSessionToken) {
        authSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'User not authenticated' });
        authSpan.end();
        res.status(401).json({
          error: 'not_authenticated',
          description: 'The user does not have an active session',
        });
        return;
      }
      authSpan.setStatus({ code: SpanStatusCode.OK });
      authSpan.end();
      timing.auth_total_ms = Math.round(performance.now() - t0);

      const token = (jwtSessionToken.hasuraIdToken as string) || (jwtSessionToken.idToken as string) || null;

      // --- Step 2: Forward to upstream services via the RPC gateway ---
      // Parses the incoming GraphQL operation and forwards each top-level
      // field directly to its upstream service via @lib/rpcGateway. Returns
      // a 502 if the gateway can't handle the operation (subscriptions,
      // fragments, unknown actions, parse errors). In practice this is
      // unreachable: the frontend has no subscriptions, no fragments, and
      // every mutation/query maps to a registered action.
      if (typeof body?.query !== 'string') {
        res
          .status(400)
          .setHeader('traceparent', traceParent)
          .setHeader('X-Request-ID', requestId)
          .json({ errors: [{ message: 'missing query body' }] });
        return;
      }

      const gatewaySpan = tracer.startSpan('rpcGateway', undefined, trace.setSpan(context.active(), span));
      const tGateway = performance.now();
      const result = await tryBypassGraphQL({
        query: body.query,
        variables: body.variables,
        jwt: jwtSessionToken,
        clientAuthorization: token ? `Bearer ${token}` : undefined,
        traceparent: traceParent,
        requestId,
      });
      timing.gateway_ms = Math.round(performance.now() - tGateway);

      if (result.handled) {
        gatewaySpan.setStatus({ code: SpanStatusCode.OK });
        gatewaySpan.end();
        res.status(result.status).setHeader('traceparent', traceParent).setHeader('X-Request-ID', requestId).json(result.body);
        return;
      }

      gatewaySpan.setAttribute('gateway.unhandled_reason', result.reason);
      gatewaySpan.setStatus({ code: SpanStatusCode.ERROR, message: `unhandled:${result.reason}` });
      gatewaySpan.end();
      res
        .status(502)
        .setHeader('traceparent', traceParent)
        .setHeader('X-Request-ID', requestId)
        .json({ errors: [{ message: `RPC gateway could not handle the operation: ${result.reason}` }] });

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      res.status(500).setHeader('traceparent', traceParent).setHeader('X-Request-ID', requestId).json({
        code: error.code,
        error: error.message,
      });
    } finally {
      timing.total_ms = Math.round(performance.now() - t0);
      const totalMs = timing.total_ms;
      if (totalMs > SLOW_THRESHOLD_MS) {
        console.warn(`[graphql-gateway] SLOW ${operationName} ${totalMs}ms`, JSON.stringify(timing));
      } else {
        console.log(`[graphql-gateway] ${operationName} ${totalMs}ms`, JSON.stringify(timing));
      }
      span.end();
    }
  });
}
