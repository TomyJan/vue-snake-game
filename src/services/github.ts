/**
 * GitHub OAuth + Leaderboard storage via Issue #1 comments.
 *
 * Flow:
 * 1. User clicks "Login with GitHub" → redirect to GitHub OAuth
 * 2. GitHub redirects back with ?code=xxx
 * 3. We exchange the code for an access token (via proxy or PAT fallback)
 * 4. Store token in localStorage for API calls
 * 5. Leaderboard entries are stored as comments on Issue #1
 */

const GITHUB_API = 'https://api.github.com'
const OWNER = 'TomyJan'
const REPO = 'vue-snake-game'
const ISSUE_NUMBER = 1

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

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  const t = token ?? getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

/** Verify a token and get the user info */
export async function getUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) })
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
  return res.json()
}

/** Submit a score as a comment on Issue #1 */
export async function submitScore(
  token: string,
  score: number,
  length: number,
): Promise<void> {
  const user = await getUser(token)
  const entry: LeaderboardEntry = {
    login: user.login,
    avatar_url: user.avatar_url,
    score,
    length,
    date: new Date().toISOString(),
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}/comments`,
    {
      method: 'POST',
      headers: {
        ...headers(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: `<!-- snake-score -->\n\`\`\`json\n${JSON.stringify(entry)}\n\`\`\``,
      }),
    },
  )
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`)
}

/** Fetch all leaderboard entries from Issue #1 comments */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const entries: LeaderboardEntry[] = []
  let page = 1

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/repos/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}/comments?per_page=100&page=${page}`,
      { headers: headers() },
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
