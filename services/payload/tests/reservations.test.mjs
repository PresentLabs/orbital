import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, validateSettings, validateEntry, localInstant, slotAvailable, quote } from "../src/reservations/domain.ts";
import { ModuleGrants } from "../src/modules/grants.ts";

const settings = validateSettings({ ...defaultSettings, timezone: "UTC", schedule: [{ weekday: 1, start: "09:00", end: "18:00" }] });
const service = { id: 1, ...validateEntry("service", "Consulta", {
  durationMinutes: 60, priceMinor: 15000, capacity: 1, resourceIds: [],
}, true) };
const now = new Date("2027-01-01T12:00:00Z");
const start = new Date("2027-01-04T10:00:00Z");
const available = (overrides = {}) => slotAvailable({ start, service, professionalId: null, locationId: null,
  quantity: 1, catalog: [service], bookings: [], settings, now, ...overrides });

test("module grants expose no direct CRUD bypass", () => {
  for (const access of Object.values(ModuleGrants.access)) assert.equal(access({}), false);
});
test("schedule, capacity, buffers and shared resources prevent overlapping bookings", () => {
  assert.equal(available(), true);
  const booking = { id: 5, service_id: 1, professional_id: null, location_id: null,
    start_at: start.toISOString(), end_at: "2027-01-04T11:00:00Z", quantity: 1, status: "confirmed", details: {} };
  assert.equal(available({ bookings: [booking] }), false);
  assert.equal(available({ start: new Date("2027-01-04T10:15:00Z"), bookings: [booking] }), false);
  assert.equal(available({ start: new Date("2027-01-04T11:00:00Z"), bookings: [booking] }), true);
  assert.equal(available({ start: new Date("2027-01-04T11:00:00Z"), bookings: [{ ...booking, details: { bufferAfter: 15 } }] }), false);
  const group = { ...service, value: { ...service.value, capacity: 3 } };
  assert.equal(available({ service: group, quantity: 2, bookings: [booking] }), true);
  assert.equal(available({ service: group, quantity: 3, bookings: [booking] }), false);
  assert.equal(available({ bookings: [{ ...booking, status: "canceled" }] }), true);
  assert.equal(available({ settings: { ...settings, maxBookingsPerDay: 1 }, start: new Date("2027-01-04T12:00:00Z"), bookings: [booking] }), false);
  const resource = { id: 3, kind: "resource", name: "Sala", active: true, value: { capacity: 1 } };
  assert.equal(available({ service: { ...service, value: { ...service.value, resourceIds: [3] } },
    catalog: [service, resource], bookings: [{ ...booking, service_id: 2, details: { resourceIds: [3] } }] }), false);
});
test("timezone conversion rejects nonexistent local dates and validates scheduling data", () => {
  assert.equal(localInstant("2027-01-04", "09:00", "America/Santiago").toISOString(), "2027-01-04T12:00:00.000Z");
  assert.throws(() => localInstant("2027-03-14", "02:30", "America/New_York"));
  assert.throws(() => localInstant("2027-02-30", "09:00", "UTC"));
  assert.throws(() => validateSettings({ schedule: [{ weekday: 1, start: "18:00", end: "09:00" }] }));
  assert.throws(() => validateEntry("service", "X", { durationMinutes: 60, priceMinor: 0.1 }, true));
  assert.equal(quote({ ...service, value: { ...service.value, baseFeeMinor: 1000 } }, 2), 31000);
});

test("split shifts and date exceptions intersect business and professional availability", () => {
  const split = validateSettings({ ...settings, schedule: [
    { weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "14:00", end: "18:00" },
  ] });
  assert.equal(available({ settings: split, start: new Date("2027-01-04T11:30:00Z") }), false);
  assert.equal(available({ settings: split, start: new Date("2027-01-04T14:00:00Z") }), true);
  const closed = validateSettings({ ...settings, exceptions: [{ day: "2027-01-04", periods: [] }] });
  assert.equal(available({ settings: closed }), false);
  const special = validateSettings({ ...settings, exceptions: [{ day: "2027-01-04", periods: [{ start: "10:00", end: "11:00" }] }] });
  assert.equal(available({ settings: special }), true);
  assert.equal(available({ settings: special, start: new Date("2027-01-04T11:00:00Z") }), false);
  const professional = { id: 2, ...validateEntry("professional", "Ana", {
    exceptions: [{ day: "2027-01-04", periods: [] }],
  }, true) };
  assert.equal(available({ professionalId: 2, service: { ...service, value: { ...service.value, professionalIds: [2] } }, catalog: [service, professional] }), false);
  assert.throws(() => validateSettings({ exceptions: [{ day: "2027-02-30", periods: [] }] }));
  assert.throws(() => validateSettings({ exceptions: [{ day: "2027-01-04", periods: [] }, { day: "2027-01-04", periods: [] }] }));
});

