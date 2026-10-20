/* NeoBranium Blackboard foundation. No provider calls are made from this module. */
export const SCHEMA_VERSION = 1;
const clone = value => structuredClone(value);
const id = () => globalThis.crypto?.randomUUID?.() || `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;

export function createDocument(title = 'Untitled lesson') {
  return {schemaVersion:SCHEMA_VERSION,id:id(),title,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),settings:{background:'chalkboard'},strokes:[],objects:[],metadata:{}};
}
export function validateDocument(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Board data must be a JSON object.');
  if (![1].includes(input.schemaVersion)) throw new Error(`Unsupported board version: ${input.schemaVersion ?? 'missing'}.`);
  if (typeof input.id !== 'string' || !Array.isArray(input.strokes) || !Array.isArray(input.objects)) throw new Error('Board data is missing required document fields.');
  if (input.strokes.length > 100000 || input.objects.length > 10000) throw new Error('This board exceeds the supported import size.');
  const cleanStroke = s => {
    if (!s || typeof s.id !== 'string' || !Array.isArray(s.points) || s.points.length > 100000 || !Number.isFinite(s.width) || typeof s.color !== 'string') throw new Error('Board contains an invalid stroke.');
    const points=s.points.map(p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('Board contains an invalid point.');return{x:p.x,y:p.y,pressure:Number.isFinite(p.pressure)?Math.max(0,Math.min(1,p.pressure)):0.5};});
    return {...s,points,width:Math.max(.5,Math.min(100,s.width)),color:s.color.slice(0,40)};
  };
  const cleanObject = o => {
    if(!o||typeof o.id!=='string'||typeof o.type!=='string'||!/^[a-z][a-z0-9._-]{0,63}$/i.test(o.type)) throw new Error('Board contains an invalid object.');
    for(const k of ['x','y','width','height']) if(!Number.isFinite(o[k])) throw new Error('Board object has invalid dimensions.');
    const result={...o,x:o.x,y:o.y,width:o.width,height:o.height};
    if(o.type==='text') {if(typeof o.text!=='string') throw new Error('Text object is invalid.');result.text=o.text.slice(0,20000);}
    if(o.color!==undefined&&typeof o.color!=='string') throw new Error('Board object has invalid colour.');
    result.color=(o.color||'#f4f2e8').slice(0,40);result.strokeWidth=Number.isFinite(o.strokeWidth)?Math.max(.5,Math.min(100,o.strokeWidth)):3;
    if(o.metadata&&typeof o.metadata==='object'&&!Array.isArray(o.metadata))result.metadata=o.metadata;
    return result;
  };
  return {...input,schemaVersion:SCHEMA_VERSION,title:typeof input.title==='string'?input.title.slice(0,120):'Untitled lesson',settings:input.settings&&typeof input.settings==='object'?input.settings:{background:'chalkboard'},strokes:input.strokes.map(cleanStroke),objects:input.objects.map(cleanObject),metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{}};
}
/* Schema migration gate: add explicit version -> next-version transformations here
   before changing SCHEMA_VERSION. Unknown future versions are rejected safely. */
export function migrateDocument(input){if(!input||typeof input!=='object')throw new Error('Board data must be a JSON object.');if(input.schemaVersion===SCHEMA_VERSION)return validateDocument(input);throw new Error(`No migration is available for board version ${input.schemaVersion??'missing'}.`);}

export class BoardEventBus {
  #listeners=new Map();
  on(type,handler){if(!this.#listeners.has(type))this.#listeners.set(type,new Set());this.#listeners.get(type).add(handler);return()=>this.#listeners.get(type)?.delete(handler);}
  emit(type,payload){for(const fn of this.#listeners.get(type)||[])fn(payload);}
}
export class HistoryManager {
  constructor(limit=80){this.limit=limit;this.undoStack=[];this.redoStack=[];}
  clear(){this.undoStack.length=0;this.redoStack.length=0;}
  push(doc){this.undoStack.push(clone(doc));if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack.length=0;}
  undo(current){if(!this.undoStack.length)return null;this.redoStack.push(clone(current));return this.undoStack.pop();}
  redo(current){if(!this.redoStack.length)return null;this.undoStack.push(clone(current));return this.redoStack.pop();}
}
export class StrokeManager {
  create(points,color,width){return{id:id(),color,width,points:points.map(p=>({...p})),metadata:{}};}
  erase(document,strokeId){const before=document.strokes.length;document.strokes=document.strokes.filter(stroke=>stroke.id!==strokeId);return before!==document.strokes.length;}
  translate(stroke,dx,dy){stroke.points=stroke.points.map(p=>({...p,x:p.x+dx,y:p.y+dy}));return stroke;}
}
export class ObjectManager {
  add(document,object){if(document.objects.some(item=>item.id===object.id))throw new Error(`Duplicate object id: ${object.id}`);document.objects.push(object);return object;}
  update(document,objectId,changes){const object=document.objects.find(item=>item.id===objectId);if(!object)throw new Error('Board object was not found.');Object.assign(object,changes);return object;}
  remove(document,ids){const selected=new Set(ids),before=document.objects.length;document.objects=document.objects.filter(object=>!selected.has(object.id));return before-document.objects.length;}
}
export class SelectionEngine {
  constructor(){this.ids=new Set();}
  clear(){this.ids.clear();}
  select(id,{additive=false}={}){if(!additive)this.clear();if(id)this.ids.add(id);}
  selectRegion(document,rect,{additive=true}={}){if(!additive)this.clear();const normalized={x:Math.min(rect.x,rect.x+rect.width),y:Math.min(rect.y,rect.y+rect.height),width:Math.abs(rect.width),height:Math.abs(rect.height)};const intersects=b=>b&&b.maxX>=normalized.x&&b.minX<=normalized.x+normalized.width&&b.maxY>=normalized.y&&b.minY<=normalized.y+normalized.height;const matches=[...document.strokes.filter(s=>intersects(strokeBounds(s))),...document.objects.filter(o=>intersects(objectBounds(o)))];matches.forEach(item=>this.ids.add(item.id));return matches;}
  snapshot(){return [...this.ids];}
  selectedContent(document){const ids=new Set(this.ids),strokes=document.strokes.filter(s=>ids.has(s.id)).map(s=>({...clone(s),type:'stroke',bounds:strokeBounds(s)})),objects=document.objects.filter(o=>ids.has(o.id)).map(clone),bounds=unionBounds([...strokes.map(s=>s.bounds),...objects.map(objectBounds)]),itemIds=[...strokes.map(s=>s.id),...objects.map(o=>o.id)];return{documentId:document.id,objectIds:objects.map(o=>o.id),strokeIds:strokes.map(s=>s.id),itemIds,bounds,objects,strokes};}
}
export class BoardPersistence {
  constructor(storage=globalThis.localStorage){this.storage=storage;this.key='neobranium.blackboard.v1';this.indexKey=`${this.key}.index`;this.activeKey=`${this.key}.active`;}
  save(doc){try{this.storage?.setItem(`${this.key}.${doc.id}`,JSON.stringify(doc));const ids=new Set(JSON.parse(this.storage?.getItem(this.indexKey)||'[]'));ids.add(doc.id);this.storage?.setItem(this.indexKey,JSON.stringify([...ids]));this.storage?.setItem(this.activeKey,doc.id);return true;}catch(e){throw new Error(`Could not save this board on this device: ${e.message}`);}}
  load(){const id=this.storage?.getItem(this.activeKey);return id?this.loadById(id):null;}
  loadById(id){const raw=this.storage?.getItem(`${this.key}.${id}`);if(!raw)return null;try{return validateDocument(JSON.parse(raw));}catch(e){throw new Error(`Saved board could not be restored: ${e.message}`);}}
  list(){try{return JSON.parse(this.storage?.getItem(this.indexKey)||'[]').map(id=>this.loadById(id)).filter(Boolean).map(({id,title,updatedAt})=>({id,title,updatedAt}));}catch{return[];}}
  activate(id){if(!this.loadById(id))throw new Error('Saved board was not found.');this.storage?.setItem(this.activeKey,id);return this.loadById(id);}
  clear(){const ids=JSON.parse(this.storage?.getItem(this.indexKey)||'[]');for(const id of ids)this.storage?.removeItem(`${this.key}.${id}`);this.storage?.removeItem(this.indexKey);this.storage?.removeItem(this.activeKey);}
  serialize(doc){return JSON.stringify(doc,null,2);}
  restore(raw){return validateDocument(typeof raw==='string'?JSON.parse(raw):raw);}
}
export class BoardActionRegistry {
  #actions=new Map();
  register(action){if(!action?.id||!action?.label||!Array.isArray(action.objectTypes)||typeof action.handler!=='function')throw new TypeError('Action requires id, label, objectTypes and handler.');if(action.availability&&!['available','disabled','loading','unavailable'].includes(action.availability))throw new TypeError('Action availability must be available, disabled, loading or unavailable.');this.#actions.set(action.id,{availability:'available',...action});return()=>this.#actions.delete(action.id);}
  list({objectTypes=[],subject,metadata={},selection}={}){return [...this.#actions.values()].filter(a=>(!a.objectTypes.length||a.objectTypes.some(t=>objectTypes.includes(t)))&&(!subject||!a.subject||a.subject===subject)).map(({handler,isAvailable,...safe})=>({...safe,availability:isAvailable?.({metadata,selection,subject,objectTypes})===false?'disabled':safe.availability}));}
  async execute(actionId,context){const action=this.#actions.get(actionId);if(!action)throw new Error('Unknown board action.');if(action.availability!=='available'||action.isAvailable?.(context)===false)throw new Error('Board action is not currently available.');return action.handler(context);}
}
export class ExtensionRegistry {
  #extensions=new Map();
  register({id,name,version='1.0.0',initialize}){if(!id||typeof initialize!=='function')throw new TypeError('Extension requires id and initialize function.');if(this.#extensions.has(id))throw new Error(`Extension already registered: ${id}`);this.#extensions.set(id,{id,name,version,initialize});return()=>this.#extensions.delete(id);}
  initializeAll(api){return [...this.#extensions.values()].map(extension=>extension.initialize(api));}
  list(){return [...this.#extensions.values()].map(({id,name,version})=>({id,name,version}));}
}
export class BoardContextProvider {
  constructor(getDocument,getSelection){this.getDocument=getDocument;this.getSelection=getSelection;}
  snapshot(){const d=this.getDocument();const ids=new Set(this.getSelection()),objects=d.objects.map(o=>clone(o));return Object.freeze({documentId:d.id,schemaVersion:d.schemaVersion,title:d.title,strokes:d.strokes.map(s=>({...clone(s),bounds:strokeBounds(s)})),objects,selection:[...ids],selectedObjects:objects.filter(o=>ids.has(o.id))});}
  region(rect){const {strokes,objects}=this.snapshot();const intersects=b=>b&&b.maxX>=rect.x&&b.minX<=rect.x+rect.width&&b.maxY>=rect.y&&b.minY<=rect.y+rect.height;return{strokes:strokes.filter(s=>intersects(strokeBounds(s))),objects:objects.filter(o=>intersects(objectBounds(o)))};}
}
export function strokeBounds(s){if(!s.points.length)return null;const xs=s.points.map(p=>p.x),ys=s.points.map(p=>p.y),pad=s.width/2;return{minX:Math.min(...xs)-pad,minY:Math.min(...ys)-pad,maxX:Math.max(...xs)+pad,maxY:Math.max(...ys)+pad};}
export function objectBounds(o){return{minX:Math.min(o.x,o.x+o.width),minY:Math.min(o.y,o.y+o.height),maxX:Math.max(o.x,o.x+o.width),maxY:Math.max(o.y,o.y+o.height)};}
export function unionBounds(bounds){const valid=bounds.filter(Boolean);if(!valid.length)return null;return{minX:Math.min(...valid.map(b=>b.minX)),minY:Math.min(...valid.map(b=>b.minY)),maxX:Math.max(...valid.map(b=>b.maxX)),maxY:Math.max(...valid.map(b=>b.maxY))};}
/* Provider adapter contract for future work: request({operation, context, options}) => Promise<structured result>. Register an implementation through ExtensionRegistry; no provider is bundled. */
export const providerAdapterContract=Object.freeze({methods:['request'],request:{input:['operation','context','options'],output:'Promise<structured result>'}});
/* Floating content panel contract: extensions can mount a panel descriptor
   {id,title,content,position:{x,y},size:{width,height},minSize?} into a future
   host. Panel content must use DOM nodes/text, positions use board coordinates,
   and close/move/resize emit panel:closed/panel:moved/panel:resized events. */
export const floatingPanelContract=Object.freeze({descriptor:['id','title','content','position','size'],events:['panel:closed','panel:moved','panel:resized'],coordinateSpace:'board'});
