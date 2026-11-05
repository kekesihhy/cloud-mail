<template>
  <div class="broadcast-page">
    <section class="broadcast-card">
      <header class="broadcast-header">
        <div>
          <h1>{{ $t('adminBroadcast') }}</h1>
          <p>{{ $t('broadcastDescription') }}</p>
        </div>
        <el-button @click="refresh" :loading="refreshing">{{ $t('refresh') }}</el-button>
      </header>

      <el-form label-position="top">
        <el-form-item :label="$t('broadcastSubject')">
          <el-input v-model="subject" maxlength="150" show-word-limit />
        </el-form-item>
        <el-form-item :label="$t('broadcastBody')">
          <el-input v-model="content" type="textarea" :rows="12" maxlength="20000" show-word-limit />
        </el-form-item>
      </el-form>

      <footer class="broadcast-actions">
        <span>{{ $t('broadcastRecipients', {count: recipientCount}) }}</span>
        <el-button type="primary" :loading="sending" :disabled="recipientCount === 0" @click="send">
          {{ $t('broadcastSend') }}
        </el-button>
      </footer>
    </section>

    <section class="broadcast-card history-card">
      <header class="broadcast-header">
        <h2>{{ $t('broadcastLatest') }}</h2>
        <el-tag v-if="latest" :type="latest.status === 2 ? 'success' : 'warning'">
          {{ latest.status === 2 ? $t('broadcastStatusDone') : $t('broadcastStatusSending') }}
        </el-tag>
      </header>
      <div v-if="latest" class="history-content">
        <strong>{{ latest.subject }}</strong>
        <div class="history-meta">
          <span>{{ latest.createTime }}</span>
          <span>{{ $t('broadcastRecipients', {count: latest.recipientCount}) }}</span>
          <span>{{ $t('broadcastSentCount', {count: latest.sentCount}) }}</span>
          <span>{{ $t('broadcastFailedCount', {count: latest.failedCount}) }}</span>
        </div>
      </div>
      <el-empty v-else :description="$t('broadcastEmpty')" :image-size="72" />
    </section>
  </div>
</template>

<script setup>
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {broadcastRecipientCount, createBroadcast, latestBroadcast} from '@/request/broadcast.js'

const {t} = useI18n()
const subject = ref('')
const content = ref('')
const recipientCount = ref(0)
const latest = ref(null)
const sending = ref(false)
const refreshing = ref(false)
let refreshTimer

function refresh() {
  refreshing.value = true
  Promise.all([
    broadcastRecipientCount().then(data => { recipientCount.value = data.total }),
    latestBroadcast().then(data => { latest.value = data })
  ]).catch(() => {}).finally(() => {
    refreshing.value = false
  })
}

function send() {
  if (!subject.value.trim() || !content.value.trim() || recipientCount.value === 0) return
  ElMessageBox.confirm(t('broadcastConfirm', {count: recipientCount.value}), t('adminBroadcast'), {
    confirmButtonText: t('broadcastSend'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    sending.value = true
    createBroadcast({subject: subject.value, content: content.value}).then(data => {
      latest.value = {
        ...data,
        subject: subject.value.trim(),
        sentCount: 0,
        failedCount: 0,
        createTime: new Date().toLocaleString()
      }
      subject.value = ''
      content.value = ''
      ElMessage({message: t('broadcastSentSuccess'), type: 'success', plain: true})
      refresh()
    }).catch(() => {}).finally(() => {
      sending.value = false
    })
  }).catch(() => {})
}

onMounted(() => {
  refresh()
  refreshTimer = setInterval(() => {
    if (latest.value?.status !== 2) refresh()
  }, 15000)
})

onBeforeUnmount(() => clearInterval(refreshTimer))
</script>

<style scoped lang="scss">
.broadcast-page {
  width: min(100%, 1040px);
  margin: 0 auto;
  padding: 28px;
  display: grid;
  align-content: start;
  gap: 18px;
  color: var(--el-text-color-primary);
}

.broadcast-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  padding: 24px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
}

.broadcast-header,
.broadcast-actions,
.history-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.broadcast-header {
  margin-bottom: 20px;

  h1,
  h2,
  p {
    margin: 0;
  }

  h1,
  h2 {
    font-size: 20px;
  }

  p {
    margin-top: 8px;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }
}

.broadcast-actions {
  color: var(--el-text-color-secondary);
  flex-wrap: wrap;
}

.history-content {
  display: grid;
  gap: 10px;
}

.history-meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

@media (max-width: 767px) {
  .broadcast-page {
    padding: 16px;
  }

  .broadcast-card {
    padding: 18px;
  }

  .broadcast-header {
    align-items: flex-start;
  }
}
</style>
