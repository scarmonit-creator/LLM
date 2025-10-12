/**
 * Mail.tm agent
 *
 * This module provides helper functions to interact with the
 * [Mail.tm API](https://docs.mail.tm) which exposes disposable email
 * accounts. It exposes methods to authenticate using an address and
 * password, fetch messages, and send emails. The functions return
 * plain JSON objects parsed from the API responses. When run in
 * environments where network access is available, these helpers can
 * be used directly. When network access is blocked (as in this
 * sandbox), consider using the browser-based HTML file
 * `mailtm_get_messages.html` to fetch messages via a remote
 * browser and then parse the results.
 */

export interface MailTmAccount {
  address: string;
  password: string;
}

export interface MailTmToken {
  token: string;
  expiresAt: string;
}

/**
 * Obtain an authentication token for a mail.tm account.
 *
 * @param account - The email address and password for the account.
 * @returns A promise resolving with the token and expiry.
 */
export async function getToken(account: MailTmAccount): Promise<MailTmToken> {
  const res = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account)
  });
  if (!res.ok) {
    throw new Error(`Failed to get token: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<MailTmToken>;
}

/**
 * List messages in the inbox.
 *
 * Returns a paginated list of messages. You can supply the page
 * parameter to navigate results. See docs for more details.
 *
 * @param token - The bearer token for authentication.
 * @param page - Optional page number (default 1)
 */
export async function getMessages(
  token: string,
  page = 1
): Promise<any> {
  const url = new URL('https://api.mail.tm/messages');
  url.searchParams.set('page', String(page));
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to list messages: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Send an email via mail.tm. Note that the API requires that the
 * sender and recipient addresses both be managed by mail.tm. Attempting to send to
 * external domains will fail. See the documentation for details.
 *
 * @param token - Bearer token obtained via getToken.
 * @param message - Message fields for sending.
 */
export async function sendMessage(
  token: string,
  message: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }
): Promise<any> {
  const res = await fetch('https://api.mail.tm/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });
  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch a single message's full contents by its id.
 *
 * @param token - Bearer token for authentication.
 * @param id - The message ID returned from getMessages.
 */
export async function getMessage(token: string, id: string): Promise<any> {
  const res = await fetch(`https://api.mail.tm/messages/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch message ${id}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Delete a message by its id.
 *
 * @param token - Bearer token for authentication.
 * @param id - Message id to delete.
 */
export async function deleteMessage(token: string, id: string): Promise<boolean> {
  const res = await fetch(`https://api.mail.tm/messages/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.ok;
}

// When executed directly, demonstrate listing messages for a test account.
// Note: This uses Deno-specific APIs. For Node.js, use process.env instead.
if (typeof import.meta !== 'undefined' && (import.meta as any).main) {
  const email = process.env.MAILTM_ADDRESS || 'test@example.com';
  const password = process.env.MAILTM_PASSWORD || '';
  if (!password) {
    console.error('Set MAILTM_ADDRESS and MAILTM_PASSWORD env vars to list messages');
    process.exit(1);
  }
  try {
    const { token } = await getToken({ address: email, password });
    const messages = await getMessages(token);
    console.log(JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error(err);
  }
}