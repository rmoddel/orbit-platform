/**
 * Admin Authentication
 *
 * Handles Supabase authentication for admin users.
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;
let currentUser = null;
const authListeners = new Set();

/**
 * Initialize Supabase client for admin.
 *
 * @param {Object} config
 * @param {string} config.url - Supabase project URL
 * @param {string} config.anonKey - Supabase anon key
 */
export function initializeAdminAuth(config) {
  if (!config.url || !config.anonKey) {
    console.error('[AdminAuth] Supabase configuration required');
    return;
  }

  supabase = createClient(config.url, config.anonKey);

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    notifyListeners();
  });

  // Check initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    notifyListeners();
  });
}

/**
 * Get the Supabase client.
 */
export function getSupabase() {
  return supabase;
}

/**
 * Get the current authenticated user.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated() {
  return currentUser !== null;
}

/**
 * Sign in with email and password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: Object|null, error: Error|null}>}
 */
export async function signIn(email, password) {
  if (!supabase) {
    return { user: null, error: new Error('Supabase not initialized') };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!supabase) return;

  await supabase.auth.signOut();
  currentUser = null;
  notifyListeners();
}

/**
 * Subscribe to auth state changes.
 *
 * @param {function(Object|null): void} callback
 * @returns {function(): void} Unsubscribe function
 */
export function onAuthChange(callback) {
  authListeners.add(callback);
  // Call immediately with current state
  callback(currentUser);
  return () => authListeners.delete(callback);
}

function notifyListeners() {
  authListeners.forEach((cb) => cb(currentUser));
}

/**
 * Check if user has admin role.
 */
export async function checkAdminRole() {
  if (!supabase || !currentUser) return false;

  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if (error || !data) return false;

  return data.role === 'admin';
}
