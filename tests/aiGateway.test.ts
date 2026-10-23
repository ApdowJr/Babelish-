import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAiGatewayTransport, resolveGatewayBase } from '../src/lib/aiGateway';

test('resolveGatewayBase prefers explicit base, then env URL, then Supabase functions URL', () => {
  assert.equal(
    resolveGatewayBase(
      'https://custom.example.org///',
      'https://env.example.org',
      'https://proj.supabase.co/functions/v1'
    ),
    'https://custom.example.org'
  );
  assert.equal(
    resolveGatewayBase(undefined, 'https://env.example.org/', 'https://proj.supabase.co/functions/v1'),
    'https://env.example.org'
  );
  assert.equal(
    resolveGatewayBase('   ', undefined, 'https://dvgluivslmdrqsvlscmj.supabase.co/functions/v1/'),
    'https://dvgluivslmdrqsvlscmj.supabase.co/functions/v1/babelish-ai'
  );
});

test('buildAiGatewayTransport preserves JWT and apikey even when EXPO_PUBLIC_AI_GATEWAY_URL is unset', () => {
  const transport = buildAiGatewayTransport({
    jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
    envGatewayUrl: '',
    supabaseFunctionsUrl: 'https://dvgluivslmdrqsvlscmj.supabase.co/functions/v1',
    supabasePublishableKey: 'sb_publishable_example',
  });
  assert.deepEqual(transport, {
    apiBase: 'https://dvgluivslmdrqsvlscmj.supabase.co/functions/v1/babelish-ai',
    jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
    apiKey: 'sb_publishable_example',
  });
});

test('buildAiGatewayTransport omits Supabase apikey on third-party custom gateways and returns null when unconfigured', () => {
  const custom = buildAiGatewayTransport({
    jwt: 'jwt-1',
    envGatewayUrl: 'https://my-proxy.example.org',
    supabaseFunctionsUrl: 'https://dvgluivslmdrqsvlscmj.supabase.co/functions/v1',
    supabasePublishableKey: 'sb_publishable_example',
  });
  assert.deepEqual(custom, {
    apiBase: 'https://my-proxy.example.org',
    jwt: 'jwt-1',
  });

  assert.equal(
    buildAiGatewayTransport({
      jwt: 'jwt-1',
      envGatewayUrl: '',
      supabaseFunctionsUrl: '',
    }),
    null
  );
});
