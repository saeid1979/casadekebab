
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import logo from './assets/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://casadekebab-backend.onrender.com/api/restaurant';
const RESTAURANT = { lat: 40.974836942683254, lng: -5.649336331469509 };
const RESTAURANT_ADDRESS = 'Calle García Lorca, 1, Salamanca 37004';
const CUSTOMER_KEY = 'cdkt_app_customer';
const LAST_ORDER_KEY = 'cdkt_app_last_order';
const FAVORITES_KEY = 'cdkt_app_favorites';
const GOOGLE_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Casa%20de%20Kebab%20Turco%20Salamanca';

const statusSteps = [
  ['pending', 'Pedido recibido'],
  ['accepted', 'Pedido aceptado'],
  ['preparing', 'Preparando'],
  ['ready', 'Listo'],
  ['out_for_delivery', 'En reparto'],
  ['delivered', 'Entregado'],
];

const fallbackMenu = [
  { id: 1, name_es: 'Kebab', items: [
    { id: 101, name_es: 'Kebab mixto', description_es: 'Carne mixta, ensalada y salsa.', price: '5.95', option_groups: [] },
    { id: 102, name_es: 'Durum pollo', description_es: 'Pollo, ensalada y salsa.', price: '6.50', option_groups: [] },
  ]},
  { id: 2, name_es: 'Bebidas', items: [
    { id: 201, name_es: 'Agua 0.5L', description_es: '', price: '1.00', option_groups: [] },
  ]},
];

