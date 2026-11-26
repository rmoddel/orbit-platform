<script setup>
/**
 * Admin Dashboard Component
 *
 * Main admin interface for managing donors.
 */

import { ref, computed, onMounted } from 'vue';
import { signOut, getCurrentUser } from '../auth.js';
import {
  getAllDonors,
  createDonor,
  updateDonor,
  deleteDonor,
  generatePrivateToken,
  revokePrivateToken,
  getPrivateLinkUrl,
  removeDemoDonors,
  getCampaign,
} from '../service.js';

const props = defineProps({
  campaignId: { type: String, required: true },
});

// State
const donors = ref([]);
const campaign = ref(null);
const loading = ref(true);
const error = ref(null);
const selectedDonor = ref(null);
const showDonorForm = ref(false);
const showDeleteConfirm = ref(false);
const copiedLink = ref(null);

// Form state
const donorForm = ref({
  publicDisplayName: '',
  privateDonorName: '',
  donationAmount: '',
  isAnonymous: false,
  dedication: '',
  hebrewDedication: '',
  starTier: 1,
  notes: '',
});

const user = getCurrentUser();

// Computed
const donorCount = computed(() => donors.value.length);
const demoDonorCount = computed(
  () => donors.value.filter((d) => d.is_demo).length,
);

const sortedDonors = computed(() =>
  [...donors.value].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  ),
);

