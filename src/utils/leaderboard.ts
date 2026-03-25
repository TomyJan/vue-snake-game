// Leaderboard using GitHub Issues API as database
// Scores are stored as comments on a designated issue

const REPO_OWNER = 'TomyJan'
const REPO_NAME = 'vue-snake-game'
const ISSUE_NUMBER = 1 // The leaderboard issue number

interface ScoreEntry {
  name: string
  score: number
  length: number
  date: string
  commit: string
}

interface GitHubComment {
  id: number
  body: string
  user: { login: string; avatar_url: string }
  created_at: string
}

const TOKEN_KEY = 'snake-github-token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// Format score as a comment body
function encodeScore(entry: ScoreEntry): string {
  return [
    '## 🐍 Snake Score',
    '',
    `- **Player:** ${entry.name}`,
    `- **Score:** ${entry.score}`,
    `- **Length:** ${entry.length}`,
    `- **Version:** ${entry.commit}`,
    '',
    '<!-- snake-score:' +
      btoa(
        JSON.stringify({
          n: entry.name,
          s: entry.score,
          l: entry.length,
          d: entry.date,
          c: entry.commit,
        }),
      ) +
      '-->',
  ].join('\n')
}

// Parse score from comment body
function decodeScore(comment: GitHubComment): ScoreEntry | null {
  const match = comment.body.match(/<!-- snake-score:(.*?)-->/)
  if (!match) return null
  try {
    const data = JSON.parse(atob(match[1]))
    return {
      name: data.n,
      score: data.s,
      length: data.l,
      date: data.d,
      commit: data.c,
    }
  } catch {
    return null
  }
}

// Submit a score (requires token)
export async function submitScore(entry: ScoreEntry): Promise<boolean> {
  const token = getToken()
  if (!token) return false

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${ISSUE_NUMBER}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: encodeScore(entry) }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

// Fetch leaderboard (public, no token needed for public repos)
export async function fetchLeaderboard(limit = 20): Promise<ScoreEntry[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${ISSUE_NUMBER}/comments?per_page=100&sort=created&direction=desc`,
      {
        headers: { Accept: 'application/vnd.github+json' },
      },
    )
    if (!res.ok) return []
    const comments: GitHubComment[] = await res.json()
    const scores = comments.map(decodeScore).filter(Boolean) as ScoreEntry[]
    // Deduplicate by name, keep highest score
    const best = new Map<string, ScoreEntry>()
    for (const s of scores) {
      const existing = best.get(s.name)
      if (!existing || s.score > existing.score) {
        best.set(s.name, s)
      }
    }
    return Array.from(best.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  } catch {
    return []
  }
}

// GitHub Device Flow login
export async function startDeviceFlow(): Promise<{
  device_code: string
  user_code: string
  verification_uri: string
} | null> {
  try {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'Ov23li2EXAMPLE', // You need to create a GitHub OAuth App
        scope: 'public_repo',
      }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function pollForToken(deviceCode: string): Promise<string | null> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    try {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'Ov23li2EXAMPLE',
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      })
      const data = await res.json()
      if (data.access_token) {
        setToken(data.access_token)
        return data.access_token
      }
      if (data.error === 'authorization_pending') continue
      if (data.error === 'slow_down') {
        await new Promise((r) => setTimeout(r, 5000))
        continue
      }
      return null
    } catch {
      return null
    }
  }
  return null
}

// Local leaderboard (fallback)
const LOCAL_KEY = 'snake-leaderboard'

export function getLocalLeaderboard(): ScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveLocalScore(entry: ScoreEntry) {
  const board = getLocalLeaderboard()
  board.push(entry)
  board.sort((a, b) => b.score - a.score)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(board.slice(0, 50)))
}
