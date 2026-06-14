import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';import axios from'axios';import L from'leaflet';import{Geolocation}from'@capacitor/geolocation';import'leaflet/dist/leaflet.css';import'./styles.css';import logo from'./assets/logo.png';
const PROD='https://casadekebab-backend.onrender.com/api/restaurant';const ENV=String(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');const API=(!ENV||/localhost|127\.0\.0\.1/i.test(ENV))?PROD:ENV;const KEY='cdkt_rider_session';const LOC='cdkt_rider_last_location';const REST={lat:40.974836942683254,lng:-5.649336331469509};
const META={pending:['Recibido','amber'],accepted:['Aceptado','blue'],preparing:['Preparando','orange'],ready:['Listo','violet'],out_for_delivery:['En reparto','green'],delivered:['Entregado','gray'],cancelled:['Cancelado','red']};const NEXT={pending:'accepted',accepted:'out_for_delivery',preparing:'out_for_delivery',ready:'out_for_delivery',out_for_delivery:'delivered'};
const money=v=>`${Number(v||0).toFixed(2).replace('.',',')} €`;const digits=v=>String(v||'').replace(/\D/g,'').slice(-9);const num=v=>(v===null||v===undefined||v==='')?null:(Number.isFinite(Number(v))?Number(v):null);const valid=(a,b)=>a!==null&&b!==null&&a>=40.8&&a<=41.12&&b>=-5.9&&b<=-5.35;const session=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};const route=a=>`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a||'')}`;
const authHeaders=r=>({Authorization:`Bearer ${r?.token||''}`});
function Toast({m,close}){useEffect(()=>{if(!m)return;const i=setTimeout(close,4500);return()=>clearTimeout(i)},[m]);return m?<div className='toast' onClick={close}>{m}</div>:null}
function Login({done,msg}){
  const[username,setUsername]=useState('');
  const[password,setPassword]=useState('');
  const[showPassword,setShowPassword]=useState(false);
  const[loading,setLoading]=useState(false);

  async function go(e){
    e.preventDefault();
    if(!username.trim()||!password)return msg('Escribe usuario y contraseña.');
    setLoading(true);
    try{
      const response=await axios.post(
        `${API}/auth/rider/login/`,
        {username:username.trim(),password},
        {timeout:70000}
      );
      const user={...response.data.rider,token:response.data.token};
      localStorage.setItem(KEY,JSON.stringify(user));
      done(user);
    }catch(error){
      msg(error?.response?.data?.detail||'Usuario o contraseña incorrectos.');
    }finally{
      setLoading(false);
    }
  }

  return <div className='login'>
    <section>
      <img src={logo}/>
      <span>RIDER PRO</span>
      <h1>Acceso seguro</h1>
      <p>Entra con el usuario y la contraseña asignados por el administrador.</p>
      <form onSubmit={go}>
        <label>Nombre de usuario</label>
        <div className='phone'>
          <b>👤</b>
          <input value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize='none' autoCorrect='off' autoComplete='username' placeholder='repartidor1'/>
        </div>
        <label>Contraseña</label>
        <div className='phone'>
          <b>🔒</b>
          <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete='current-password' placeholder='••••••••'/>
          <button type='button' onClick={()=>setShowPassword(v=>!v)} style={{width:'auto',margin:0,padding:'0 12px',borderRadius:0}}>
            {showPassword?'Ocultar':'Ver'}
          </button>
        </div>
        <button disabled={loading}>{loading?'Verificando...':'Iniciar sesión'}</button>
      </form>
      <small>El acceso requiere credenciales activas de repartidor.</small>
    </section>
  </div>
}
function Map({order,loc}){const ref=useRef(),map=useRef(),layers=useRef([]);const cl=num(order?.delivery_latitude),cg=num(order?.delivery_longitude),rl=num(loc?.lat),rg=num(loc?.lng),hc=valid(cl,cg),hr=valid(rl,rg);useEffect(()=>{if(!ref.current||map.current)return;map.current=L.map(ref.current).setView([REST.lat,REST.lng],14);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map.current)},[]);useEffect(()=>{const m=map.current;if(!m)return;layers.current.forEach(x=>m.removeLayer(x));layers.current=[];const add=x=>(layers.current.push(x),x);const b=[[REST.lat,REST.lng]];add(L.marker([REST.lat,REST.lng]).addTo(m).bindPopup('Restaurante'));if(hc){add(L.circleMarker([cl,cg],{radius:10,color:'#7f1d1d',fillColor:'#ef4444',fillOpacity:1,weight:4}).addTo(m).bindPopup('Cliente'));b.push([cl,cg])}if(hr){add(L.circleMarker([rl,rg],{radius:11,color:'#064e3b',fillColor:'#22c55e',fillOpacity:1,weight:5}).addTo(m).bindPopup('Tu ubicación'));b.push([rl,rg])}async function draw(){if(hr&&hc){let line=[[rl,rg],[cl,cg]];try{const u=`https://router.project-osrm.org/route/v1/driving/${rg},${rl};${cg},${cl}?overview=full&geometries=geojson`;const d=await fetch(u).then(x=>x.json());const c=d?.routes?.[0]?.geometry?.coordinates;if(c?.length)line=c.map(([x,y])=>[y,x])}catch{}add(L.polyline(line,{color:'#fff',weight:12,opacity:.95}).addTo(m));add(L.polyline(line,{color:'#dc2626',weight:7}).addTo(m))}if(b.length>1)m.fitBounds(b,{padding:[30,30],maxZoom:16})}draw()},[order?.order_code,cl,cg,rl,rg]);return <div ref={ref} className='map'/>
}
function Card({o,on,sel}){const[m,t]=META[o.status]||[o.status,'gray'];return <button className={`card ${sel?'sel':''}`} onClick={on}><div><b>{o.order_code}</b><span className={`status ${t}`}>{m}</span></div><h3>{o.customer_name||'Cliente'}</h3><p>{o.address}</p><footer><span>{(o.items||[]).reduce((s,x)=>s+Number(x.quantity||0),0)} productos</span><strong>{money(o.total)}</strong></footer></button>}
function Chat({o,r,msg}){const[list,setList]=useState([]),[text,setText]=useState('');async function load(){try{const x=await axios.get(`${API}/orders/${o.order_code}/chat/`,{params:{phone:r.phone,sender_type:'rider'}});setList(Array.isArray(x.data)?x.data:(x.data.messages||[]))}catch{}}useEffect(()=>{load();const i=setInterval(load,5000);return()=>clearInterval(i)},[o.order_code]);async function send(){if(!text.trim())return;try{await axios.post(`${API}/orders/${o.order_code}/chat/`,{phone:r.phone,sender_type:'rider',sender_name:r.name||'Repartidor',message:text.trim()});setText('');load()}catch(e){msg(e?.response?.data?.detail||'No se pudo enviar.')}}return <section className='chat'><header><h2>Chat</h2><span>Auto 5s</span></header><div className='chatlist'>{!list.length&&<p>Sin mensajes.</p>}{list.map(x=><article className={x.sender_type==='rider'?'mine':''} key={x.id}><b>{x.sender_name||x.sender_type}</b><p>{x.message}</p></article>)}</div><div className='compose'><input value={text} onChange={e=>setText(e.target.value)} placeholder='Escribe al cliente...'/><button onClick={send}>Enviar</button></div></section>}
function Detail({o,r,loc,changed,msg}){const next=NEXT[o.status];async function status(s){try{const x=await axios.post(`${API}/rider/secure/orders/${o.order_code}/status/`,{status:s},{headers:authHeaders(r)});changed(x.data);msg('Estado actualizado.')}catch(e){msg(e?.response?.data?.detail||'No se pudo actualizar.')}}return <div className='stack'><section className='detail'><header><div><small>Entrega activa</small><h2>{o.order_code}</h2></div><span className={`status ${(META[o.status]||[])[1]||'gray'}`}>{(META[o.status]||[])[0]||o.status}</span></header><Map order={o} loc={loc}/><div className='customer'><div><small>Cliente</small><b>{o.customer_name}</b><span>{o.customer_phone}</span></div><div><a href={`tel:${o.customer_phone}`}>☎</a><a target='_blank' href={`https://wa.me/34${digits(o.customer_phone)}?text=${encodeURIComponent('Hola, soy el repartidor de tu pedido '+o.order_code)}`}>WA</a></div></div><div className='box'><small>Dirección</small><b>{o.address}</b>{o.note&&<p>{o.note}</p>}<a target='_blank' href={route(o.address)}>Abrir navegación</a></div><div className='box'>{(o.items||[]).map(x=><div className='row' key={x.id}><span>{x.quantity}× {x.name_snapshot}</span><b>{money(x.total)}</b></div>)}</div><div className='row pay'><span>Pago</span><b>{o.payment_method} · {o.payment_status}</b></div><div className='actions'>{next&&<button className='primary' onClick={()=>status(next)}>{next==='delivered'?'Marcar entregado':`Cambiar a ${(META[next]||[])[0]}`}</button>}<button className='secondary' onClick={()=>status('cancelled')}>Incidencia</button></div></section><Chat o={o} r={r} msg={msg}/></div>}
function Dashboard({r,logout,msg}){const[orders,setOrders]=useState([]),[code,setCode]=useState(''),[loading,setLoading]=useState(true),[gps,setGps]=useState(false),[loc,setLoc]=useState(()=>{try{return JSON.parse(localStorage.getItem(LOC)||'null')}catch{return null}}),watch=useRef(null),last=useRef(0);const selected=orders.find(x=>x.order_code===code)||orders[0]||null;const cash=orders.filter(x=>x.payment_method==='cash'&&x.payment_status!=='paid').reduce((s,x)=>s+Number(x.total||0),0);async function load(silent=false){if(!silent)setLoading(true);try{const x=await axios.get(`${API}/rider/secure/orders/`,{headers:authHeaders(r),timeout:70000});const a=x.data.orders||[];setOrders(a);if(!code&&a[0])setCode(a[0].order_code)}catch(e){if(!silent)msg(e?.response?.data?.detail||'No se pudieron cargar pedidos.')}finally{if(!silent)setLoading(false)}}useEffect(()=>{load();const i=setInterval(()=>load(true),7000);return()=>clearInterval(i)},[r.phone]);async function send(p){if(Date.now()-last.current<4000)return;last.current=Date.now();try{await axios.post(`${API}/rider/secure/location/`,{latitude:Number(p.lat.toFixed(7)),longitude:Number(p.lng.toFixed(7))},{headers:authHeaders(r)})}catch{}}async function start(){try{await Geolocation.requestPermissions();watch.current=await Geolocation.watchPosition({enableHighAccuracy:true,timeout:15000,maximumAge:3000},(p,e)=>{if(e||!p?.coords)return;const q={lat:p.coords.latitude,lng:p.coords.longitude};if(!valid(q.lat,q.lng))return;setLoc(q);localStorage.setItem(LOC,JSON.stringify(q));send(q)});setGps(true);msg('GPS activo.')}catch{msg('No se pudo activar GPS.')}}async function stop(){if(watch.current!==null)try{await Geolocation.clearWatch({id:watch.current})}catch{}watch.current=null;setGps(false)}function changed(u){setOrders(a=>(u.status==='delivered'||u.status==='cancelled')?a.filter(x=>x.order_code!==u.order_code):a.map(x=>x.order_code===u.order_code?u:x));if(u.status==='delivered'||u.status==='cancelled')setCode('')}return <div className='shell'><header className='top'><div className='brand'><img src={logo}/><div><b>Casa Kebab Rider</b><small>{r.name} · {r.phone}</small></div></div><button className={gps?'gpson':''} onClick={()=>gps?stop():start()}>{gps?'● GPS':'○ GPS'}</button><button onClick={logout}>Salir</button></header><main><section className='hero'><div><span>TURNO ACTIVO</span><h1>Hola, {r.name||'repartidor'}</h1><p>{gps?'Ubicación compartida en tiempo real.':'Activa GPS para comenzar.'}</p></div><button className={gps?'on':''} onClick={()=>gps?stop():start()}>{gps?'GPS ACTIVO':'ACTIVAR GPS'}</button></section><section className='metrics'><article>📦<div><small>Activos</small><b>{orders.length}</b></div></article><article>💶<div><small>Efectivo</small><b>{money(cash)}</b></div></article><article>📍<div><small>GPS</small><b>{gps?'Online':'Offline'}</b></div></article></section><section className='work'><aside><header><h2>Mis entregas</h2><button onClick={()=>load()}>↻</button></header>{loading&&<p>Cargando...</p>}{!loading&&!orders.length&&<p>Sin entregas activas.</p>}{orders.map(o=><Card key={o.order_code} o={o} sel={selected?.order_code===o.order_code} on={()=>setCode(o.order_code)}/>)}</aside><section>{selected?<Detail o={selected} r={r} loc={loc} changed={changed} msg={msg}/>:<div className='empty'>🛵<h2>Selecciona una entrega</h2></div>}</section></section></main><nav className='bottom'><button>📦<small>Entregas</small></button><button onClick={()=>selected&&window.open(route(selected.address),'_blank')}>🧭<small>Navegar</small></button><button onClick={()=>selected&&window.open(`tel:${selected.customer_phone}`)}>☎<small>Cliente</small></button><button onClick={logout}>👤<small>Cuenta</small></button></nav></div>}
function App(){const[r,setR]=useState(session()),[m,setM]=useState('');const logout=()=>{localStorage.removeItem(KEY);setR(null)};return <>{r?<Dashboard r={r} logout={logout} msg={setM}/>:<Login done={setR} msg={setM}/>}<Toast m={m} close={()=>setM('')}/></>};createRoot(document.getElementById('root')).render(<App/>);
