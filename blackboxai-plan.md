Plan - Queue + SSE + UI (işe yarar minimum akış)

Hedef: Tek bir buton/endpoint ile marketplace.sync job enqueue edilsin, worker progress üretsin, UI `/sse` üzerinden bunu canlı görsün.

Adımlar:
1) `apps/server/src/queue/*` oluştur: bullmq connection + queue init
2) `apps/server/src/workers/*` oluştur: marketplaceSync worker
3) `apps/server/src/routes/index.ts` içine protected endpoint ekle: POST /actions/marketplace/sync
4) Worker state güncellerken `broadcastSSE('marketplace.sync.progress', payload)` atsın
5) `apps/web/src/App.tsx` içine marketplaces list + `/sse` listener ekle
6) Migrate/seed doğrulaması sonrası dev run testi