function money(v){ return `${Number(v || 0).toFixed(2).replace('.', ',')} €`; }
function digits(v){ return String(v || '').replace(/\D/g, '').slice(-9); }
function getCustomer(){ try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null'); } catch { return null; } }
function saveCustomer(v){ localStorage.setItem(CUSTOMER_KEY, JSON.stringify(v)); }
function clearCustomer(){ localStorage.removeItem(CUSTOMER_KEY); localStorage.removeItem(LAST_ORDER_KEY); }
function getFavorites(){ try{return JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]')}catch{return []} }
function saveFavorites(v){ localStorage.setItem(FAVORITES_KEY,JSON.stringify(v)); }
function safeNum(v){ if(v === null || v === undefined || v === '') return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function coordinate7(v){
  const n=safeNum(v);
  return n===null?null:Number(n.toFixed(7));
}
function isSalamanca(lat,lng){ return lat!==null&&lng!==null&&lat>=40.80&&lat<=41.12&&lng>=-5.90&&lng<=-5.35; }


function Toast({message,onClose}){
  useEffect(()=>{
    if(!message) return;
    const timer=setTimeout(()=>onClose?.(),4500);
    return()=>clearTimeout(timer);
  },[message,onClose]);

  if(!message) return null;
  return <div className="toast" onClick={onClose}>{message}</div>;
}

function Header({customer,onLogout,onAccount}){
  const [open,setOpen]=useState(true);
  return <header className="app-header pro-header">
    <button className="brand brand-button" onClick={onAccount}>
      <img src={logo} alt="Casa de Kebab Turco" />
      <div><b>Casa de Kebab Turco</b><small>Calle García Lorca, 1 · Salamanca</small></div>
    </button>
    <div className="header-actions">
      <span className={`store-state ${open?'open':'closed'}`}><i></i>{open?'Abierto':'Cerrado'}</span>
      {customer ? <button className="profile-button" onClick={onAccount}>{(customer.name||customer.phone||'C')[0]}</button> : <span className="online-dot">● Online</span>}
    </div>
  </header>;
}

function ProductCard({item,onAdd,isFavorite,onFavorite}){
  const image=item.image_url;
  return <article className="product-card pro-product-card">
    <div className="product-media">
      {image?<img src={image} alt={item.name_es}/>:<div className="food-placeholder">🥙</div>}
      <button className={`favorite-button ${isFavorite?'active':''}`} onClick={()=>onFavorite(item.id)}>{isFavorite?'♥':'♡'}</button>
      {item.is_available===false&&<span className="sold-out">Agotado</span>}
    </div>
    <div className="product-copy">
      <div className="product-title-row"><h3>{item.name_es}</h3><strong>{money(item.price)}</strong></div>
      <p>{item.description_es || 'Preparado al momento con ingredientes frescos.'}</p>
      <button className="add-button" disabled={item.is_available===false} onClick={()=>onAdd(item)}><span>＋</span> Añadir</button>
    </div>
  </article>;
}

function ReviewsStrip({reviews}){
  if(!reviews.length) return null;
  const average=(reviews.reduce((s,r)=>s+Number(r.rating||0),0)/reviews.length).toFixed(1);
  return <section className="reviews-strip">
    <div className="reviews-head"><div><small>OPINIONES REALES</small><h2>Clientes felices</h2></div><div className="rating-summary"><b>{average}</b><span>★★★★★</span><small>{reviews.length} opiniones</small></div></div>
    <div className="review-cards">{reviews.slice(0,6).map(r=><article key={r.id}><div className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div><p>“{r.comment}”</p><b>{r.customer_name||'Cliente'}</b></article>)}</div>
  </section>;
}

function MenuPage({menu,onAdd,reviews}){
  const [query,setQuery]=useState('');
  const [activeCategory,setActiveCategory]=useState('all');
  const [favorites,setFavorites]=useState(getFavorites());
  const normalizedQuery=query.trim().toLowerCase();
  const allItems=useMemo(()=>menu.flatMap(c=>(c.items||[]).map(i=>({...i,categoryId:c.id,categoryName:c.name_es}))),[menu]);
  const filtered=allItems.filter(i=>{
    const text=`${i.name_es||''} ${i.description_es||''}`.toLowerCase();
    return (!normalizedQuery||text.includes(normalizedQuery))&&(activeCategory==='all'||String(i.categoryId)===String(activeCategory));
  });
  function toggleFavorite(id){
    const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
    setFavorites(next);saveFavorites(next);
  }
  return <main className="page home-page">
    <section className="hero pro-hero">
      <div className="hero-content">
        <span className="eyebrow">Sabor auténtico · entrega rápida</span>
        <h1>Tu comida favorita,<br/><em>sin complicaciones.</em></h1>
        <p>Haz tu pedido en pocos pasos y sigue la entrega en tiempo real.</p>
        <div className="hero-badges"><span>⚡ 20–35 min</span><span>📍 Salamanca</span><span>★ 4.9</span></div>
      </div>
      <div className="hero-food"><span>🌯</span><i></i></div>
    </section>

    <section className="smart-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="¿Qué te apetece hoy?"/>{query&&<button onClick={()=>setQuery('')}>×</button>}</section>

    <div className="category-chips"><button className={activeCategory==='all'?'active':''} onClick={()=>setActiveCategory('all')}>Todo</button>{menu.map(c=><button key={c.id} className={String(activeCategory)===String(c.id)?'active':''} onClick={()=>setActiveCategory(c.id)}>{c.name_es}</button>)}</div>

    <div className="section-heading"><div><small>MENÚ</small><h2>{activeCategory==='all'?'Nuestros favoritos':menu.find(c=>String(c.id)===String(activeCategory))?.name_es}</h2></div><span>{filtered.length} productos</span></div>
    {filtered.length?<div className="product-grid pro-grid">{filtered.map(i=><ProductCard key={i.id} item={i} onAdd={onAdd} isFavorite={favorites.includes(i.id)} onFavorite={toggleFavorite}/>)}</div>:<div className="empty-state">No encontramos productos con esa búsqueda.</div>}
    <ReviewsStrip reviews={reviews}/>
  </main>;
}

function CartPage({cart,setCart,onCheckout}){
  const subtotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
  const change=(id,d)=>setCart(c=>c.map(x=>x.id===id?{...x,qty:Math.max(0,x.qty+d)}:x).filter(x=>x.qty>0));
  return <main className="page">
    <h1>Tu cesta</h1>
    {!cart.length && <div className="empty-state">La cesta está vacía.</div>}
    {cart.map(x=><div className="cart-line" key={x.id}>
      <div><b>{x.name_es}</b><small>{money(x.price)} × {x.qty}</small></div>
      <div className="qty"><button onClick={()=>change(x.id,-1)}>−</button><span>{x.qty}</span><button onClick={()=>change(x.id,1)}>+</button></div>
    </div>)}
    <div className="total-row"><span>Subtotal</span><b>{money(subtotal)}</b></div>
    <button className="primary wide" disabled={!cart.length} onClick={onCheckout}>Continuar pedido</button>
  </main>
}

function OtpModal({phone,onVerified,onClose,setToast}){
  const [step,setStep]=useState('phone');
  const [value,setValue]=useState(phone||'');
  const [code,setCode]=useState('');
  const [loading,setLoading]=useState(false);

  async function send(){
    const p=digits(value);
    if(p.length!==9) return setToast('Número de teléfono no válido.');
    setLoading(true);
    try{
      await axios.post(`${API_BASE}/auth/send-code/`,{phone:p});
      setValue(p); setStep('code'); setToast('Código SMS enviado.');
    }catch(e){ setToast(e?.response?.data?.detail || 'No se pudo enviar el SMS.'); }
    finally{ setLoading(false); }
  }
  async function verify(){
    setLoading(true);
    try{
      const r=await axios.post(`${API_BASE}/auth/verify-code/`,{phone:digits(value),code});
      saveCustomer(r.data.customer);
      onVerified(r.data.customer);
    }catch(e){ setToast(e?.response?.data?.message || 'Código incorrecto.'); }
    finally{ setLoading(false); }
  }
  return <div className="overlay">
    <div className="modal">
      <button className="close" onClick={onClose}>×</button>
      <h2>Verificación por SMS</h2>
      {step==='phone'?<>
        <p>Introduce tu móvil para recibir un código.</p>
        <input value={value} onChange={e=>setValue(e.target.value)} placeholder="613473564"/>
        <button className="primary wide" onClick={send} disabled={loading}>{loading?'Enviando...':'Enviar código'}</button>
      </>:<>
        <p>Código enviado a {value}</p>
        <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código SMS" inputMode="numeric"/>
        <button className="primary wide" onClick={verify} disabled={loading}>{loading?'Validando...':'Confirmar'}</button>
      </>}
    </div>
  </div>;
}


function CheckoutPage({cart,customer,onSuccess,setToast,onBack}){
  const [form,setForm]=useState({
    name:customer?.name||'', address:customer?.default_address||'', floor:'', note:'',
    delivery_type:'delivery', payment_method:'cash'
  });
  const [loading,setLoading]=useState(false);
  const [addressResults,setAddressResults]=useState([]);
  const [addressLoading,setAddressLoading]=useState(false);
  const [selectedPoint,setSelectedPoint]=useState(null);
  const [addressTouched,setAddressTouched]=useState(false);
  const addressTimerRef=useRef(null);

  const subtotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
  const deliveryFee=form.delivery_type==='delivery'?1.5:0;
  const total=subtotal+deliveryFee;

  function normalizePlaceRow(row){
    const lat=safeNum(row?.latitude ?? row?.lat);
    const lng=safeNum(row?.longitude ?? row?.lng ?? row?.lon);
    const label=String(
      row?.description ??
      row?.formatted_address ??
      row?.display_name ??
      row?.address ??
      row?.label ??
      ''
    ).trim();

    return {
      ...row,
      lat,
      lng,
      label,
      mainText: row?.main_text || label.split(',')[0] || label,
      place_id: row?.place_id || row?.placeId || row?.id || '',
      secondaryText: row?.secondary_text || label,
    };
  }

  async function searchAddress(query){
    const q=String(query||'').trim();
    if(q.length<2){
      setAddressResults([]);
      setAddressLoading(false);
      return;
    }
    setAddressLoading(true);
    try{
      const r=await axios.get(`${API_BASE}/places/autocomplete/`,{params:{q}});
      const raw=Array.isArray(r.data)
        ? r.data
        : (r.data?.results || r.data?.predictions || r.data?.suggestions || []);
      const rows=raw
        .map(normalizePlaceRow)
        .filter(x=>x.label)
        .slice(0,8);
      setAddressResults(rows);
      if(rows.length>0) setAddressTouched(false);
    }catch(err){
      console.error('ADDRESS_AUTOCOMPLETE_ERROR',err?.response?.data||err);
      setAddressResults([]);
    }finally{
      setAddressLoading(false);
    }
  }

  function onAddressChange(value){
    setForm(current=>({...current,address:value}));
    setSelectedPoint(null);
    setAddressTouched(true);
    if(addressTimerRef.current) clearTimeout(addressTimerRef.current);
    addressTimerRef.current=setTimeout(()=>searchAddress(value),350);
  }

  async function selectAddress(row){
    setToast('');
    setAddressLoading(true);

    try{
      let lat=safeNum(row?.lat ?? row?.latitude);
      let lng=safeNum(row?.lng ?? row?.longitude ?? row?.lon);
      let label=row?.label || row?.description || '';

      if(!isSalamanca(lat,lng)){
        const placeId=row?.place_id || row?.placeId || row?.id;

        if(!placeId){
          throw new Error('La sugerencia no contiene place_id.');
        }

        const response=await axios.get(
          `${API_BASE}/places/details/`,
          {params:{place_id:placeId}}
        );

        lat=safeNum(response.data?.latitude);
        lng=safeNum(response.data?.longitude);
        label=response.data?.formatted_address || label;
      }

      if(!isSalamanca(lat,lng)){
        throw new Error('La dirección seleccionada no tiene coordenadas válidas en Salamanca.');
      }

      setForm(current=>({...current,address:label}));
      setSelectedPoint({lat:coordinate7(lat),lng:coordinate7(lng)});
      setAddressResults([]);
      setAddressTouched(false);
      setToast('');
    }catch(error){
      console.error('ADDRESS_SELECT_ERROR',error?.response?.data||error);
      setSelectedPoint(null);
      setToast(
        error?.response?.data?.detail ||
        error?.message ||
        'No se pudo obtener la ubicación exacta de esta dirección.'
      );
    }finally{
      setAddressLoading(false);
    }
  }

  async function resolveTypedAddress(){
    if(selectedPoint) return selectedPoint;
    const q=String(form.address||'').trim();
    if(q.length<2) return null;
    try{
      const r=await axios.get(`${API_BASE}/places/autocomplete/`,{params:{q}});
      const raw=Array.isArray(r.data)
        ? r.data
        : (r.data?.results || r.data?.predictions || r.data?.suggestions || []);
      const first=raw.map(normalizePlaceRow).find(x=>x.label && isSalamanca(x.lat,x.lng));
      if(!first) return null;
      setForm(current=>({...current,address:first.label}));
      const point={lat:first.lat,lng:first.lng};
      setSelectedPoint(point);
      return point;
    }catch{
      return null;
    }
  }

  useEffect(()=>{
    return()=>{ if(addressTimerRef.current) clearTimeout(addressTimerRef.current); };
  },[]);

  async function submit(){
    setToast('');
    if(!form.name.trim()) return setToast('Escribe tu nombre.');
    if(form.delivery_type==='delivery'&&!form.address.trim()) return setToast('Escribe la dirección.');
    if(form.payment_method==='online') return setToast('El pago online todavía no está disponible.');

    setLoading(true);
    try{
      let point=null;
      if(form.delivery_type==='delivery'){
        point=await resolveTypedAddress();

        // Do not block the order when autocomplete has no suggestion.
        // The shared Django backend can geocode the typed Salamanca address
        // server-side and store the final coordinates for both web and app.
        if(!point){
          setAddressTouched(false);
          setAddressResults([]);
          setToast('Validando la dirección en el servidor...');
        }
      }

      const payload={
        customer_name:form.name,
        customer_phone:customer.phone,
        customer_email:customer.email||'',
        delivery_type:form.delivery_type,
        address:form.delivery_type==='delivery'?form.address:'',
        delivery_latitude:point ? coordinate7(point.lat) : null,
        delivery_longitude:point ? coordinate7(point.lng) : null,
        route_distance_km:null,
        route_duration_min:null,
        delivery_fee_override:deliveryFee,
        note:[form.floor?`Piso/Puerta: ${form.floor}`:'',form.note].filter(Boolean).join(' | '),
        payment_method:form.payment_method,
        items:cart.map(x=>({menu_item_id:x.id,quantity:x.qty,options:[]})),
        coupon_code:''
      };

      const r=await axios.post(`${API_BASE}/orders/`,payload);
      localStorage.setItem(LAST_ORDER_KEY,r.data.order.order_code);
      setToast('');
      onSuccess(r.data.order);
    }catch(e){
      const d=e?.response?.data;
      const message=typeof d==='string'
        ? d
        : (
            d?.detail ||
            Object.entries(d||{})
              .map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(' '):String(v)}`)
              .join(' | ')
          );

      setToast(
        message ||
        'No se pudo registrar el pedido. Revisa la dirección y vuelve a intentarlo.'
      );
    }finally{
      setLoading(false);
    }
  }

  return <main className="page">
    <button className="back" onClick={onBack}>Volver</button>
    <h1>Finalizar pedido</h1>

    <label>Nombre
      <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
    </label>

    <div className="segmented">
      <button className={form.delivery_type==='delivery'?'active':''} onClick={()=>setForm({...form,delivery_type:'delivery'})}>Entrega</button>
      <button className={form.delivery_type==='collection'?'active':''} onClick={()=>setForm({...form,delivery_type:'collection'})}>Recoger</button>
    </div>

    {form.delivery_type==='delivery'&&<>
      <label>Dirección</label>
      <div className="address-autocomplete">
        <input
          value={form.address}
          onChange={e=>onAddressChange(e.target.value)}
          onFocus={()=>{ if(form.address.trim().length>=2) searchAddress(form.address); }}
          placeholder="Escribe calle y número en Salamanca"
          autoComplete="off"
        />

        {addressLoading&&<div className="address-loading">Buscando direcciones...</div>}

        {!addressLoading&&addressResults.length>0&&
          <div className="address-results">
            {addressResults.map((row,index)=>
              <button type="button" key={`${row.label}-${index}`} onClick={()=>selectAddress(row)}>
                <span className="address-pin">📍</span>
                <span>
                  <b>{row.mainText}</b>
                  <small>{row.secondaryText || row.label}</small>
                </span>
              </button>
            )}
          </div>
        }

        {selectedPoint&&<div className="address-selected">✓ Dirección seleccionada y ubicación guardada</div>}

        {addressTouched&&!selectedPoint&&form.address.trim().length>=2&&!addressLoading&&addressResults.length===0&&
          <div className="address-help temporary">No hay sugerencias todavía. Continúa escribiendo la calle y el número.</div>
        }
      </div>

      <label>Piso / puerta
        <input value={form.floor} onChange={e=>setForm({...form,floor:e.target.value})}/>
      </label>
    </>}

    <label>Nota
      <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
    </label>

    <label>Pago
      <select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>
        <option value="cash">Efectivo</option>
        <option value="card_delivery">Tarjeta al repartidor</option>
        <option value="store">Pagar en tienda</option>
        <option value="online">Pago online (no disponible)</option>
      </select>
    </label>

    <div className="summary">
      <span>Subtotal<b>{money(subtotal)}</b></span>
      <span>Entrega<b>{money(deliveryFee)}</b></span>
      <span className="grand">Total<b>{money(total)}</b></span>
    </div>

    <button className="primary wide" onClick={submit} disabled={loading}>
      {loading?'Registrando...':'Confirmar pedido'}
    </button>
  </main>;
}


function ReceiptPage({order,onTrack,onHome}){
  return <main className="page receipt-page">
    <div className="receipt-card">
      <img src={logo}/>
      <h2>Pedido confirmado</h2>
      <p className="success">✓ Tu pedido se ha registrado correctamente</p>
      <div className="order-code">{order.order_code}</div>
      <p>{order.address||'Recogida en el restaurante'}</p>
      <div className="summary"><span>Total<b>{money(order.total)}</b></span><span>Pago<b>{order.payment_method}</b></span><span>Estado<b>{order.status}</b></span></div>
      <button className="primary wide" onClick={onTrack}>Seguir pedido</button>
      <button className="secondary wide" onClick={onHome}>Volver al menú</button>
    </div>
  </main>;
}

function TrackingMap({order}){
  const ref=useRef(null), mapRef=useRef(null), layers=useRef([]);
  const rider=order?.assigned_rider_data;
  const cLat=safeNum(order?.delivery_latitude), cLng=safeNum(order?.delivery_longitude);
  const rLat=safeNum(rider?.current_latitude), rLng=safeNum(rider?.current_longitude);
  const hasCustomer=isSalamanca(cLat,cLng), hasRider=isSalamanca(rLat,rLng);

  useEffect(()=>{
    if(!ref.current||mapRef.current) return;
    const map=L.map(ref.current).setView([RESTAURANT.lat,RESTAURANT.lng],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    mapRef.current=map;
  },[]);

  useEffect(()=>{
    const map=mapRef.current; if(!map)return;
    layers.current.forEach(x=>map.removeLayer(x)); layers.current=[];
    const add=x=>{layers.current.push(x);return x;};
    const pts=[[RESTAURANT.lat,RESTAURANT.lng]];
    add(L.marker([RESTAURANT.lat,RESTAURANT.lng]).addTo(map).bindPopup('Casa de Kebab Turco'));
    if(hasCustomer){add(L.circleMarker([cLat,cLng],{radius:10,color:'#7f1d1d',fillColor:'#ef4444',fillOpacity:1,weight:4}).addTo(map).bindPopup('Cliente'));pts.push([cLat,cLng]);}
    if(hasRider){
      add(L.circleMarker([rLat,rLng],{radius:11,color:'#075c2d',fillColor:'#22c55e',fillOpacity:1,weight:4}).addTo(map).bindPopup('Repartidor'));pts.push([rLat,rLng]);
      add(L.polyline([[RESTAURANT.lat,RESTAURANT.lng],[rLat,rLng]],{color:'#16a34a',weight:5,dashArray:'8 10'}).addTo(map));
    }
    async function route(){
      if(hasRider&&hasCustomer){
        let line=[[rLat,rLng],[cLat,cLng]];
        try{
          const u=`https://router.project-osrm.org/route/v1/driving/${rLng},${rLat};${cLng},${cLat}?overview=full&geometries=geojson`;
          const data=await fetch(u).then(r=>r.json());
          const coords=data?.routes?.[0]?.geometry?.coordinates;
          if(coords?.length) line=coords.map(([lng,lat])=>[lat,lng]);
        }catch{}
        add(L.polyline(line,{color:'#fff',weight:12,opacity:.95}).addTo(map));
        add(L.polyline(line,{color:'#dc2626',weight:7,opacity:1}).addTo(map));
      }
      if(pts.length>1) map.fitBounds(pts,{padding:[30,30],maxZoom:16});
    }
    route();
  },[order?.order_code,cLat,cLng,rLat,rLng,hasCustomer,hasRider]);

  return <><div className="map" ref={ref}></div>{!hasRider&&<div className="notice">Esperando la ubicación GPS del repartidor.</div>}</>;
}

