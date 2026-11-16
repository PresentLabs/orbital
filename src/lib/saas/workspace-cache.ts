/** Encrypt the local workspace cache, including pending offline changes. The browser
 * stores a non-exportable device key in IndexedDB; it is never sent to the server. */
let deviceKey: Promise<CryptoKey> | undefined;
function key() {
  return deviceKey ??= (async () => {
    const candidate = await crypto.subtle.generateKey({name:"AES-GCM",length:256}, false, ["encrypt","decrypt"]);
    return new Promise<CryptoKey>((resolve,reject) => {
      const request = indexedDB.open("orbita-device-keys",1);
      request.onupgradeneeded = () => request.result.createObjectStore("keys");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db=request.result, tx=db.transaction("keys","readwrite"), keys=tx.objectStore("keys");
        const read=keys.get("workspace-v1");
        let result: CryptoKey;
        read.onsuccess=()=>{result=read.result || candidate; if (!read.result) keys.put(result,"workspace-v1");};
        tx.oncomplete=()=>{db.close();resolve(result);};
        tx.onabort=()=>{db.close();reject(tx.error);};
      };
    });
  })().catch(error => { deviceKey=undefined; throw error; });
}
const encode = (bytes: Uint8Array) => {
  let out = "";
  for (let i=0;i<bytes.length;i+=8192) out += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(out);
};
const decode = (value: string) => Uint8Array.from(atob(value), c=>c.charCodeAt(0));
export async function writeWorkspaceCache(name: string, serialized: string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const text=new TextEncoder();
  const result=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:text.encode(name)},await key(),text.encode(serialized));
  localStorage.setItem(name,"enc:v1:"+encode(iv)+":"+encode(new Uint8Array(result)));
}
export async function readWorkspaceCache(name: string, fallback: string) {
  const value=localStorage.getItem(name);
  if (!value) return fallback;
  if (!value.startsWith("enc:v1:")) {
    await writeWorkspaceCache(name,value);
    return value;
  }
  const [, , iv, data]=value.split(":");
  const result=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv),additionalData:new TextEncoder().encode(name)},await key(),decode(data));
  return new TextDecoder().decode(result);
}
