const SYNC_QUEUE_KEY = 'offline_sync_queue';

class OfflineSync {
    constructor() {
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (typeof window !== 'undefined') {
            this.setupListeners();
            this.processQueue();
        }
    }

    setupListeners() {
        window.addEventListener('online', () => {
            console.log('🟢 Internet recuperado');
            this.isOnline = true;
            this.processQueue();
        });
        window.addEventListener('offline', () => {
            console.log('🔴 Sin internet');
            this.isOnline = false;
        });
    }

    queueAction(collection, data, action = 'POST') {
        if (this.isOnline) {
            return this.executeAction(collection, data, action);
        }
        const queue = this.getQueue();
        queue.push({ id: Date.now(), collection, data, action });
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        return { success: true, queued: true };
    }

    getQueue() {
        const q = localStorage.getItem(SYNC_QUEUE_KEY);
        return q ? JSON.parse(q) : [];
    }

    async processQueue() {
        if (!this.isOnline) return;
        const queue = this.getQueue();
        for (const item of queue) {
            await this.executeAction(item.collection, item.data, item.action);
            this.removeFromQueue(item.id);
        }
    }

    removeFromQueue(id) {
        const newQueue = this.getQueue().filter(i => i.id !== id);
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(newQueue));
    }

    async executeAction(collection, data, action) {
        const { dbService } = await import('./dbService');
        const { mode, url } = dbService.getSettings();
        const base = url || 'https://efas-control.vercel.app';
        
        const response = await fetch(`${base}/api/${collection}`, {
            method: action,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }
}

export const offlineSync = typeof window !== 'undefined' ? new OfflineSync() : null;
