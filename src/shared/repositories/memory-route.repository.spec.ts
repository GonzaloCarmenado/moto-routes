import { MemoryRouteRepository } from './memory-route.repository.js';
import { createRouteSuite } from '../models/route.repository.spec.js';

createRouteSuite('MemoryRouteRepository', () => new MemoryRouteRepository());