import { Redirect } from 'expo-router';

/**
 * Dev-only crash probe.
 *
 * The ErrorBoundary can only be trusted if it is seen working on a real
 * device, and waiting for a genuine crash is not a test plan. Open
 * `/dev-crash` in a development build: the route throws on render and the
 * crash screen (Try again / Back to Learn) should appear instead of a blank
 * page. In a production build this file redirects home and throws nothing.
 */
export default function CrashProbe() {
  if (!__DEV__) return <Redirect href="/" />;
  throw new Error('Crash probe — deliberate, development only.');
}
