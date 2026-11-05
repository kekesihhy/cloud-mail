import http from '@/axios/index.js'

export function broadcastRecipientCount() {
    return http.get('/admin/broadcast/recipientCount')
}

export function latestBroadcast() {
    return http.get('/admin/broadcast/latest')
}

export function createBroadcast(data) {
    return http.post('/admin/broadcast', data)
}
