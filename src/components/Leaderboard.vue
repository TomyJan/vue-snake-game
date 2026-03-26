<template>
  <div class="leaderboard">
    <!-- Login / User section -->
    <div class="lb-header">
      <h3>🏆 Leaderboard</h3>
      <div class="lb-auth">
        <template v-if="user">
          <img :src="user.avatar_url" class="avatar" :alt="user.login" />
          <span class="username">{{ user.login }}</span>
          <button class="btn-sm" @click="onLogout">Logout</button>
        </template>
        <template v-else>
          <button class="btn-sm btn-login" @click="showLogin = true">🔑 Login to compete</button>
        </template>
      </div>
    </div>

    <!-- Login modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
          <div class="modal">
            <h3>🔑 GitHub Login</h3>
            <p class="login-desc">
              Create a
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener"
              >
                Fine-grained Personal Access Token
              </a>
              with these permissions:
            </p>
            <ul class="scope-list">
              <li><strong>Repository access:</strong> TomyJan/vue-snake-game</li>
              <li><strong>Permissions:</strong> Issues → Read and Write</li>
            </ul>
            <p class="login-hint">
              This is needed to save your score. Your token stays in your browser only.
            </p>
            <input
              v-model="tokenInput"
              type="password"
              placeholder="github_pat_xxxxxxxxxxxxxxxx"
              class="token-input"
              @keydown.enter="onLogin"
            />
            <p v-if="loginError" class="error">{{ loginError }}</p>
            <div class="modal-actions">
              <button class="btn-sm btn-primary" @click="onLogin" :disabled="!tokenInput">
                Login
              </button>
              <button class="btn-sm" @click="showLogin = false">Cancel</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Leaderboard table -->
    <div class="lb-body" v-if="entries.length > 0">
      <div
        v-for="(entry, i) in entries"
        :key="entry.login + entry.date"
        class="lb-row"
        :class="{ 'is-me': user && entry.login === user.login }"
      >
        <span class="rank">{{ i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}` }}</span>
        <img :src="entry.avatar_url" class="row-avatar" :alt="entry.login" />
        <span class="row-name">{{ entry.login }}</span>
        <span class="row-score">{{ entry.score }}</span>
        <span class="row-length">🐍{{ entry.length }}</span>
      </div>
    </div>
    <div v-else-if="loading" class="lb-empty">Loading...</div>
    <div v-else class="lb-empty">No scores yet. Be the first! 🎮</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getToken,
  setToken,
  clearToken,
  getUser,
  fetchLeaderboard,
  type GitHubUser,
  type LeaderboardEntry,
} from '../services/github'

const user = ref<GitHubUser | null>(null)
const entries = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const showLogin = ref(false)
const tokenInput = ref('')
const loginError = ref('')

async function init() {
  const token = getToken()
  if (token) {
    try {
      user.value = await getUser(token)
    } catch {
      clearToken()
    }
  }
  await refreshLeaderboard()
}

async function refreshLeaderboard() {
  loading.value = true
  try {
    entries.value = await fetchLeaderboard()
  } catch {
    entries.value = []
  }
  loading.value = false
}

async function onLogin() {
  loginError.value = ''
  const token = tokenInput.value.trim()
  if (!token) return
  try {
    user.value = await getUser(token)
    setToken(token)
    showLogin.value = false
    tokenInput.value = ''
  } catch {
    loginError.value = 'Invalid token. Check your permissions.'
  }
}

function onLogout() {
  clearToken()
  user.value = null
}

defineExpose({ user, refreshLeaderboard })

onMounted(init)
</script>

<style scoped>
.leaderboard {
  width: 100%;
  max-width: 500px;
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px;
  margin-top: 12px;
}

.lb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.lb-header h3 {
  margin: 0;
  font-size: 18px;
}

.lb-auth {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.username {
  font-size: 14px;
  color: var(--accent);
  font-weight: bold;
}

.btn-sm {
  padding: 6px 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--card);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm:hover {
  border-color: var(--accent);
}

.btn-login {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: bold;
}

.btn-primary {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: bold;
}

.lb-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lb-row {
  display: grid;
  grid-template-columns: 40px 28px 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: transparent;
  transition: background 0.2s;
}

.lb-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.lb-row.is-me {
  background: rgba(var(--accent-rgb, 57, 255, 150), 0.1);
  border: 1px solid var(--accent);
}

.rank {
  font-size: 14px;
  text-align: center;
  font-weight: bold;
}

.row-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.row-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-score {
  font-size: 16px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  color: var(--accent);
}

.row-length {
  font-size: 12px;
  opacity: 0.6;
}

.lb-empty {
  text-align: center;
  padding: 20px;
  opacity: 0.5;
  font-size: 14px;
}

/* Login modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 28px;
  max-width: 420px;
  width: 90%;
}

.modal h3 {
  margin: 0 0 12px;
}

.login-desc {
  font-size: 13px;
  margin: 0 0 8px;
}

.login-desc a {
  color: var(--accent);
}

.scope-list {
  font-size: 12px;
  margin: 0 0 12px;
  padding-left: 20px;
  opacity: 0.8;
}

.scope-list li {
  margin: 4px 0;
}

.login-hint {
  font-size: 12px;
  opacity: 0.5;
  margin: 0 0 12px;
}

.token-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  font-family: monospace;
  box-sizing: border-box;
}

.token-input:focus {
  outline: none;
  border-color: var(--accent);
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 8px 0 0;
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
