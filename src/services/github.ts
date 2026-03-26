/**
 * GitHub Device Flow OAuth + Leaderboard storage via Issue #1 comments.
 *
 * Device Flow (RFC 8628):
 * 1. App requests a device_code + user_code from GitHub
 * 2. User clicks link → opens github.com/login/device (code pre-filled)
 * 3. User authorizes the app on GitHub
 * 4. App polls for access token, logs user in
 */

const GITHUB_API = 'https://api.github.com'
const GITHUB_LOGIN = 'https://github.com/login'
const OWNER = 'TomyJan'
const REPO = 'vue-snake-game'
const ISSUE_NUMBER = 1

// OAuth App Client ID (public, safe to embed)
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23lijMcankB5iY4lXU'

// Scopes: we need to post comments on issues
const SCOPE = 'public_repo'

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
  html_url: string
}

export interface LeaderboardEntry {
  login: string
  avatar_url: string
  score: number
  length: number
  date: string
}

export interface DeviceFlowState {
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

const TOKEN_KEY = 'snake-github-token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  const t = token ?? getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

// ===== Device Flow =====

/**
 * Step 1: Request a device code from GitHub
 */
export async function requestDeviceCode(): Promise<DeviceFlowState> {
  const res = await fetch(`${GITHUB_LOGIN}/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPE,
    }),
  })
  if (!res.ok) throw new Error(`Device code request failed: ${res.status}`)
  const data = await res.json()
  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval ?? 5,
  }
}

/**
 * Step 2: Poll GitHub for the access token after user authorizes
 * Returns the access token or null if still pending/expired
 */
export async function pollForToken(deviceCode: string, interval: number): Promise<string | null> {
  // Wait the required interval
  await new Promise((r) => setTimeout(r, interval * 1000))

  const res = await fetch(`${GITHUB_LOGIN}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  })
  if (!res.ok) throw new Error(`Token poll failed: ${res.status}`)
  const data = await res.json()

  if (data.access_token) {
    return data.access_token
  }

  // data.error: "authorization_pending" | "slow_down" | "expired_token" | "access_denied"
  if (data.error === 'authorization_pending') return null
  if (data.error === 'slow_down') return null // will retry with longer interval
  if (data.error === 'expired_token' || data.error === 'access_denied') {
    throw new Error(data.error)
  }
  return null
}

/**
 * Start the full Device Flow login process.
 * Calls onDeviceCode when we have the user code (show it to user).
 * Calls onToken when login succeeds.
 * Calls onError on failure.
 * Returns a cancel function.
 */
export function startDeviceFlow(callbacks: {
  onDeviceCode: (state: DeviceFlowState) => void
  onToken: (token: string) => void
  onError: (error: Error) => void
}): () => void {
  let cancelled = false
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  async function run() {
    try {
      const state = await requestDeviceCode()
      if (cancelled) return
      callbacks.onDeviceCode(state)

      let currentInterval = state.interval
      const deadline = Date.now() + state.expiresIn * 1000

      async function poll() {
        if (cancelled) return
        if (Date.now() > deadline) {
          callbacks.onError(new Error('Device code expired'))
          return
        }
        try {
          const token = await pollForToken(state.userCode, currentInterval)
          if (cancelled) return
          if (token) {
            callbacks.onToken(token)
          } else {
            // Slow down if GitHub says so
            currentInterval = Math.max(currentInterval, 5)
            pollTimer = setTimeout(poll, 0)
          }
        } catch (err: unknown) {
          if (!cancelled) callbacks.onError(err instanceof Error ? err : new Error(String(err)))
        }
      }
      poll()
    } catch (err: unknown) {
      if (!cancelled) callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  run()

  return () => {
    cancelled = true
    if (pollTimer) clearTimeout(pollTimer)
  }
}

// ===== User & Leaderboard API =====

/** Verify a token and get the user info */
export async function getUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: authHeaders(token) })
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
  return res.json()
}

/** Submit a score as a comment on Issue #1 */
export async function submitScore(token: string, score: number, length: number): Promise<void> {
  const user = await getUser(token)
  const entry: LeaderboardEntry = {
    login: user.login,
    avatar_url: user.avatar_url,
    score,
    length,
    date: new Date().toISOString(),
  }

  const res = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}/comments`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: `<!-- snake-score -->\n\`\`\`json\n${JSON.stringify(entry)}\n\`\`\``,
    }),
  })
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`)
}

/** Fetch all leaderboard entries from Issue #1 comments */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const entries: LeaderboardEntry[] = []
  let page = 1

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/repos/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}/comments?per_page=100&page=${page}`,
      { headers: authHeaders() },
    )
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const comments: { body: string; user: { login: string; avatar_url: string } }[] =
      await res.json()
    if (comments.length === 0) break

    for (const c of comments) {
      const match = c.body.match(/<!-- snake-score -->\s*```json\s*([\s\S]*?)```/)
      if (match) {
        try {
          const data = JSON.parse(match[1])
          entries.push({
            login: data.login ?? c.user.login,
            avatar_url: data.avatar_url ?? c.user.avatar_url,
            score: data.score ?? 0,
            length: data.length ?? 0,
            date: data.date ?? '',
          })
        } catch {
          // skip malformed entries
        }
      }
    }

    if (comments.length < 100) break
    page++
  }

  // Sort by score descending, deduplicate (keep highest per user)
  entries.sort((a, b) => b.score - a.score)
  const best = new Map<string, LeaderboardEntry>()
  for (const e of entries) {
    if (!best.has(e.login) || e.score > best.get(e.login)!.score) {
      best.set(e.login, e)
    }
  }

  return Array.from(best.values()).sort((a, b) => b.score - a.score)
}
