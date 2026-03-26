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
          <button class="btn-sm btn-login" @click="onStartLogin">🔑 Login with GitHub</button>
        </template>
      </div>
    </div>

    <!-- Device Flow login modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showLogin" class="modal-overlay" @click.self="cancelLogin">
          <div class="modal">
            <h3>🔑 Login with GitHub</h3>

            <!-- Step 1: Loading -->
            <div v-if="loginStep === 'loading'" class="login-loading">
              <div class="spinner"></div>
              <p>Requesting device code...</p>
            </div>

            <!-- Step 2: Show code, wait for authorization -->
            <div v-else-if="loginStep === 'code'">
              <p class="login-desc">Click the button below to open GitHub, then enter this code:</p>
              <div class="user-code">{{ deviceUserCode }}</div>
              <a
                :href="deviceVerifyUrl"
                target="_blank"
                rel="noopener"
                class="btn-sm btn-primary btn-github"
              >
                Open GitHub to Authorize →
              </a>
              <p class="login-hint">
                Waiting for authorization...
                <span class="spinner-sm"></span>
              </p>
            </div>

            <!-- Error -->
            <p v-if="loginError" class="error">{{ loginError }}</p>

            <div class="modal-actions">
              <button class="btn-sm" @click="cancelLogin">Cancel</button>
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
  startDeviceFlow,
  type GitHubUser,
  type LeaderboardEntry,
} from '../services/github'

const user = ref<GitHubUser | null>(null)
const entries = ref<LeaderboardEntry[]>([])
const loading = ref(true)

// Device Flow state
const showLogin = ref(false)
const loginStep = ref<'loading' | 'code'>('loading')
const deviceUserCode = ref('')
const deviceVerifyUrl = ref('')
const loginError = ref('')
let cancelFlow: (() => void) | null = null

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

function onStartLogin() {
  showLogin.value = true
  loginStep.value = 'loading'
  loginError.value = ''

  cancelFlow = startDeviceFlow({
    onDeviceCode(state) {
      deviceUserCode.value = state.userCode
      deviceVerifyUrl.value = `${state.verificationUri}?user_code=${state.userCode}`
      loginStep.value = 'code'
    },
    onToken(token) {
      setToken(token)
      showLogin.value = false
      cancelFlow = null
      // Re-fetch user with the new token
      getUser(token)
        .then((u) => {
          user.value = u
        })
        .catch(() => {})
    },
    onError(err) {
      if (err.message === 'Device code expired') {
        loginError.value = 'Code expired. Please try again.'
      } else if (err.message === 'access_denied') {
        loginError.value = 'Login cancelled.'
      } else {
        loginError.value = err.message
      }
      loginStep.value = 'loading' // hide the code section
    },
  })
}

function cancelLogin() {
  if (cancelFlow) {
    cancelFlow()
    cancelFlow = null
  }
  showLogin.value = false
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
  text-decoration: none;
  display: inline-block;
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

.btn-github {
  margin-top: 16px;
  font-size: 14px;
  padding: 10px 20px;
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
  background: rgba(57, 255, 150, 0.1);
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
  text-align: center;
}

.modal h3 {
  margin: 0 0 16px;
}

.login-desc {
  font-size: 14px;
  margin: 0 0 16px;
  opacity: 0.8;
}

.user-code {
  font-size: 32px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  letter-spacing: 6px;
  padding: 16px;
  background: var(--bg);
  border: 2px dashed var(--accent);
  border-radius: 12px;
  color: var(--accent);
  user-select: all;
}

.login-hint {
  font-size: 13px;
  opacity: 0.5;
  margin-top: 16px;
}

.login-loading {
  padding: 30px 0;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--card-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--card-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
  margin-left: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 12px 0 0;
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: center;
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
