import type { NewsletterStore } from './storage.js';
export async function subscribe(
  email: string,
  store: NewsletterStore,
): Promise<string> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error('invalid_email');
  await store.put(email);
  return 'subscribed';
}
