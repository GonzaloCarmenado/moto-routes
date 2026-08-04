import { MemoryStopTypesCacheRepository } from './memory-stop-types-cache.repository.js';
import { createStopTypesCacheSuite } from '../models/stop-types-cache.repository.spec.js';

createStopTypesCacheSuite('MemoryStopTypesCacheRepository', () => new MemoryStopTypesCacheRepository());