test("professional daily quotas exclude canceled appointments and the booking being rescheduled", () => {
  const professional={id:2,...validateEntry('professional','Ana',{maxBookingsPerDay:1},true)};
  const assigned={...service,value:{...service.value,professionalIds:[2]}};
  const booking={id:99,service_id:1,professional_id:2,location_id:null,start_at:start.toISOString(),end_at:'2027-01-04T11:00:00Z',quantity:1,status:'confirmed',details:{}};
  const input={service:assigned,professionalId:2,catalog:[assigned,professional],start:new Date('2027-01-04T14:00:00Z'),bookings:[booking]};
  assert.equal(available(input),false);
  assert.equal(available({...input,bookings:[{...booking,status:'canceled'}]}),true);
  assert.equal(available({...input,excludeId:99}),true);
  assert.equal(validateSettings({...settings}).maxFutureBookingsPerCustomer,0);
  assert.throws(()=>validateSettings({...settings,maxFutureBookingsPerCustomer:-1}));
});

test("alternative durations reprice the service and change availability without changing source catalog", async () => {
  const {selectServiceDuration}=await import('../src/reservations/domain.ts');
  const varied={id:1,...validateEntry('service','Consulta',{durationMinutes:60,priceMinor:15000,durations:[{minutes:30,priceMinor:9000}]},true)};
  const short=selectServiceDuration(varied,30);
  assert.equal(short.value.durationMinutes,30);assert.equal(quote(short,2),18000);assert.equal(varied.value.durationMinutes,60);
  const occupied={id:88,service_id:1,professional_id:null,location_id:null,start_at:'2027-01-04T10:30:00Z',end_at:'2027-01-04T11:30:00Z',quantity:1,status:'confirmed',details:{}};
  assert.equal(available({service:varied,bookings:[occupied]}),false);
  assert.equal(available({service:short,bookings:[occupied]}),true);
  assert.throws(()=>selectServiceDuration(varied,45));
  assert.throws(()=>validateEntry('service','X',{durationMinutes:60,priceMinor:0,durations:[{minutes:60,priceMinor:1}]},true));
  assert.throws(()=>validateEntry('service','X',{durationMinutes:60,priceMinor:0,durations:[{minutes:30,priceMinor:1},{minutes:30,priceMinor:2}]},true));
});
test("category hierarchy rejects self-parenting, cycles and unrelated tenant references", async()=>{
  const {validateCategoryLink}=await import('../src/reservations/domain.ts');
  const entries=[{id:10,...validateEntry('category','Raíz',{sortOrder:1},true)},{id:11,...validateEntry('category','Hija',{parentId:10},true)}];
  assert.doesNotThrow(()=>validateCategoryLink(entries,'service',{categoryId:11}));
  assert.throws(()=>validateCategoryLink(entries,'category',{parentId:11},10));
  assert.throws(()=>validateCategoryLink(entries,'category',{parentId:11},11));
  assert.throws(()=>validateCategoryLink(entries,'service',{categoryId:99}));
});

test('extras count distinct types, charge units once, extend capacity windows and reject invalid selections', async()=>{
  const {selectServiceExtras,normalizeExtraSelection}=await import('../src/reservations/domain.ts');
  const extra={id:20,...validateEntry('extra','Masaje',{priceMinor:2000,durationMinutes:15,maxQuantity:3},true)};
  const other={id:21,...validateEntry('extra','Material',{priceMinor:1000,durationMinutes:0,maxQuantity:1},true)};
  const configurable={...service,value:{...service.value,capacity:2,extraIds:[20,21],minExtras:1,maxExtras:1}};
  const chosen=selectServiceExtras(configurable,[extra,other],[{id:20,quantity:2}]);
  assert.equal(chosen.value.durationMinutes,90);assert.equal(quote(chosen,2),34000);
  assert.equal(service.value.durationMinutes,60);assert.equal(extra.value.priceMinor,2000);
  const occupied={id:90,service_id:1,professional_id:null,location_id:null,start_at:'2027-01-04T11:00:00Z',end_at:'2027-01-04T12:00:00Z',quantity:1,status:'confirmed',details:{}};
  assert.equal(available({service:configurable,bookings:[occupied]}),true);
  assert.equal(available({service:chosen,bookings:[occupied]}),false);
  assert.throws(()=>selectServiceExtras(configurable,[extra],[]));
  assert.throws(()=>selectServiceExtras(configurable,[extra,other],[{id:20,quantity:1},{id:21,quantity:1}]));
  for(const selection of [[{id:20,quantity:4}],[{id:99,quantity:1}],[{id:20,quantity:0}],[{id:20,quantity:1.5}],[{id:20,quantity:1},{id:20,quantity:1}]]) assert.throws(()=>selectServiceExtras(configurable,[extra],selection));
  assert.throws(()=>selectServiceExtras(configurable,[{...extra,active:false}],[{id:20,quantity:1}]));
  assert.throws(()=>selectServiceExtras({...configurable,value:{...configurable.value,durationMinutes:1440}},[extra],[{id:20,quantity:1}]));
  assert.throws(()=>validateEntry('service','X',{durationMinutes:60,priceMinor:0,minExtras:2,maxExtras:1},true));
  assert.deepEqual(normalizeExtraSelection([{id:21,quantity:1},{id:20,quantity:2}]),[{id:20,quantity:2},{id:21,quantity:1}]);
});