// Methods
async function loadData() {
  loading.value = true;
  error.value = null;

  try {
    const [donorsData, campaignData] = await Promise.all([
      getAllDonors(props.campaignId),
      getCampaign(props.campaignId),
    ]);

    donors.value = donorsData;
    campaign.value = campaignData;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openAddDonor() {
  selectedDonor.value = null;
  donorForm.value = {
    publicDisplayName: '',
    privateDonorName: '',
    donationAmount: '',
    isAnonymous: false,
    dedication: '',
    hebrewDedication: '',
    starTier: 1,
    notes: '',
  };
  showDonorForm.value = true;
}

function openEditDonor(donor) {
  selectedDonor.value = donor;
  donorForm.value = {
    publicDisplayName: donor.public_display_name,
    privateDonorName: donor.private_donor_name || '',
    donationAmount: donor.donation_amount || '',
    isAnonymous: donor.is_anonymous,
    dedication: donor.dedication || '',
    hebrewDedication: donor.hebrew_dedication || '',
    starTier: donor.star_tier || 1,
    notes: donor.notes || '',
  };
  showDonorForm.value = true;
}

async function saveDonor() {
  try {
    const data = {
      publicDisplayName: donorForm.value.publicDisplayName,
      privateDonorName: donorForm.value.privateDonorName || undefined,
      donationAmount: donorForm.value.donationAmount
        ? parseFloat(donorForm.value.donationAmount)
        : undefined,
      isAnonymous: donorForm.value.isAnonymous,
      dedication: donorForm.value.dedication || undefined,
      hebrewDedication: donorForm.value.hebrewDedication || undefined,
      starTier: donorForm.value.starTier,
      notes: donorForm.value.notes || undefined,
    };

    if (selectedDonor.value) {
      await updateDonor(selectedDonor.value.id, data);
    } else {
      await createDonor(props.campaignId, data);
    }

    showDonorForm.value = false;
    await loadData();
  } catch (e) {
    error.value = e.message;
  }
}

function confirmDelete(donor) {
  selectedDonor.value = donor;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!selectedDonor.value) return;

  try {
    await deleteDonor(selectedDonor.value.id);
    showDeleteConfirm.value = false;
    selectedDonor.value = null;
    await loadData();
  } catch (e) {
    error.value = e.message;
  }
}

async function generateLink(donor) {
  try {
    const token = await generatePrivateToken(donor.id);
    const url = getPrivateLinkUrl(token);

    await navigator.clipboard.writeText(url);
    copiedLink.value = donor.id;

    setTimeout(() => {
      copiedLink.value = null;
    }, 3000);

    await loadData();
  } catch (e) {
    error.value = e.message;
  }
}

async function revokeLink(donor) {
  try {
    await revokePrivateToken(donor.id);
    await loadData();
  } catch (e) {
    error.value = e.message;
  }
}

async function handleRemoveDemos() {
  if (!confirm('Remove all demo donors? This cannot be undone.')) return;

  try {
    await removeDemoDonors(props.campaignId);
    await loadData();
  } catch (e) {
    error.value = e.message;
  }
}

async function handleSignOut() {
  await signOut();
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(amount, currency = '$') {
  if (!amount) return '—';
  return `${currency}${amount.toLocaleString()}`;
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="admin-dashboard">
    <!-- Header -->
    <header class="admin-header">
      <div class="admin-header__brand">
        <h1>{{ campaign?.name || 'Campaign Admin' }}</h1>
        <span class="admin-header__badge">{{ donorCount }} donors</span>
      </div>
      <div class="admin-header__actions">
        <span class="admin-header__user">{{ user?.email }}</span>
        <button class="admin-header__logout" @click="handleSignOut"
          >Sign Out</button
        >
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="admin-loading">Loading...</div>

    <!-- Error -->
    <div v-else-if="error" class="admin-error">
      <span>{{ error }}</span>
      <button @click="loadData">Retry</button>
    </div>

    <!-- Content -->
    <div v-else class="admin-content">
      <!-- Toolbar -->
      <div class="admin-toolbar">
        <button class="admin-btn admin-btn--primary" @click="openAddDonor">
          <span class="material-symbols-outlined">add</span>
          Add Donor
        </button>

        <div class="admin-toolbar__spacer"></div>

        <div v-if="demoDonorCount > 0" class="admin-toolbar__warning">
          <span class="material-symbols-outlined">warning</span>
          {{ demoDonorCount }} demo donors
          <button class="admin-btn admin-btn--small" @click="handleRemoveDemos"
            >Remove</button
          >
        </div>
      </div>

      <!-- Donors Table -->
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Display Name</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Private Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="donor in sortedDonors"
              :key="donor.id"
              :class="{ 'admin-table__row--demo': donor.is_demo }"
            >
              <td>
                <div class="admin-donor-name">
                  <span
                    class="admin-donor-name__display"
                    :dir="
                      donor.public_display_name?.match(/[\u0590-\u05FF]/)
                        ? 'rtl'
                        : 'ltr'
                    "
                  >
                    {{ donor.public_display_name }}
                  </span>
                  <span
                    v-if="donor.private_donor_name"
                    class="admin-donor-name__private"
                  >
                    ({{ donor.private_donor_name }})
                  </span>
                  <span
                    v-if="donor.is_demo"
                    class="admin-badge admin-badge--demo"
                    >Demo</span
                  >
                </div>
              </td>
              <td>{{ formatAmount(donor.donation_amount) }}</td>
              <td>{{ formatDate(donor.donation_date || donor.created_at) }}</td>
              <td>
                <span
                  v-if="donor.is_anonymous"
                  class="admin-badge admin-badge--anon"
                  >Anonymous</span
                >
                <span
                  v-else-if="donor.is_hidden"
                  class="admin-badge admin-badge--hidden"
                  >Hidden</span
                >
                <span v-else class="admin-badge admin-badge--public"
                  >Public</span
                >
              </td>
              <td>
                <div class="admin-link-actions">
                  <template
                    v-if="donor.private_token && !donor.token_revoked_at"
                  >
                    <button
                      class="admin-btn admin-btn--small"
                      :class="{ 'admin-btn--success': copiedLink === donor.id }"
                      @click="generateLink(donor)"
                    >
                      {{ copiedLink === donor.id ? 'Copied!' : 'Copy Link' }}
                    </button>
                    <button
                      class="admin-btn admin-btn--small admin-btn--danger"
                      @click="revokeLink(donor)"
                    >
                      Revoke
                    </button>
                  </template>
                  <button
                    v-else
                    class="admin-btn admin-btn--small"
                    @click="generateLink(donor)"
                  >
                    Generate Link
                  </button>
                </div>
              </td>
              <td>
                <div class="admin-row-actions">
                  <button
                    class="admin-btn admin-btn--icon"
                    @click="openEditDonor(donor)"
                  >
                    <span class="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    class="admin-btn admin-btn--icon admin-btn--danger"
                    @click="confirmDelete(donor)"
                  >
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Donor Form Modal -->
    <div
      v-if="showDonorForm"
      class="admin-modal"
      @click.self="showDonorForm = false"
    >
      <div class="admin-modal__content">
        <h2>{{ selectedDonor ? 'Edit Donor' : 'Add Donor' }}</h2>

        <form @submit.prevent="saveDonor" class="admin-form">
          <div class="admin-form__row">
            <div class="admin-form__field">
              <label>Public Display Name *</label>
              <input
                v-model="donorForm.publicDisplayName"
                type="text"
                required
              />
            </div>
            <div class="admin-form__field">
              <label>Private Donor Name</label>
              <input v-model="donorForm.privateDonorName" type="text" />
            </div>
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label>Donation Amount</label>
              <input
                v-model="donorForm.donationAmount"
                type="number"
                step="0.01"
              />
            </div>
            <div class="admin-form__field">
              <label>Star Tier</label>
              <select v-model.number="donorForm.starTier">
                <option :value="1">Tier 1 (Basic)</option>
                <option :value="2">Tier 2</option>
                <option :value="3">Tier 3</option>
                <option :value="4">Tier 4</option>
                <option :value="5">Tier 5 (Premium)</option>
              </select>
            </div>
          </div>

          <div class="admin-form__field admin-form__checkbox">
            <input
              id="isAnonymous"
              v-model="donorForm.isAnonymous"
              type="checkbox"
            />
            <label for="isAnonymous">Anonymous donor</label>
          </div>

          <div class="admin-form__field">
            <label>Dedication (English)</label>
            <textarea v-model="donorForm.dedication" rows="2"></textarea>
          </div>

          <div class="admin-form__field">
            <label>Dedication (Hebrew)</label>
            <textarea
              v-model="donorForm.hebrewDedication"
              rows="2"
              dir="rtl"
            ></textarea>
          </div>

          <div class="admin-form__field">
            <label>Admin Notes</label>
            <textarea v-model="donorForm.notes" rows="2"></textarea>
          </div>

          <div class="admin-form__actions">
            <button
              type="button"
              class="admin-btn"
              @click="showDonorForm = false"
              >Cancel</button
            >
            <button type="submit" class="admin-btn admin-btn--primary">
              {{ selectedDonor ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteConfirm"
      class="admin-modal"
      @click.self="showDeleteConfirm = false"
    >
      <div class="admin-modal__content admin-modal__content--small">
        <h2>Delete Donor?</h2>
        <p
          >Are you sure you want to delete "{{
            selectedDonor?.public_display_name
          }}"? This cannot be undone.</p
        >
        <div class="admin-form__actions">
          <button class="admin-btn" @click="showDeleteConfirm = false"
            >Cancel</button
          >
          <button class="admin-btn admin-btn--danger" @click="handleDelete"
            >Delete</button
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: #0d0d12;
  color: white;
  font-family: 'Inter', sans-serif;
}

/* Header */
.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-header__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-header__brand h1 {
  font-size: 20px;
  font-weight: 500;
  margin: 0;
}

.admin-header__badge {
  padding: 4px 10px;
  background: rgba(212, 175, 55, 0.1);
  border-radius: 12px;
  font-size: 12px;
  color: #d4af37;
}

.admin-header__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.admin-header__user {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.admin-header__logout {
  padding: 8px 16px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-header__logout:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: white;
}

/* Content */
.admin-content {
  padding: 24px;
}

/* Toolbar */
.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.admin-toolbar__spacer {
  flex: 1;
}

.admin-toolbar__warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 193, 7, 0.1);
  border-radius: 8px;
  font-size: 13px;
  color: #ffc107;
}

.admin-toolbar__warning .material-symbols-outlined {
  font-size: 18px;
}

/* Buttons */
.admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.admin-btn--primary {
  background: linear-gradient(135deg, #d4af37, #b8860b);
  border: none;
  color: #0a0a0f;
}

.admin-btn--primary:hover {
  transform: translateY(-1px);
}

.admin-btn--danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.admin-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.admin-btn--success {
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.1);
}

.admin-btn--small {
  padding: 6px 12px;
  font-size: 12px;
}

.admin-btn--icon {
  padding: 6px;
}

.admin-btn--icon .material-symbols-outlined {
  font-size: 18px;
}

/* Table */
.admin-table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.admin-table th,
.admin-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.admin-table th {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.admin-table__row--demo {
  opacity: 0.6;
}

.admin-donor-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-donor-name__private {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.admin-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
}

.admin-badge--demo {
  background: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.admin-badge--anon {
  background: rgba(156, 163, 175, 0.1);
  color: #9ca3af;
}

.admin-badge--hidden {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.admin-badge--public {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.admin-link-actions,
.admin-row-actions {
  display: flex;
  gap: 8px;
}

/* Modal */
.admin-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
}

.admin-modal__content {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  background: #1a1a24;
  border-radius: 16px;
  padding: 32px;
}

.admin-modal__content--small {
  max-width: 400px;
}

.admin-modal__content h2 {
  font-size: 20px;
  margin: 0 0 24px;
}

/* Form */
.admin-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.admin-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.admin-form__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-form__field label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.admin-form__field input,
.admin-form__field select,
.admin-form__field textarea {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  font-size: 14px;
  font-family: inherit;
}

.admin-form__field input:focus,
.admin-form__field select:focus,
.admin-form__field textarea:focus {
  outline: none;
  border-color: #d4af37;
}

.admin-form__checkbox {
  flex-direction: row;
  align-items: center;
}

.admin-form__checkbox input {
  width: auto;
}

.admin-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

/* Loading/Error */
.admin-loading,
.admin-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px;
  color: rgba(255, 255, 255, 0.5);
}

.admin-error {
  color: #ef4444;
}
</style>
