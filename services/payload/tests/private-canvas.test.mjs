import assert from "node:assert/strict";
import { test } from "node:test";
import { isSealedCanvas, sealCanvas, unsealCanvas } from "../src/private-canvas.ts";

test("private canvas ciphertext is unique and bound to record, workspace and owner", () => {
  const secret = "testing-purpose-only-a-long-encryption-secret";
  const scope = { workspace:"team-1", owner:"person-1", key:"nodes:private-1" };
  const data = { title:"Confidential", body:"Private folder text", space:"folder-1" };
  const sealed=sealCanvas(data,scope,secret);
  assert.ok(isSealedCanvas(sealed));
  assert.ok(!JSON.stringify(sealed).includes(data.body));
  assert.notEqual(sealed.iv,sealCanvas(data,scope,secret).iv);
  assert.deepEqual(unsealCanvas(sealed,scope,secret),data);
  for(const wrong of [{key:"nodes:other"},{workspace:"team-2"},{owner:"person-2"}])
    assert.throws(()=>unsealCanvas(sealed,{...scope,...wrong},secret));
  const edited=Buffer.from(sealed.data,"base64");
  edited[0] ^= 1;
  assert.throws(()=>unsealCanvas({...sealed,data:edited.toString("base64")},scope,secret));
});