test('changing extras preserves original service charge and duration after catalog repricing', async()=>{
  const {bookingExtrasChange}=await import('../src/reservations/domain.ts');
  const extra={id:20,...validateEntry('extra','Complemento',{priceMinor:3000,durationMinutes:10,maxQuantity:3},true)};
  const current={...service,value:{...service.value,durationMinutes:120,priceMinor:99000,extraIds:[20],minExtras:1,maxExtras:1}};
  const booking={start_at:'2027-01-04T10:00:00Z',end_at:'2027-01-04T11:30:00Z',amount_minor:34000,details:{extras:[{id:20,name:'Anterior',priceMinor:2000,durationMinutes:15,quantity:2}],bufferBefore:0,bufferAfter:0,resourceIds:[]}};
  const result=bookingExtrasChange(booking,current,[extra],[{id:20,quantity:1}]);
  assert.equal(result.amountMinor,33000);assert.equal(result.service.value.durationMinutes,70);
  assert.equal(booking.amount_minor,34000);assert.equal(result.service.value.selectedExtras[0].name,'Complemento');
});


test('reference prices are optional display values and never affect service quotes',()=>{
  const priced={id:1,...validateEntry('service','Consulta',{durationMinutes:60,priceMinor:9000,referencePriceMinor:15000},true)};
  assert.equal(priced.value.referencePriceMinor,15000);assert.equal(quote(priced,2),18000);
  assert.equal(validateEntry('service','X',{durationMinutes:60,priceMinor:9000},true).value.referencePriceMinor,null);
  assert.equal(validateEntry('service','X',{durationMinutes:60,priceMinor:9000,referencePriceMinor:0},true).value.referencePriceMinor,0);
  assert.throws(()=>validateEntry('service','X',{durationMinutes:60,priceMinor:9000,referencePriceMinor:-1},true));
  assert.throws(()=>validateEntry('service','X',{durationMinutes:60,priceMinor:9000,referencePriceMinor:1.5},true));
});

