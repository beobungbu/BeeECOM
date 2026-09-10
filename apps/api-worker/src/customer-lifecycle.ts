import type { ApiFailure, ApiSuccess, CustomerUpdateInput } from '@beeecom/contracts';
import type { Address, Customer } from '@beeecom/domain';

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: Array<string | number | null>): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface CustomerLifecycleEnv {
  DB: D1Database;
  DEFAULT_SCENARIO?: string;
  CORS_ORIGINS?: string;
}

interface RequestContext {
  requestId: string;
  scenario: string;
}

function allowedOrigin(request: Request, env: CustomerLifecycleEnv): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = (env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes('*') || configured.includes(origin)) return origin;
  return null;
}

function responseHeaders(request: Request, env: CustomerLifecycleEnv): Headers {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'origin');
    headers.set('access-control-allow-headers', 'authorization, content-type, x-demo-reset-token');
    headers.set('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  return headers;
}

async function context(env: CustomerLifecycleEnv): Promise<RequestContext> {
  const row = await env.DB.prepare('SELECT scenario FROM demo_state WHERE id = 1').first<{ scenario: string }>();
  return {
    requestId: crypto.randomUUID(),
    scenario: row?.scenario ?? env.DEFAULT_SCENARIO ?? 'healthy',
  };
}

async function ok<T>(request: Request, env: CustomerLifecycleEnv, data: T): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status: 200, headers: responseHeaders(request, env) });
}

async function fail(
  request: Request,
  env: CustomerLifecycleEnv,
  status: number,
  code: string,
  message: string,
): Promise<Response> {
  const payload: ApiFailure = { ok: false, error: { code, message }, meta: await context(env) };
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders(request, env) });
}

function parseCustomer(row: { data_json: string }): Customer {
  return JSON.parse(row.data_json) as Customer;
}

function present(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function updateAddress(current: Address, input: NonNullable<CustomerUpdateInput['address']>): Address {
  return {
    ...current,
    label: input.label === undefined ? current.label : input.label.trim(),
    fullName: input.fullName === undefined ? current.fullName : input.fullName.trim(),
    phone: input.phone === undefined ? current.phone : input.phone.trim(),
    line1: input.line1 === undefined ? current.line1 : input.line1.trim(),
    line2: input.line2 === undefined ? current.line2 : input.line2.trim() || undefined,
    city: input.city === undefined ? current.city : input.city.trim(),
    region: input.region === undefined ? current.region : input.region.trim(),
    postalCode: input.postalCode === undefined ? current.postalCode : input.postalCode.trim(),
    countryCode: input.countryCode === undefined ? current.countryCode : input.countryCode.trim().toUpperCase(),
    isDefault: input.isDefault === undefined ? current.isDefault : input.isDefault,
  };
}

function validateAddress(address: Address): string | null {
  if (!present(address.label)) return 'Address label is required.';
  if (!present(address.fullName)) return 'Recipient name is required.';
  if (!present(address.phone)) return 'Phone is required.';
  if (!present(address.line1)) return 'Address line is required.';
  if (!present(address.city)) return 'City is required.';
  if (!present(address.region)) return 'Region is required.';
  if (!present(address.postalCode)) return 'Postal code is required.';
  if (!/^[A-Z]{2}$/.test(address.countryCode)) return 'Country code must contain two letters.';
  return null;
}

export async function handleCustomerLifecycle(
  request: Request,
  env: CustomerLifecycleEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const customerMatch = path.match(/^\/api\/v1\/customers\/([^/]+)$/);
  if (!customerMatch || request.method !== 'PATCH') return null;

  const customerId = decodeURIComponent(customerMatch[1]!);
  const row = await env.DB.prepare('SELECT data_json FROM customers WHERE id = ?')
    .bind(customerId)
    .first<{ data_json: string }>();
  if (!row) return fail(request, env, 404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.');

  const body = await request.json().catch(() => null) as CustomerUpdateInput | null;
  if (!body || (body.displayName === undefined && body.email === undefined && body.address === undefined)) {
    return fail(request, env, 400, 'INVALID_CUSTOMER_UPDATE', 'At least one customer setting is required.');
  }

  const customer = parseCustomer(row);
  const displayName = body.displayName === undefined ? customer.displayName : body.displayName.trim();
  const email = body.email === undefined ? customer.email : body.email.trim().toLowerCase();
  if (!displayName) return fail(request, env, 400, 'INVALID_CUSTOMER_NAME', 'Display name is required.');
  if (!validEmail(email)) return fail(request, env, 400, 'INVALID_CUSTOMER_EMAIL', 'A valid email address is required.');

  if (email !== customer.email) {
    const duplicate = await env.DB.prepare('SELECT id FROM customers WHERE email = ? AND id <> ?')
      .bind(email, customer.id)
      .first<{ id: string }>();
    if (duplicate) return fail(request, env, 409, 'CUSTOMER_EMAIL_IN_USE', 'That email address is already in use.');
  }

  let addresses = customer.addresses;
  if (body.address) {
    const index = customer.addresses.findIndex((address) => address.id === body.address!.id);
    if (index < 0) return fail(request, env, 404, 'ADDRESS_NOT_FOUND', 'Delivery address was not found.');

    const updatedAddress = updateAddress(customer.addresses[index]!, body.address);
    const addressError = validateAddress(updatedAddress);
    if (addressError) return fail(request, env, 400, 'INVALID_ADDRESS', addressError);

    addresses = customer.addresses.map((address, addressIndex) => {
      if (addressIndex === index) return updatedAddress;
      if (body.address?.isDefault === true) return { ...address, isDefault: false };
      return address;
    });

    if (!addresses.some((address) => address.isDefault)) {
      return fail(request, env, 409, 'DEFAULT_ADDRESS_REQUIRED', 'At least one delivery address must remain the default.');
    }
  }

  const updated: Customer = { ...customer, displayName, email, addresses };
  await env.DB.prepare('UPDATE customers SET email = ?, data_json = ? WHERE id = ?')
    .bind(updated.email, JSON.stringify(updated), updated.id)
    .run();

  return ok(request, env, updated);
}
