/**
 * Admin Application Entry Point
 */

import { createApp, ref, computed, onMounted } from 'vue';
import { createPinia } from 'pinia';

import { initializeAdminAuth, onAuthChange, isAuthenticated } from './auth.js';
import AdminLogin from './components/AdminLogin.vue';
import AdminDashboard from './components/AdminDashboard.vue';

const AdminApp = {
  components: {
    AdminLogin,
    AdminDashboard,
  },

  setup() {
    const user = ref(null);
    const loading = ref(true);
    const campaignId = ref('toras-zev'); // Default campaign

    const isLoggedIn = computed(() => user.value !== null);

    function handleLogin(loggedInUser) {
      user.value = loggedInUser;
    }

    onMounted(() => {
      // Initialize auth
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        initializeAdminAuth({ url: supabaseUrl, anonKey: supabaseKey });
      }

      // Listen for auth changes
      onAuthChange((currentUser) => {
        user.value = currentUser;
        loading.value = false;
      });

      // Check URL for campaign
      const params = new URLSearchParams(window.location.search);
      const urlCampaign = params.get('campaign');
      if (urlCampaign) {
        campaignId.value = urlCampaign;
      }
    });

    return {
      user,
      loading,
      isLoggedIn,
      campaignId,
      handleLogin,
    };
  },

  template: `
    <div class="admin-app">
      <div v-if="loading" class="admin-app__loading">
        <div class="admin-app__spinner"></div>
        <p>Loading...</p>
      </div>
      <AdminLogin v-else-if="!isLoggedIn" @login="handleLogin" />
      <AdminDashboard v-else :campaign-id="campaignId" />
    </div>
  `,
};

// Mount application
const app = createApp(AdminApp);
app.use(createPinia());
app.mount('#admin-app');
