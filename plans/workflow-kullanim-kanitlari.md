# Workflow Kullanım Kanıtları

## KANIT 1: routes/workflow.ts routes/index.ts'de mount edilmiş

**Dosya:** [`routes/index.ts`](apps/server/src/routes/index.ts)
```typescript
// Satır 17:
import workflowRoutes from './workflow.ts';

// Satır 61:
router.use('/workflow', workflowRoutes);
```

## KANIT 2: Frontend Orchestrator.tsx /workflow/stats çağırıyor

**Dosya:** [`Orchestrator.tsx`](apps/web/src/pages/Orchestrator.tsx)
```typescript
// Satır 15:
{ key: 'workflow', label: 'Workflow V1', icon: '⚡', desc: 'Ürün yaşam döngüsü, hazırlık skoru', 
  color: 'green', api: '/workflow/stats', stats: {} },
```

## KANIT 3: workflowEngine.ts 4 farklı route tarafından import ediliyor

### Import 1: [`routes/workflow.ts:5`](apps/server/src/routes/workflow.ts:5)
```typescript
import { calculateReadiness, getReadinessColor, getStatusFromScore, 
         refreshWorkflowForProduct, seedWorkflowStates } 
from '../services/workflowEngine.ts';
```

### Import 2: [`routes/pipeline.ts:5`](apps/server/src/routes/pipeline.ts:5)
```typescript
import { calculateReadiness } from '../services/workflowEngine.ts';
```

### Import 3: [`routes/plm.ts:5`](apps/server/src/routes/plm.ts:5)
```typescript
import { calculateReadiness } from '../services/workflowEngine.ts';
```

### Import 4: [`routes/twin.ts:5`](apps/server/src/routes/twin.ts:5)
```typescript
import { calculateReadiness } from '../services/workflowEngine.ts';
```

## KANIT 4: workflow.ts endpoint'leri

| Endpoint | Dosya | Kullanım |
|----------|-------|----------|
| `GET /workflow/stats` | `Orchestrator.tsx:15` | Frontend çağırıyor |
| `GET /workflow/products` | - | workflowState.ts alternatifi var |
| `GET /workflow/product/:id` | - | Tekil ürün detayı |
| `POST /workflow/refresh` | - | Admin toplu yenileme |
| `POST /workflow/timeline` | - | Timeline event ekleme |

## KANIT 5: workflowEngine.ts fonksiyonları

| Fonksiyon | Kullanıldığı Dosyalar |
|-----------|----------------------|
| `calculateReadiness(product)` | pipeline.ts, plm.ts, twin.ts, workflow.ts |
| `getReadinessColor(score)` | workflow.ts |
| `getStatusFromScore(score)` | workflow.ts |
| `refreshWorkflowForProduct(productId)` | workflow.ts |
| `seedWorkflowStates()` | workflow.ts |

## KANIT 6: workflowState.ts endpoint'leri (alternatif)

| Endpoint | workflow.ts karşılığı | Durum |
|----------|----------------------|-------|
| `GET /workflow-state/stats` | `GET /workflow/stats` | ✅ Mevcut |
| `GET /workflow-state/products` | `GET /workflow/products` | ✅ Mevcut |
| `GET /workflow-state/product/:id` | `GET /workflow/product/:id` | ❌ Eksik |
| `POST /workflow-state/refresh` | `POST /workflow/refresh` | ❌ Eksik |
| `POST /workflow-state/timeline` | `POST /workflow/timeline` | ❌ Eksik |

## SONUÇ

| Dosya | Taşınabilir mi? | Gerekçe |
|-------|----------------|---------|
| `routes/workflow.ts` | ❌ HAYIR | Mount edilmiş + frontend kullanıyor |
| `services/workflowEngine.ts` | ❌ HAYIR | 4 route import ediyor |

**Taşıma için önce yapılması gerekenler:**
1. workflowState.ts'e eksik endpoint'leri ekle
2. Orchestrator.tsx'i `/workflow-state/stats`'e yönlendir
3. pipeline.ts, plm.ts, twin.ts'deki import'ları WorkflowStateManager'a çevir
4. workflow.ts mount kaldır
5. Sonra legacy'e taşı
