/* ---------- Anexos (fotos, orçamentos, laudos) via IndexedDB ---------- */
/* Guarda o arquivo de verdade no navegador (fora do localStorage, que é pequeno demais
   para fotos). Continua local: some se limpar os dados do navegador. */

const ATTACH_DB_NAME = "posvenda_anexos";
const ATTACH_STORE = "files";
let _attachDbPromise = null;

function openAttachDb() {
  if (_attachDbPromise) return _attachDbPromise;
  _attachDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(ATTACH_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ATTACH_STORE)) {
        db.createObjectStore(ATTACH_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _attachDbPromise;
}

function attachId() { return "att" + Date.now() + Math.random().toString(36).slice(2, 8); }

async function saveAttachment(file) {
  const db = await openAttachDb();
  const id = attachId();
  const record = { id, name: file.name, type: file.type, size: file.size, blob: file, createdAt: new Date().toISOString() };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACH_STORE, "readwrite");
    tx.objectStore(ATTACH_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return id;
}

async function getAttachment(id) {
  const db = await openAttachDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACH_STORE, "readonly");
    const req = tx.objectStore(ATTACH_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function getAttachmentUrl(id) {
  const rec = await getAttachment(id);
  if (!rec || !rec.blob) return null;
  return URL.createObjectURL(rec.blob);
}

async function deleteAttachment(id) {
  const db = await openAttachDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACH_STORE, "readwrite");
    tx.objectStore(ATTACH_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function isImageType(type) { return (type || "").startsWith("image/"); }

/* ---------- Exportar / importar todos os anexos (ponte manual entre pessoas) ---------- */

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function base64ToBlob(base64, type) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}

async function getAllAttachmentRecords() {
  const db = await openAttachDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACH_STORE, "readonly");
    const req = tx.objectStore(ATTACH_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function exportAllAttachments() {
  const records = await getAllAttachmentRecords();
  return Promise.all(records.map(async r => ({
    id: r.id, name: r.name, type: r.type, size: r.size, createdAt: r.createdAt,
    data: await blobToBase64(r.blob),
  })));
}

async function importAttachments(list) {
  if (!list || !list.length) return;
  const db = await openAttachDb();
  for (const item of list) {
    const blob = base64ToBlob(item.data, item.type);
    const record = { id: item.id, name: item.name, type: item.type, size: item.size, blob, createdAt: item.createdAt };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACH_STORE, "readwrite");
      tx.objectStore(ATTACH_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
}
