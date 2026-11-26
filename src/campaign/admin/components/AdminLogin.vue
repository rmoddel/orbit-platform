<script setup>
/**
 * Admin Login Component
 */

import { ref } from 'vue';
import { signIn } from '../auth.js';

const emit = defineEmits(['login']);

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  if (!email.value || !password.value) {
    error.value = 'Please enter email and password';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const result = await signIn(email.value, password.value);

    if (result.error) {
      error.value = result.error.message;
      return;
    }

    emit('login', result.user);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="admin-login__card">
      <h1 class="admin-login__title">Admin Login</h1>
      <p class="admin-login__subtitle">Orbit Platform Administration</p>

      <form @submit.prevent="handleSubmit" class="admin-login__form">
        <div class="admin-login__field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="admin@example.com"
            autocomplete="email"
            :disabled="loading"
          />
        </div>

        <div class="admin-login__field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>

        <div v-if="error" class="admin-login__error">
          {{ error }}
        </div>

        <button type="submit" class="admin-login__submit" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.admin-login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #0a0a0f;
  padding: 24px;
}

.admin-login__card {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 40px;
}

.admin-login__title {
  font-size: 24px;
  font-weight: 500;
  color: white;
  margin: 0 0 8px;
  text-align: center;
}

.admin-login__subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 32px;
  text-align: center;
}

.admin-login__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.admin-login__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-login__field label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.admin-login__field input {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.admin-login__field input:focus {
  outline: none;
  border-color: #d4af37;
}

.admin-login__field input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.admin-login__error {
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
}

.admin-login__submit {
  padding: 14px 24px;
  background: linear-gradient(135deg, #d4af37, #b8860b);
  border: none;
  border-radius: 8px;
  color: #0a0a0f;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.admin-login__submit:hover:not(:disabled) {
  transform: translateY(-2px);
}

.admin-login__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
