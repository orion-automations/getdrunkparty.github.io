import { INITIAL_CARDS } from '../data/initial-cards.js';
import { INITIAL_MANUALS } from '../data/initial-manuals.js';
export const STORAGE_KEY = 'gdpw.data.v1';
export const seedState = () => ({ version:1, cards:structuredClone(INITIAL_CARDS), manuals:structuredClone(INITIAL_MANUALS), drinks:[{id:'NORMAL',name:'Unidad configurable',unitLabel:'unidad',enabled:true},{id:'ALTERNATIVE',name:'Alternativa sin alcohol',unitLabel:'opción',enabled:true}], participants:[], settings:{positionReversed:false}, game:{currentIndex:0,state:'READY',decks:{},current:null,history:[],rewards:[] } });
export function isValidState(state) {
  try {
    if (!state || state.version!==1 || !Array.isArray(state.cards) || !Array.isArray(state.manuals) || !Array.isArray(state.participants) || !Array.isArray(state.drinks) || !state.game || !Array.isArray(state.game.history) || !state.game.decks || typeof state.game.decks!=='object') return false;
    validateCards(state.cards,state.manuals);
    if (!state.participants.every(p=>p && typeof p.id==='string' && typeof p.name==='string' && p.name.trim() && typeof p.active==='boolean')) return false;
    if (!state.drinks.every(d=>d && typeof d.id==='string' && typeof d.name==='string' && typeof d.enabled==='boolean')) return false;
    if (!Number.isInteger(state.game.currentIndex) || state.game.currentIndex<0) return false;
    return true;
  } catch { return false; }
}
export function loadState() {
  try { const raw=localStorage.getItem(STORAGE_KEY); if (!raw) { const init=seedState(); saveState(init); return init; } const parsed=JSON.parse(raw); if (isValidState(parsed)) return parsed; }
  catch (error) { console.error('No se pudo leer el almacenamiento local',error); }
  return seedState();
}
export function saveState(state) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); return true; } catch(error) { console.error('No se pudo guardar',error); return false; } }
export function validateCards(cards, manuals=[]) {
  if (!Array.isArray(cards)) throw new Error('El JSON debe contener una lista de cartas.');
  const ids=new Set(), categories=new Set(['VERDAD','DESAFIO','MINIJUEGO','PREMIO','CASTIGO']), modes=new Set(['CURRENT_PLAYER','RANDOM_PLAYER','NEXT_PLAYER','PREVIOUS_PLAYER','LEFT_PLAYER','RIGHT_PLAYER','PLAYER_PAIR','ALL_PLAYERS','MANUAL_SELECTION']);
  for (const c of cards) { if (!c || typeof c.id!=='string' || !/^[A-Za-z0-9_-]+$/.test(c.id) || ids.has(c.id)) throw new Error('Hay un ID inválido o repetido.'); ids.add(c.id); if (!categories.has(c.categoryId)) throw new Error(`Categoría inválida en ${c.id}.`); if (!c.title?.trim() || !c.description?.trim()) throw new Error(`Título y descripción son obligatorios en ${c.id}.`); if (!Number.isInteger(c.spiceLevel)||c.spiceLevel<0||c.spiceLevel>5) throw new Error(`Intensidad inválida en ${c.id}.`); if (!modes.has(c.target?.mode)) throw new Error(`Asignación inválida en ${c.id}.`); if (!Number.isInteger(c.target.count)||c.target.count<0||c.target.count>20) throw new Error(`Cantidad de participantes inválida en ${c.id}.`); if (!c.icon||c.icon.type!=='glyph'||typeof c.icon.value!=='string'||c.icon.value.length>8) throw new Error(`Icono no permitido en ${c.id}.`); if (!c.penalty||typeof c.penalty.enabled!=='boolean'||!Number.isFinite(c.penalty.units)||c.penalty.units<0) throw new Error(`Penalización inválida en ${c.id}.`); if (typeof c.enabled!=='boolean') throw new Error(`Estado habilitado inválido en ${c.id}.`); if (c.manualId && !manuals.some(m=>m.id===c.manualId)) throw new Error(`No existe el manual de ${c.id}.`); }
  return true;
}
