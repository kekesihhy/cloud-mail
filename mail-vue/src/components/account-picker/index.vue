<template>
  <div v-if="settingStore.settings.manyEmail === 0 && hasPerm('account:query')" class="account-picker">
    <el-dropdown trigger="click" popper-class="account-picker-popper" @command="handleCommand">
      <button class="account-selector-button" type="button" :title="selectedAccount.email || $t('emailAccount')">
        <Icon icon="mdi:email-outline" width="18" height="18" class="account-selector-icon" />
        <span class="selected-account-email">{{ selectedAccount.email || $t('emailAccount') }}</span>
        <Icon icon="mingcute:down-small-fill" width="18" height="18" class="account-selector-caret" />
      </button>
      <template #dropdown>
        <el-dropdown-menu class="account-picker-menu">
          <el-dropdown-item disabled class="account-picker-heading">{{ $t('emailAccount') }}</el-dropdown-item>
          <div class="account-picker-options" @scroll="handleOptionsScroll">
            <el-dropdown-item v-for="item in accounts" :key="item.accountId" :command="item"
                              :class="{ 'account-option-current': item.accountId === accountStore.currentAccountId }">
              <span class="account-option">
                <span class="account-option-email">{{ item.email }}</span>
                <Icon v-if="item.accountId === accountStore.currentAccountId" class="account-option-check"
                      icon="material-symbols:check-rounded" width="19" height="19" />
              </span>
            </el-dropdown-item>
            <div v-if="loading && accounts.length === 0" class="account-picker-state">
              <span class="account-picker-spinner"></span>
            </div>
            <div v-else-if="noMore && accounts.length === 0" class="account-picker-state">{{ $t('noMessagesFound') }}</div>
          </div>
          <el-dropdown-item command="manage" divided class="account-picker-manage">
            <Icon icon="fluent:settings-24-filled" width="18" height="18" />
            <span>{{ $t('settings') }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import {computed, onMounted, ref} from "vue";
import {Icon} from "@iconify/vue";
import {accountList} from "@/request/account.js";
import {useAccountStore} from "@/store/account.js";
import {useSettingStore} from "@/store/setting.js";
import {useUiStore} from "@/store/ui.js";
import {hasPerm} from "@/perm/perm.js";

const accountStore = useAccountStore();
const settingStore = useSettingStore();
const uiStore = useUiStore();
const accounts = ref([]);
const loading = ref(false);
const noMore = ref(false);
const pageSize = 30;

const selectedAccount = computed(() => {
  return accounts.value.find(item => item.accountId === accountStore.currentAccountId)
    || (accountStore.currentAccount?.accountId ? accountStore.currentAccount : null)
    || accounts.value[0]
    || {};
});

onMounted(() => {
  if (settingStore.settings.manyEmail === 0 && hasPerm("account:query")) loadAccounts();
});

async function loadAccounts() {
  if (loading.value || noMore.value) return;
  loading.value = true;
  const last = accounts.value.at(-1);
  try {
    const list = await accountList(last?.accountId || 0, pageSize, last?.sort ?? null);
    if (list.length < pageSize) noMore.value = true;
    accounts.value.push(...list);

    if (accounts.value.length === list.length && list.length > 0) {
      const selected = list.find(item => item.accountId === accountStore.currentAccountId);
      if (selected) {
        accountStore.currentAccount = selected;
      } else if (!accountStore.currentAccountId) {
        accountStore.currentAccountId = list[0].accountId;
        accountStore.currentAccount = list[0];
      }
    }
  } finally {
    loading.value = false;
  }
}

function handleOptionsScroll(event) {
  const element = event.target;
  if (!noMore.value && !loading.value && element.scrollTop + element.clientHeight >= element.scrollHeight - 16) {
    loadAccounts();
  }
}

function handleCommand(command) {
  if (command === "manage") {
    uiStore.accountShow = true;
    return;
  }
  accountStore.currentAccountId = command.accountId;
  accountStore.currentAccount = command;
}
</script>

<style lang="scss">
.account-picker { display: flex; justify-content: center; width: 100%; min-width: 0; }
.account-picker > .el-dropdown { display: block; width: min(100%, 360px); min-width: 0; }
.account-selector-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 9px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: border-color .18s ease, box-shadow .18s ease;
}
.account-selector-button:hover,
.account-selector-button:focus-visible {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
  outline: none;
}
.account-selector-icon, .account-selector-caret { flex: 0 0 auto; }
.selected-account-email {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: left;
}
.account-management-drawer .el-drawer__body { display: flex; min-height: 0; padding: 12px 0 0; overflow: hidden; }
.account-management-drawer .account-box { width: 100%; border-right: 0 !important; }
.account-picker-popper { width: min(360px, calc(100vw - 24px)); }
.account-picker-popper .el-dropdown-menu {
  width: 100%;
  max-height: min(60vh, 460px);
  overflow: hidden;
  padding: 6px;
}
.account-picker-popper .el-dropdown-menu__item { min-height: 42px; line-height: 1.25; white-space: normal; }
.account-picker-popper .account-picker-heading {
  min-height: 34px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  cursor: default;
}
.account-picker-options { max-height: min(50vh, 360px); overflow-y: auto; overscroll-behavior: contain; }
.account-picker-popper .account-option-current {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-weight: 600;
}
.account-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-width: 0; }
.account-option-email { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.account-option-check { flex: 0 0 auto; color: var(--el-color-primary); }
.account-picker-state { display: flex; justify-content: center; padding: 12px; }
.account-picker-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--el-border-color);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: account-picker-spin .7s linear infinite;
}
@keyframes account-picker-spin { to { transform: rotate(360deg); } }
.account-picker-manage { display: flex; align-items: center; gap: 9px; }
@media (max-width: 600px) {
  .account-selector-button { height: 32px; gap: 6px; padding: 0 8px; border-radius: 8px; font-size: 12px; }
  .account-picker-popper { width: min(360px, calc(100vw - 16px)); }
  .account-management-drawer .el-drawer { width: 100vw !important; }
}
</style>