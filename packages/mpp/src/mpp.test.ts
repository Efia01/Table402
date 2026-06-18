import { describe, expect, it } from 'vitest';
import { SIM_USD } from '@table402/shared';
import {
  buildWwwAuthenticate,
  createCredential,
  createIdentity,
  createSessionAuthorization,
  decodeJson,
  encodeJson,
  MppClient,
  MppError,
  MppServer,
  SimulatedProvider,
  type MppChallenge,
} from './index';

const CUR = SIM_USD.code;

function freshServer() {
  const provider = new SimulatedProvider();
  const server = new MppServer({ secret: 'test-secret', provider, challengeTtlMs: 60_000 });
  return { provider, server };
}

describe('SimulatedProvider', () => {
  it('credits, transfers, and rejects insufficient balance', () => {
    const provider = new SimulatedProvider();
    const a = createIdentity();
    const b = createIdentity();
    provider.credit(a.address, CUR, 1000);
    expect(provider.getBalance(a.address, CUR)).toBe(1000);

    provider.settleCharge({ from: a.address, to: b.address, currency: CUR, amount: 400, reference: 'r1' });
    expect(provider.getBalance(a.address, CUR)).toBe(600);
    expect(provider.getBalance(b.address, CUR)).toBe(400);

    expect(() =>
      provider.settleCharge({ from: a.address, to: b.address, currency: CUR, amount: 10_000, reference: 'r2' }),
    ).toThrow(MppError);
  });
});

describe('charge flow: 402 -> pay -> receipt', () => {
  it('verifies a valid credential, settles funds, and mints a hashable receipt', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const merchant = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);

    const challenge = server.createChallenge({ amount: 10_000, currency: CUR, recipient: merchant.address });
    const credential = await createCredential(payer, challenge);
    const receipt = await server.verifyCredential(credential);

    expect(receipt.status).toBe('success');
    expect(receipt.settlement.amount).toBe('10000');
    expect(receipt.settlement.currency).toBe(CUR);
    expect(receipt.source).toBe(payer.did);
    expect(receipt.recipient).toBe(merchant.address);
    expect(provider.getBalance(payer.address, CUR)).toBe(990_000);
    expect(provider.getBalance(merchant.address, CUR)).toBe(10_000);

    // Receipt hash is verifiable / stable.
    expect(server.recomputeReceiptHash(receipt)).toBe(receipt.receiptHash);
  });

  it('is idempotent for the same credential but single-use for the same challenge', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const merchant = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);

    const challenge = server.createChallenge({ amount: 2_000, currency: CUR, recipient: merchant.address });
    const credential = await createCredential(payer, challenge);

    const r1 = await server.verifyCredential(credential);
    const r2 = await server.verifyCredential(credential); // same idempotency key -> same receipt
    expect(r2.receiptHash).toBe(r1.receiptHash);
    expect(provider.getBalance(merchant.address, CUR)).toBe(2_000); // charged once only

    // A *fresh* credential reusing the same (now spent) challenge must be rejected.
    const replay = await createCredential(payer, challenge);
    await expect(server.verifyCredential(replay)).rejects.toMatchObject({ code: 'invalid-challenge' });
  });

  it('rejects tampered terms via the HMAC binding', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const merchant = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);

    const challenge = server.createChallenge({ amount: 10_000, currency: CUR, recipient: merchant.address });
    const tampered: MppChallenge = { ...challenge, request: { ...challenge.request, amount: '1' } };
    const credential = await createCredential(payer, tampered);

    await expect(server.verifyCredential(credential)).rejects.toMatchObject({ code: 'verification-failed' });
  });

  it('rejects a credential signed by the wrong key', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const attacker = createIdentity();
    const merchant = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);

    const challenge = server.createChallenge({ amount: 10_000, currency: CUR, recipient: merchant.address });
    const credential = await createCredential(attacker, challenge);
    credential.source = payer.did; // claim to be the payer but signed by attacker

    await expect(server.verifyCredential(credential)).rejects.toMatchObject({ code: 'verification-failed' });
  });
});

describe('MppClient over a fetch shim (header build/parse + retry)', () => {
  it('completes the 402 -> pay -> 200 dance and captures the receipt', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const merchant = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);

    const fetchImpl: typeof fetch = async (_url, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      if (!auth) {
        const challenge = server.createChallenge({ amount: 500, currency: CUR, recipient: merchant.address });
        return new Response(JSON.stringify({ challenge }), {
          status: 402,
          headers: { 'WWW-Authenticate': buildWwwAuthenticate(challenge), 'content-type': 'application/json' },
        });
      }
      const credential = decodeJson(auth.replace(/^Payment\s+/i, ''));
      const receipt = await server.verifyCredential(credential);
      return new Response(JSON.stringify({ seed: 'deadbeef' }), {
        status: 200,
        headers: { 'Payment-Receipt': encodeJson(receipt), 'content-type': 'application/json' },
      });
    };

    const client = new MppClient({ identity: payer, fetchImpl });
    const result = await client.fetch('http://svc.local/seed', { method: 'POST' });

    expect(result.paid).toBe(true);
    expect(result.response.status).toBe(200);
    expect(result.receipt?.settlement.amount).toBe('500');
    expect(provider.getBalance(merchant.address, CUR)).toBe(500);
    expect(await result.response.json()).toEqual({ seed: 'deadbeef' });
  });

  it('refuses to pay a charge above its budget cap', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const merchant = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);

    const fetchImpl: typeof fetch = async () => {
      const challenge = server.createChallenge({ amount: 10_000, currency: CUR, recipient: merchant.address });
      return new Response(JSON.stringify({ challenge }), {
        status: 402,
        headers: { 'WWW-Authenticate': buildWwwAuthenticate(challenge) },
      });
    };
    const client = new MppClient({ identity: payer, fetchImpl, maxAmount: 5_000 });
    await expect(client.fetch('http://svc.local/seed')).rejects.toMatchObject({ code: 'budget-exceeded' });
    expect(provider.getBalance(merchant.address, CUR)).toBe(0);
  });
});

describe('sessions (payment channels)', () => {
  it('opens, debits cumulative vouchers, and refunds on close', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const table = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);

    const auth = await createSessionAuthorization(payer, {
      recipient: table.address,
      currency: CUR,
      deposit: '1000',
      maxDeposit: '1000',
    });
    const session = await server.openSession(auth);
    expect(session.status).toBe('open');
    expect(provider.getBalance(payer.address, CUR)).toBe(999_000); // escrowed

    server.debitSession({ channelId: session.id, amount: 200 });
    const r2 = server.debitSession({ channelId: session.id, amount: 200 });
    expect(r2.acceptedCumulative).toBe('400');
    expect(provider.getBalance(table.address, CUR)).toBe(400);

    server.closeSession(session.id);
    // 1000 deposit - 400 drawn = 600 refunded
    expect(provider.getBalance(payer.address, CUR)).toBe(999_600);
    expect(server.getSession(session.id)?.status).toBe('closed');
  });

  it('rejects vouchers that exceed the channel deposit', async () => {
    const { provider, server } = freshServer();
    const payer = createIdentity();
    const table = createIdentity();
    provider.credit(payer.address, CUR, 1_000_000);
    const auth = await createSessionAuthorization(payer, {
      recipient: table.address,
      currency: CUR,
      deposit: '300',
      maxDeposit: '300',
    });
    const session = await server.openSession(auth);
    server.debitSession({ channelId: session.id, amount: 200 });
    expect(() => server.debitSession({ channelId: session.id, amount: 200 })).toThrow(MppError);
  });
});
