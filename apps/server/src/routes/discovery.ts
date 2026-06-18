import type { FastifyInstance } from 'fastify';
import { PAYMENT_METHOD, SERVICE_FEES, SIM_USD, amountToWire } from '@table402/shared';
import type { AppContext } from '../core/context';
import type { ServiceRegistry } from '../discovery/registry';

function paymentInfo(amount: number, description: string) {
  return {
    offers: [
      {
        amount: amountToWire(amount),
        currency: SIM_USD.address,
        method: PAYMENT_METHOD,
        intent: 'charge',
        description,
      },
    ],
  };
}

export function registerDiscoveryRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  registry: ServiceRegistry,
): void {
  app.get('/discovery/services', async () => {
    const services = await registry.discoverServices();
    return { services, remote: registry.remoteStatus };
  });

  app.get('/discovery/services/search', async (req) => {
    const q = (req.query as { q?: string }).q ?? '';
    return { services: await registry.searchServices(q) };
  });

  // OpenAPI 3.1 with MPP x-payment-info extensions (per-service discovery).
  app.get('/openapi.json', async () => ({
    openapi: '3.1.0',
    info: {
      title: 'Table402 Paid Services',
      version: '0.1.0',
      description: 'Composable, 402-gated paid services powering the Table402 poker arena.',
    },
    servers: [{ url: ctx.config.publicBaseUrl }],
    'x-service-info': {
      categories: ['poker', 'rng', 'validation', 'commentary', 'mpp'],
      docs: { homepage: 'https://github.com/table402', llms: '/llms.txt' },
    },
    paths: {
      '/services/rng/seed': {
        post: {
          summary: 'Buy one random shuffle seed',
          'x-payment-info': paymentInfo(SERVICE_FEES.rng, 'One verifiable random seed'),
          responses: { '200': { description: 'seed' }, '402': { description: 'Payment Required' } },
        },
      },
      '/services/referee/validate': {
        post: {
          summary: 'Independently validate a completed hand',
          'x-payment-info': paymentInfo(SERVICE_FEES.referee, 'Hand validation'),
          responses: { '200': { description: 'verdict' }, '402': { description: 'Payment Required' } },
        },
      },
      '/services/commentary/commentary': {
        post: {
          summary: 'Generate a hand recap + best-move read',
          'x-payment-info': paymentInfo(SERVICE_FEES.commentary, 'Hand commentary'),
          responses: { '200': { description: 'commentary' }, '402': { description: 'Payment Required' } },
        },
      },
    },
  }));
}
