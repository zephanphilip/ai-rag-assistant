const SESSION_KEY = 'handbook_session_id';

export function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}
