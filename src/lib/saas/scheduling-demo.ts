/** Read-only sample data. Never calls a business API or creates real bookings. */
export function schedulingDemo(query='') {
 const params=new URLSearchParams(query.replace(/^\?/,''));
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date());
 const date=(offset:number)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
 const settings={timezone:'America/Santiago',currency:'CLP',intervalMinutes:15,advanceMinutes:0,horizonDays:180,paymentHoldMinutes:15,allowPayLater:true,maxBookingsPerDay:0,maxFutureBookingsPerCustomer:0,schedule:[1,2,3,4,5].map(weekday=>({weekday,start:'09:00',end:'18:00'})),exceptions:[],version:0};
 const entry=(id:number,kind:string,name:string,value:any)=>({id,kind,name,value,active:true,version:1});
 const catalog=[entry(1,'category','Bienestar',{sortOrder:0}),entry(2,'service','Asesoría personal',{durationMinutes:60,priceMinor:25000,capacity:1,categoryId:1,professionalIds:[3],locationIds:[4],resourceIds:[],extraIds:[]}),entry(3,'professional','Camila Soto',{email:'camila@example.test'}),entry(4,'location','Providencia',{address:'Sucursal de ejemplo'}),entry(5,'customer','Francisca Rojas',{email:'francisca@example.test',phone:'+56 9 1234 5678'})];
 const bookings=[[-2,12],[-1,12],[0,12],[0,14],[1,12],[1,14]].map(([offset,hour],i)=>({id:i+1,version:1,hold_expires_at:null,service_id:2,professional_id:3,location_id:4,customer_name:['Francisca Rojas','Matías Pérez'][i%2],customer_email:`cliente${i}@example.test`,start_at:date(offset)+`T${hour}:00:00Z`,end_at:date(offset)+`T${hour+1}:00:00Z`,quantity:1,amount_minor:25000,currency:'CLP',status:offset<0?'completed':'confirmed',payment_status:offset<0?'paid':'unpaid',details:{serviceName:'Asesoría personal',professionalName:'Camila Soto',locationName:'Providencia',extras:[]}}));
 if(params.get('action')==='dashboard'){
  const days=params.get('days')==='30'?30:7;
  const daily=Array.from({length:days},(_,i)=>{const day=date(i-days+1);return{day,count:bookings.filter(b=>b.start_at.startsWith(day)).length,canceled:0};});
  const appointment=(b:typeof bookings[number])=>({id:b.id,customerName:b.customer_name,serviceName:b.details.serviceName,professionalName:b.details.professionalName,locationName:b.details.locationName,startAt:b.start_at,endAt:b.end_at,status:b.status});
  return {from:date(1-days),to:today,days,timezone:settings.timezone,currency:'CLP',totals:{bookings:4,confirmed:2,pending:0,canceled:0,completed:2,customers:2,paidMinor:50000},daily,today:bookings.filter(b=>b.start_at.startsWith(today)).map(appointment),todayTotal:2,upcoming:bookings.filter(b=>b.start_at.slice(0,10)>today).map(appointment),services:[{service_id:2,name:'Asesoría personal',count:4}],professionals:[{professional_id:3,name:'Camila Soto',count:4}]};
 }
 if(params.get('action')==='booking-details')return {booking:bookings.find(b=>b.id===Number(params.get('id'))),history:[],canViewHistory:false};
 const filtered=bookings.filter(b=>(!params.get('day')||b.start_at.startsWith(params.get('day')!))&&(!params.get('search')||b.customer_name.toLowerCase().includes(params.get('search')!.toLowerCase())));
 return {settings,members:[],catalog,bookings:filtered,total:filtered.length,page:1,canConfigure:true,canWrite:false,actorId:0};
}
