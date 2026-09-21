import { expect, test } from 'vitest';
import { post } from './handler.js';
test('successful_signup', async () => {
  const emails: string[] = [];
  await expect(
    post('peer@example.com', {
      put: async (email) => {
        emails.push(email);
      },
    }),
  ).resolves.toBe('subscribed');
  expect(emails).toEqual(['peer@example.com']);
});
test('invalid_email', async () => {
  let writes = 0;
  await expect(
    post('not-an-email', {
      put: async () => {
        writes++;
      },
    }),
  ).rejects.toThrow('invalid_email');
  expect(writes).toBe(0);
});
test('storage_failure', async () => {
  await expect(
    post('peer@example.com', {
      put: async () => {
        throw new Error('storage unavailable');
      },
    }),
  ).rejects.toThrow('storage unavailable');
});
