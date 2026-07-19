# Workflow Analiz Raporu — KURAL 1-2

## 1️⃣ services/workflowEngine.ts

| Soru | Cevap |
|------|-------|
| **Aktif mi?** | ✅ EVET |
| **routes/index.ts mount?** | Doğrudan mount edilmez, service katmanı |
| **Frontend çağırıyor mu?** | Dolaylı (routes/workflow.ts aracılığıyla) |
| **Kim import ediyor?** | 4 dosya: |
| | - `routes/workflow.ts` → 5 fonksiyon |
| | - `routes/pipeline.ts` → `calculateReadiness` |
| | - `routes/plm.ts` → `calculateReadiness` |
| | - `routes/twin.ts` → `calculateReadiness` |
| **Çakışma?** | `calculateReadiness()` Product alanlarını okur (`categoryMatch`, `brandMatch` vs.) → WorkflowStateManager ile çakışır |
| **Legacy?** | ❌ HAYIR — 4 route import ediyor, aktif |

## 2️⃣ routes/workflow.ts

| Soru | Cevap |
|------|-------|
| **Aktif mi?** | ✅ EVET |
| **routes/index.ts mount?** | ✅ `router.use('/workflow', workflowRoutes)` |
| **Frontend çağırıyor mu?** | ✅ `Orchestrator.tsx` → `GET /workflow/stats` |
| **Hangi endpoint'ler?** | `GET /stats`, `GET /products`, `POST /refresh/:productId`, `POST /seed` |
| **Çakışma?** | `workflowState.ts` aynı işi yapıyor (`/workflow-state/stats`, `/workflow-state/products`) |
| **Legacy?** | ❌ HAYIR — mount edilmiş + frontend kullanıyor |

## 3️⃣ Migration Stratejisi

### Adım 1: Frontend'i workflow → workflow-state'e yönlendir
```diff
- Orchestrator.tsx: '/workflow/stats' → '/workflow-state/stats'
```

### Adım 2: workflow.ts endpoint'lerini workflowState'e entegre et
Eksik endpoint'ler workflowState.ts'e eklenmeli:
- `POST /workflow-state/refresh/:productId`
- `POST /workflow-state/seed`

### Adım 3: routes/index.ts'den workflow.ts mount kaldır
```diff
- import workflowRoutes from './workflow.ts';
- router.use('/workflow', workflowRoutes);
```

### Adım 4: routes/workflow.ts → legacy
```diff
+ legacy/routes/workflow.ts
```

### Adım 5: workflowEngine.ts function'larını WorkflowStateManager'a taşı
- `calculateReadiness()` → `WorkflowStateManager.calculateReadiness()`
- `getReadinessColor()` → `WorkflowStateManager.getReadinessColor()`
- `refreshWorkflowForProduct()` → `WorkflowStateManager.refresh()`
- Tüm import'ları güncelle: `pipeline.ts`, `plm.ts`, `twin.ts`

### Adım 6: services/workflowEngine.ts → legacy
```diff
+ legacy/services/workflowEngine.ts
```

## KURAL 1 Doğrulama

Dosya taşınmadan önce tüm kontroller yapılacak:

| Dosya | Mount? | Frontend? | Import? | Taşınabilir mi? |
|-------|--------|-----------|---------|----------------|
| `routes/workflow.ts` | ✅ Evet | ✅ Evet | ✅ 4 dosya | ❌ Adım 3'ten sonra |
| `services/workflowEngine.ts` | N/A (servis) | N/A | ✅ 4 route | ❌ Adım 5'ten sonra |
