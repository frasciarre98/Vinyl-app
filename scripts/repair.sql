-- Riparazione Timestamp e Ordinamento (V33.25)

-- 1. Riparazione date nulle o corrotte
UPDATE vinyls 
SET created = '2026-04-01 10:00:00.000Z', 
    updated = '2026-04-01 10:00:00.000Z' 
WHERE (created IS NULL 
   OR created = '' 
   OR created = '0001-01-01 00:00:00.000Z');

-- 2. Priorità Led Zeppelin (Forza l'apparizione in cima)
UPDATE vinyls 
SET created = '2026-12-31 23:59:59.000Z', 
    updated = '2026-12-31 23:59:59.000Z' 
WHERE title LIKE '%Led Zeppelin%' 
   OR artist LIKE '%Led Zeppelin%';

.quit