function StarInput({value,onChange,label}){
  return <div className="rating-row"><span>{label}</span><div>{[1,2,3,4,5].map(n=><button type="button" key={n} className={n<=value?'active':''} onClick={()=>onChange(n)}>★</button>)}</div></div>;
}

function ReviewModal({order,customer,onClose,onDone,setToast}){
  const [form,setForm]=useState({rating:5,food_rating:5,delivery_rating:5,packaging_rating:5,rider_rating:5,would_recommend:true,comment:''});
  const [loading,setLoading]=useState(false);
  async function submit(){
    if(form.comment.trim().length<3)return setToast('Escribe una opinión breve.');
    setLoading(true);
    try{
      await axios.post(`${API_BASE}/reviews/`,{order_code:order.order_code,phone:customer.phone,...form});
      setToast('¡Gracias! Tu opinión se ha enviado.');
      onDone?.();onClose();
    }catch(e){setToast(e?.response?.data?.detail||'No se pudo enviar la opinión.');}
    finally{setLoading(false);}
  }
  return <div className="overlay review-overlay"><section className="modal review-modal">
    <button className="close" onClick={onClose}>×</button>
    <div className="review-hero"><span>✨</span><h2>¿Qué tal tu pedido?</h2><p>{order.order_code}</p></div>
    <StarInput label="Experiencia general" value={form.rating} onChange={v=>setForm({...form,rating:v})}/>
    <StarInput label="Calidad de la comida" value={form.food_rating} onChange={v=>setForm({...form,food_rating:v})}/>
    <StarInput label="Presentación y embalaje" value={form.packaging_rating} onChange={v=>setForm({...form,packaging_rating:v})}/>
    {order.delivery_type==='delivery'&&<><StarInput label="Rapidez de entrega" value={form.delivery_rating} onChange={v=>setForm({...form,delivery_rating:v})}/><StarInput label="Atención del repartidor" value={form.rider_rating} onChange={v=>setForm({...form,rider_rating:v})}/></>}
    <textarea value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})} placeholder="Cuéntanos qué te gustó o qué podemos mejorar..." maxLength={1200}/>
    <label className="recommend-switch"><input type="checkbox" checked={form.would_recommend} onChange={e=>setForm({...form,would_recommend:e.target.checked})}/><span>Recomendaría Casa de Kebab Turco</span></label>
    <button className="primary wide animated-submit" onClick={submit} disabled={loading}>{loading?'Enviando...':'Enviar mi opinión'}</button>
    <a className="google-review-link" href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer">Abrir Casa de Kebab en Google Maps</a>
    <small className="privacy-note">La publicación en Google nunca es automática.</small>
  </section></div>;
}

