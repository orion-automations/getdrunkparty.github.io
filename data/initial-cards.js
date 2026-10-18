import { PDF_CARDS } from './pdf-catalog.js';
import { ADDITIONAL_CARDS } from './additional-challenges.js';

export const INITIAL_CARDS = structuredClone([...PDF_CARDS, ...ADDITIONAL_CARDS]);
