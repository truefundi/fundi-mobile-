import { healthCheck, setBaseUrl } from '@workspace/api-client-react';

let configured = false;

/** Configure generated API requests once for the current Expo bundle. */
export function configureApi(): void {
  if (configured) return;

  setBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? null);
  configured = true;
}

/** Lightweight connectivity probe used during app startup and diagnostics. */
export async function checkApiHealth(): Promise<boolean> {
  configureApi();
  await healthCheck();
  return true;
}