function OrdersPage({customer,setToast}){
  const [orders,setOrders]=useState([]),[selected,setSelected]=useState(null),[loading,setLoading]=useState(false);
  const [reviewOrder,setReviewOrder]=useState(null);
  async function load(){
    if(!customer) return;
    setLoading(true);
    try{
      const r=await axios.get(`${API_BASE}/customers/orders/`,{params:{phone:customer.phone}});
      const rows=Array.isArray(r.data)?r.data:(r.data.orders||[]);
      setOrders(rows); if(!selected&&rows[0]) setSelected(rows[0]);
    }catch(e){setToast('No se pudieron cargar los pedidos.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load(); const id=setInterval(load,5000); return()=>clearInterval(id);},[customer?.phone]);
  const order=selected;
  const idx=order?statusSteps.findIndex(x=>x[0]===order.status):-1;
  return <main className="page">
    <div className="page-title"><h1>Mis pedidos</h1><button className="ghost" onClick={load}>Actualizar</button></div>
    {loading&&!orders.length&&<p>Cargando...</p>}
    {!orders.length&&!loading&&<div className="empty-state">No hay pedidos todavía.</div>}
    <div className="order-tabs">{orders.map(o=><button key={o.order_code} className={order?.order_code===o.order_code?'active':''} onClick={()=>setSelected(o)}>{o.order_code}</button>)}</div>
    {order&&<>
      <div className="timeline">{statusSteps.map(([s,label],i)=><div key={s} className={i<=idx?'done':''}><span>{i<idx?'✓':i+1}</span><small>{label}</small></div>)}</div>
      <div className="tracking-card pro-tracking-card">
        <div className="tracking-head"><div><small>ESTADO DEL PEDIDO</small><h2>{order.order_code}</h2></div><b>{money(order.total)}</b></div>
        <p>{order.address||'Recogida en tienda'}</p>
        <TrackingMap order={order}/>
        {order.status==='delivered'&&<button className="review-order-button" onClick={()=>setReviewOrder(order)}>★ Valorar este pedido</button>}
      </div>
    </>}
    {reviewOrder&&<ReviewModal order={reviewOrder} customer={customer} onClose={()=>setReviewOrder(null)} onDone={load} setToast={setToast}/>}
  </main>;
}

function AccountPage({customer,onLogout}){
  return <main className="page account-page">
    <section className="account-hero"><div className="avatar">{(customer?.name||customer?.phone||'C')[0]}</div><div><small>MI CUENTA</small><h1>{customer?.name||'Cliente'}</h1><p>{customer?.phone}</p></div></section>
    <div className="account-grid">
      <article><span>📍</span><div><small>Dirección habitual</small><b>{customer?.default_address||'Aún no guardada'}</b></div></article>
      <article><span>📦</span><div><small>Pedidos realizados</small><b>{customer?.total_orders||0}</b></div></article>
      <article><span>✉️</span><div><small>Email</small><b>{customer?.email||'Sin email'}</b></div></article>
    </div>
    <div className="account-card pro-account-card"><h2>Ayuda y restaurante</h2><a href="tel:+34613473564">☎ Llamar al restaurante</a><a href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer">📍 Abrir en Google Maps</a><p>{RESTAURANT_ADDRESS}</p><button className="danger wide" onClick={onLogout}>Cerrar sesión</button></div>
  </main>;
}

function BottomNav({tab,setTab,cartCount}){
  const items=[['menu','🍽️','Menú'],['cart','🛒',`Cesta${cartCount?` (${cartCount})`:''}`],['orders','📍','Pedidos'],['account','👤','Cuenta']];
  return <nav className="bottom-nav">{items.map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
}

function App(){
  const [tab,setTab]=useState('menu');
  const [menu,setMenu]=useState(fallbackMenu);
  const [cart,setCart]=useState([]);
  const [customer,setCustomer]=useState(getCustomer());
  const [otp,setOtp]=useState(false);
  const [checkout,setCheckout]=useState(false);
  const [receipt,setReceipt]=useState(null);
  const [toast,setToast]=useState('');
  const [reviews,setReviews]=useState([]);

  useEffect(()=>{axios.get(`${API_BASE}/menu/`).then(r=>{if(Array.isArray(r.data)&&r.data.length)setMenu(r.data)}).catch(()=>{});axios.get(`${API_BASE}/reviews/public/`).then(r=>setReviews(Array.isArray(r.data)?r.data:(r.data.reviews||[]))).catch(()=>{});},[]);
  function add(item){setCart(c=>{const x=c.find(y=>y.id===item.id);return x?c.map(y=>y.id===item.id?{...y,qty:y.qty+1}:y):[...c,{...item,qty:1}]});setToast('Añadido a la cesta.');}
  function beginCheckout(){if(!customer)return setOtp(true);setCheckout(true);}
  function verified(c){setCustomer(c);setOtp(false);setCheckout(true);}
  function success(order){setReceipt(order);setCheckout(false);setCart([]);}
  function logout(){clearCustomer();setCustomer(null);setTab('menu');}
  const count=cart.reduce((s,x)=>s+x.qty,0);

  let body=<MenuPage menu={menu} onAdd={add} reviews={reviews}/>;
  if(tab==='cart') body=<CartPage cart={cart} setCart={setCart} onCheckout={beginCheckout}/>;
  if(tab==='orders') body=customer?<OrdersPage customer={customer} setToast={setToast}/>:<main className="page"><div className="empty-state">Primero inicia sesión por SMS.</div><button className="primary wide" onClick={()=>setOtp(true)}>Entrar</button></main>;
  if(tab==='account') body=customer?<AccountPage customer={customer} onLogout={logout}/>:<main className="page"><div className="empty-state">No has iniciado sesión.</div><button className="primary wide" onClick={()=>setOtp(true)}>Entrar por SMS</button></main>;
  if(checkout) body=<CheckoutPage cart={cart} customer={customer} onSuccess={success} setToast={setToast} onBack={()=>setCheckout(false)}/>;
  if(receipt) body=<ReceiptPage order={receipt} onTrack={()=>{setReceipt(null);setTab('orders')}} onHome={()=>{setReceipt(null);setTab('menu')}}/>;

  return <div className="app-shell">
    <Header customer={customer} onLogout={logout} onAccount={()=>setTab('account')}/>
    {body}
    {!checkout&&!receipt&&<BottomNav tab={tab} setTab={setTab} cartCount={count}/>}
    {otp&&<OtpModal phone={customer?.phone} onVerified={verified} onClose={()=>setOtp(false)} setToast={setToast}/>}
    <Toast message={toast} onClose={()=>setToast('')}/>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