test('catalog images decode real raster data, bound dimensions and strip metadata',async()=>{
  const sharp=(await import('sharp')).default;
  const {prepareCatalogImage,catalogImageMaxBytes}=await import('../src/reservations/images.ts');
  const original=await sharp({create:{width:1600,height:900,channels:3,background:'#6431bc'}}).withMetadata({exif:{IFD0:{Artist:'private-metadata'}}}).png().toBuffer();
  const image=await prepareCatalogImage({mime:'image/png',data:original.toString('base64')});
  const meta=await sharp(image.bytes).metadata();
  assert.equal(meta.format,'webp');assert.equal(meta.width,960);assert.equal(meta.height,540);assert.equal(meta.exif,undefined);
  assert.equal(image.hash.length,64);assert.ok(image.bytes.length<512*1024);
  for(const input of [null,{mime:'image/svg+xml',data:Buffer.from('<svg/>').toString('base64')},{mime:'image/jpeg',data:original.toString('base64')},{mime:'image/png',data:Buffer.from('broken').toString('base64')},{mime:'image/png',data:'a!=='},{mime:'image/png',data:'a'.repeat(4*Math.ceil(catalogImageMaxBytes/3)+4)}]) await assert.rejects(()=>prepareCatalogImage(input));
  const tiny=await sharp({create:{width:24,height:12,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
  const small=await prepareCatalogImage({mime:'image/png',data:tiny.toString('base64')});assert.equal(small.width,24);assert.equal(small.height,12);assert.equal((await sharp(small.bytes).metadata()).hasAlpha,true);
});

test('packages validate session quantities, service scope, durations and attendee capacity',async()=>{
  const {validatePackageServices}=await import('../src/reservations/domain.ts');
  const varied={...service,value:{...service.value,capacity:2,durations:[{minutes:30,priceMinor:9000}]}};
  const input={priceMinor:25000,referencePriceMinor:45000,visibility:'internal',sortOrder:2,sessions:[{serviceId:1,quantity:3,durationMinutes:30,attendees:2}]};
  const validated=validateEntry('package','Plan',input,true);
  assert.equal(validated.value.priceMinor,25000);assert.equal(validated.value.sessions[0].quantity,3);assert.doesNotThrow(()=>validatePackageServices([varied],validated.value,true));
  for(const bad of [{...input,sessions:[]},{...input,sessions:[...input.sessions,...input.sessions]},{...input,visibility:'invalid'},{...input,sessions:[{...input.sessions[0],quantity:0}]},{...input,priceMinor:0.5}]) assert.throws(()=>validateEntry('package','Plan',bad,true));
  assert.throws(()=>validatePackageServices([],validated.value,true));
  assert.throws(()=>validatePackageServices([{...varied,active:false}],validated.value,true));
  assert.doesNotThrow(()=>validatePackageServices([{...varied,active:false}],validated.value,false));
  assert.throws(()=>validatePackageServices([varied],{...validated.value,sessions:[{...input.sessions[0],attendees:3}]},true));
  assert.throws(()=>validatePackageServices([varied],{...validated.value,sessions:[{...input.sessions[0],durationMinutes:45}]},true));
  assert.equal(varied.value.durationMinutes,60);
});

test('only expired unpaid payment holds release capacity at the exact deadline',()=>{
  const booking={id:55,service_id:1,professional_id:null,location_id:null,start_at:start.toISOString(),end_at:'2027-01-04T11:00:00Z',quantity:1,status:'pending',payment_status:'unpaid',hold_expires_at:now.toISOString(),details:{}};
  assert.equal(available({bookings:[booking]}),true);
  assert.equal(available({bookings:[{...booking,hold_expires_at:new Date(now.getTime()+1).toISOString()}]}),false);
  assert.equal(available({bookings:[{...booking,hold_expires_at:null}]}),false);
  for(const payment_status of ['paid','partially_paid','free','refunded']) assert.equal(available({bookings:[{...booking,payment_status}]}),false);
  assert.equal(available({bookings:[{...booking,status:'confirmed'}]}),false);
  assert.equal(validateSettings({...settings}).paymentHoldMinutes,15);
  for(const paymentHoldMinutes of [0,4,121,1.5]) assert.throws(()=>validateSettings({...settings,paymentHoldMinutes}));
});

test('business palettes and column names reject unsafe values and unreadable text',async()=>{
  const {defaultPalette,validBusinessPalette,validColumnNames,onColor,contrast}=await import('../src/ui-settings.ts');
  assert.ok(validBusinessPalette(defaultPalette));assert.ok(validBusinessPalette(undefined));
  assert.equal(onColor('#ffffff'),'#111111');assert.equal(onColor('#111111'),'#ffffff');assert.ok(contrast('#ffffff','#000000')>20);
  for(const value of [null,{}, {...defaultPalette,light:{...defaultPalette.light,text:'#ffffff'}},{...defaultPalette,light:{...defaultPalette.light,accent:'url(evil)'}},{...defaultPalette,light:{...defaultPalette.light,unexpected:'#ffffff'}}])assert.equal(validBusinessPalette(value),false);
  assert.ok(validColumnNames({todo:'Pendientes',doing:'En revisión',done:'Listas'}));
  for(const value of [{todo:''},{paid:'Pagadas'},{todo:'a'.repeat(61)},[]])assert.equal(validColumnNames(value),false);
});

test('button palette additions preserve saved five-color palettes and validate optional colors',async()=>{
 const {defaultPalette,validBusinessPalette,completePalette}=await import('../src/ui-settings.ts');
 const legacy=structuredClone(defaultPalette);for(const mode of ['light','dark']){delete legacy[mode].secondary;delete legacy[mode].outline;}
 assert.ok(validBusinessPalette(legacy));const completed=completePalette(legacy);assert.equal(completed.light.accent,legacy.light.accent);assert.equal(completed.light.secondary,defaultPalette.light.secondary);
 for(const key of ['secondary','outline']){const invalid=structuredClone(defaultPalette);invalid.light[key]='javascript:bad';assert.equal(validBusinessPalette(invalid),false);}
});
