import { bootInryokuP3 } from './cosmos-integration.js';
const app = bootInryokuP3({ root: document.body });
window.__p3 = app;
console.log('[p3] unified boot OK');
