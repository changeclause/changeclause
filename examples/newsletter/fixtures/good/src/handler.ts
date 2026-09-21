import { subscribe } from './newsletter.js';
import type { NewsletterStore } from './storage.js';
export async function post(
  email: string,
  store: NewsletterStore,
): Promise<string> {
  return subscribe(email, store);
}
