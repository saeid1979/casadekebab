
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import L from 'leaflet';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import logo from './assets/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://casadekebab-backend.onrender.com/api/restaurant';
const RESTAURANT = { lat: 40.974836942683254, lng: -5.649336331469509 };
const RESTAURANT_ADDRESS = 'Calle García Lorca, 1, Salamanca 37004';
const CUSTOMER_KEY = 'cdkt_app_customer';
const LAST_ORDER_KEY = 'cdkt_app_last_order';
const FAVORITES_KEY = 'cdkt_app_favorites';
const CART_KEY = 'cdkt_app_cart';
const SAVED_ADDRESSES_KEY = 'cdkt_app_saved_addresses';
const RECENT_ITEMS_KEY = 'cdkt_app_recent_items';
const LAST_MENU_CACHE_KEY = 'cdkt_app_menu_cache';
const NOTIFICATIONS_KEY = 'cdkt_app_notifications';
const ORDER_STATUS_CACHE_KEY = 'cdkt_app_order_status_cache';
const PUSH_TOKEN_KEY = 'cdkt_app_push_token';

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
function getFavorites(){ try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; } }
function saveFavorites(v){ localStorage.setItem(FAVORITES_KEY, JSON.stringify(v)); }
function getSavedCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } }
function saveCart(v){ localStorage.setItem(CART_KEY, JSON.stringify(v)); }
function getSavedAddresses(){
  try { return JSON.parse(localStorage.getItem(SAVED_ADDRESSES_KEY) || '[]'); }
  catch { return []; }
}
function saveSavedAddresses(v){
  localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(v));
}
function getRecentItems(){
  try { return JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || '[]'); }
  catch { return []; }
}
function saveRecentItems(v){
  localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(v));
}
function getCachedMenu(){
  try { return JSON.parse(localStorage.getItem(LAST_MENU_CACHE_KEY) || 'null'); }
  catch { return null; }
}
function saveCachedMenu(v){
  try { localStorage.setItem(LAST_MENU_CACHE_KEY, JSON.stringify(v)); } catch {}
}
function getNotifications(){
  try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]'); }
  catch { return []; }
}
function saveNotifications(v){
  try { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(v)); } catch {}
}
function getOrderStatusCache(){
  try { return JSON.parse(localStorage.getItem(ORDER_STATUS_CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function saveOrderStatusCache(v){
  try { localStorage.setItem(ORDER_STATUS_CACHE_KEY, JSON.stringify(v)); } catch {}
}
function statusLabel(status){
  return (statusSteps.find(row=>row[0]===status)||[null,status])[1];
}
function notificationText(order){
  const labels={
    pending:'Hemos recibido tu pedido.',
    accepted:'El restaurante ha aceptado tu pedido.',
    preparing:'Tu pedido se está preparando.',
    ready:'Tu pedido está listo.',
    out_for_delivery:'El repartidor está en camino.',
    delivered:'Tu pedido ha sido entregado. ¡Buen provecho!',
    cancelled:'Tu pedido ha sido cancelado.'
  };
  return labels[order?.status] || `Estado actualizado: ${statusLabel(order?.status)}`;
}
async function requestLocalNotificationPermission(){
  try{
    const current=await LocalNotifications.checkPermissions();
    if(current.display==='granted') return true;
    const requested=await LocalNotifications.requestPermissions();
    return requested.display==='granted';
  }catch{
    return false;
  }
}
async function showLocalOrderNotification(order){
  try{
    const granted=await requestLocalNotificationPermission();
    if(!granted) return false;
    const id=Math.abs(
      Array.from(`${order?.order_code||''}-${order?.status||''}`)
        .reduce((sum,char)=>((sum*31)+char.charCodeAt(0))|0,7)
    ) || Date.now()%2147483647;

    await LocalNotifications.schedule({
      notifications:[{
        id,
        title:`Pedido ${order?.order_code||''} · ${statusLabel(order?.status)}`,
        body:notificationText(order),
        schedule:{at:new Date(Date.now()+300)},
        sound:null,
        smallIcon:'ic_stat_icon_config_sample',
        extra:{order_code:order?.order_code,status:order?.status}
      }]
    });
    return true;
  }catch{
    return false;
  }
}

async function registerPushTokenWithBackend(customer,token){
  if(!customer?.phone||!token) return false;
  try{
    await axios.post(`${API_BASE}/push/register/`,{
      customer_id:customer.id||null,
      phone:digits(customer.phone),
      device_token:token,
      platform:Capacitor.getPlatform()||'android',
      app_version:'1.0.0'
    });
    localStorage.setItem(PUSH_TOKEN_KEY,token);
    return true;
  }catch(error){
    console.warn('Push token registration failed',error?.response?.data||error?.message);
    return false;
  }
}

async function unregisterPushTokenFromBackend(customer){
  const token=localStorage.getItem(PUSH_TOKEN_KEY)||'';
  if(!token) return true;
  try{
    await axios.post(`${API_BASE}/push/unregister/`,{
      phone:digits(customer?.phone||''),
      device_token:token
    });
  }catch(error){
    console.warn('Push token unregister failed',error?.response?.data||error?.message);
  }finally{
    localStorage.removeItem(PUSH_TOKEN_KEY);
  }
  return true;
}


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

function Header({customer,onLogout,onAccount,isOnline,pushReady}){
  return <header className="app-header pro-header">
    <div className="brand">
      <img src={logo} alt="Casa de Kebab Turco" />
      <div>
        <small className="brand-kicker">CASA DE KEBAB TURCO</small>
        <b>Pedido rápido y fácil</b>
        <span className="open-status"><i></i> Abierto · 12:00–01:00</span>
      </div>
    </div>
    <div className="header-actions">
      <span className={`network-chip ${isOnline?'online':'offline'}`}>{isOnline?'Online':'Offline'}</span>
      {customer&&Capacitor.isNativePlatform()?<span className={`push-chip ${pushReady?'ready':'waiting'}`}>{pushReady?'Push activo':'Push pendiente'}</span>:null}
      {customer
        ? <button className="profile-chip" onClick={onAccount}>
            <span>{(customer?.name||customer?.phone||'C')[0]}</span>
            <small>{customer?.name||'Mi cuenta'}</small>
          </button>
        : <span className="online-dot">● Online</span>}
    </div>
  </header>;
}

function ProductCard({item,onAdd,isFavorite,onToggleFavorite,onView,index=0}){
  const image=item.image_url || item.image || '';
  return <article className="product-card pro-product-card" style={{animationDelay:`${Math.min(index,12)*45}ms`}} onClick={()=>onView?.(item)}>
    <div className="product-media">
      {image
        ? <img src={image} alt={item.name_es} loading="lazy"/>
        : <div className="food-placeholder">🥙</div>}
      <button
        type="button"
        className={`favorite-button ${isFavorite?'active':''}`}
        onClick={(e)=>{e.stopPropagation();onToggleFavorite(item.id)}}
        aria-label="Favorito"
      >{isFavorite?'♥':'♡'}</button>
      {!item.is_available&&<span className="sold-out">Agotado</span>}
    </div>
    <div className="product-copy">
      <div className="product-title-row">
        <h3>{item.name_es}</h3>
        <span className="rating-mini">★ 4.8</span>
      </div>
      <p>{item.description_es || 'Preparado al momento con ingredientes frescos.'}</p>
      <div className="product-foot">
        <strong>{money(item.price)}</strong>
        <button
          className="add-product-button"
          disabled={item.is_available===false}
          onClick={(e)=>{e.stopPropagation();onAdd(item)}}
        >
          <span>+</span> Añadir
        </button>
      </div>
    </div>
  </article>;
}


function MenuPage({menu,onAdd,favorites,onToggleFavorite,onView,customer,onGoOrders,loading,recentItems,isOnline}){
  const [query,setQuery]=useState('');
  const [activeCategory,setActiveCategory]=useState('all');

  const allItems=useMemo(()=>menu.flatMap(c=>(c.items||[]).map(i=>({...i,category_id:c.id,category_name:c.name_es}))),[menu]);
  const popular=useMemo(()=>allItems.slice(0,6),[allItems]);
  const normalized=query.trim().toLowerCase();

  const visibleItems=useMemo(()=>allItems.filter(item=>{
    const categoryOk=activeCategory==='all' || item.category_id===activeCategory;
    const searchOk=!normalized || `${item.name_es||''} ${item.description_es||''}`.toLowerCase().includes(normalized);
    return categoryOk&&searchOk;
  }),[allItems,activeCategory,normalized]);

  return <main className="page home-page">
    <section className="home-hero">
      <div className="hero-copy">
        <span className="hero-badge">Entrega rápida en Salamanca</span>
        <h1>Tu kebab favorito, recién preparado</h1>
        <p>Haz tu pedido en pocos pasos y sigue al repartidor en tiempo real.</p>
        <div className="hero-trust">
          <span>✓ Preparado al momento</span>
          <span>✓ Pago seguro</span>
          <span>✓ Seguimiento en vivo</span>
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-food-orbit">🌯</div>
        <span className="hero-price-bubble">Desde 5,95 €</span>
      </div>
    </section>

    {customer&&<section className="welcome-strip">
      <div>
        <small>Hola, {customer.name||'cliente'} 👋</small>
        <b>¿Repetimos tu pedido favorito?</b>
      </div>
      <button onClick={onGoOrders}>Ver pedidos</button>
    </section>}

    <div className="smart-search">
      <span>⌕</span>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar kebab, durum, bebida..."/>
      {query&&<button onClick={()=>setQuery('')}>×</button>}
    </div>

    <section className="category-strip-wrap">
      <div className="category-strip">
        <button className={activeCategory==='all'?'active':''} onClick={()=>setActiveCategory('all')}>
          <span>✨</span><small>Todo</small>
        </button>
        {menu.map(cat=><button key={cat.id} className={activeCategory===cat.id?'active':''} onClick={()=>setActiveCategory(cat.id)}>
          <span>{cat.name_es?.toLowerCase().includes('beb')?'🥤':'🥙'}</span>
          <small>{cat.name_es}</small>
        </button>)}
      </div>
    </section>


    {!isOnline&&<section className="offline-banner">
      <span>📶</span>
      <div><b>Modo sin conexión</b><small>Mostramos el último menú guardado. Algunas acciones pueden no estar disponibles.</small></div>
    </section>}

    {!query&&activeCategory==='all'&&recentItems.length>0&&<section className="content-section">
      <div className="section-heading">
        <div><small>Continúa donde estabas</small><h2>Vistos recientemente</h2></div>
        <span className="section-pill">Recientes</span>
      </div>
      <div className="horizontal-product-strip">
        {recentItems.slice(0,6).map((item,index)=><ProductCard
          key={`recent-${item.id}`}
          item={item}
          index={index}
          onAdd={onAdd}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
          onView={onView}
        />)}
      </div>
    </section>}

    {!query&&activeCategory==='all'&&popular.length>0&&<section className="content-section">
      <div className="section-heading">
        <div><small>Lo más pedido</small><h2>Favoritos de nuestros clientes</h2></div>
        <span className="section-pill">Popular</span>
      </div>
      <div className="product-grid">
        {popular.map((item,index)=><ProductCard
          key={`popular-${item.id}`}
          item={item}
          index={index}
          onAdd={onAdd}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
          onView={onView}
        />)}
      </div>
    </section>}

    <section className="content-section">
      <div className="section-heading">
        <div>
          <small>{activeCategory==='all'?'Nuestro menú':'Categoría seleccionada'}</small>
          <h2>{activeCategory==='all'?'Todos los productos':menu.find(c=>c.id===activeCategory)?.name_es}</h2>
        </div>
        <span className="section-count">{visibleItems.length}</span>
      </div>

      {loading?<div className="skeleton-grid">{[1,2,3,4].map(x=><div className="skeleton-card" key={x}><div></div><span></span><span></span></div>)}</div>:null}

      {!loading&&visibleItems.length===0?<div className="empty-state pro-empty">
        <span>🔎</span><h3>No encontramos resultados</h3><p>Prueba con otro nombre o categoría.</p>
      </div>:null}

      {!loading&&<div className="product-grid">
        {visibleItems.map((item,index)=><ProductCard
          key={item.id}
          item={item}
          index={index}
          onAdd={onAdd}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={onToggleFavorite}
          onView={onView}
        />)}
      </div>}
    </section>
  </main>;
}

function CartPage({cart,setCart,onCheckout,suggestions,onAdd}){
  const subtotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
  const change=(id,d)=>setCart(c=>c.map(x=>x.id===id?{...x,qty:Math.max(0,x.qty+d)}:x).filter(x=>x.qty>0));
  return <main className="page cart-page-pro">
    <div className="page-title-pro">
      <div><small>Tu selección</small><h1>Cesta</h1></div>
      {cart.length?<span>{cart.reduce((s,x)=>s+x.qty,0)} productos</span>:null}
    </div>
    {!cart.length&&<div className="empty-state pro-empty"><span>🛒</span><h3>Tu cesta está vacía</h3><p>Añade algo delicioso del menú.</p></div>}
    <div className="cart-list-pro">
      {cart.map(x=><div className="cart-line pro-cart-line" key={x.id}>
        <div className="cart-thumb">{x.image_url?<img src={x.image_url} alt={x.name_es}/>:<span>🥙</span>}</div>
        <div className="cart-main"><b>{x.name_es}</b><small>{money(x.price)} cada uno</small></div>
        <div className="qty"><button onClick={()=>change(x.id,-1)}>−</button><span>{x.qty}</span><button onClick={()=>change(x.id,1)}>+</button></div>
      </div>)}
    </div>

    {cart.length&&suggestions?.length>0?<section className="cart-suggestions">
      <div className="section-heading compact">
        <div><small>Puede gustarte</small><h2>Completa tu pedido</h2></div>
      </div>
      <div className="cart-suggestion-list">
        {suggestions.slice(0,4).map(item=><article key={item.id}>
          <div className="cart-suggestion-image">
            {item.image_url?<img src={item.image_url} alt={item.name_es}/>:<span>🥤</span>}
          </div>
          <div><b>{item.name_es}</b><small>{money(item.price)}</small></div>
          <button onClick={()=>onAdd(item)}>+</button>
        </article>)}
      </div>
    </section>:null}

    {cart.length?<section className="cart-summary-card">
      <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
      <div><span>Entrega</span><small>Se calcula al finalizar</small></div>
      <div className="cart-total"><span>Total provisional</span><b>{money(subtotal)}</b></div>
      <button className="primary wide checkout-main-button" onClick={onCheckout}>Continuar pedido <span>→</span></button>
    </section>:null}
  </main>;
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


function CheckoutPage({cart,customer,onSuccess,setToast,onBack,savedAddresses,onAddressUsed}){
  const [form,setForm]=useState({
    name:customer?.name||'', address:savedAddresses?.[0]||customer?.default_address||'', floor:'', note:'',
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
      if(form.delivery_type==='delivery'&&form.address.trim()){
        onAddressUsed?.(form.address.trim());
      }
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

    {form.delivery_type==='delivery'&&savedAddresses?.length>0&&
      <section className="saved-addresses-checkout">
        <div className="saved-addresses-title">
          <span>Direcciones rápidas</span>
          <small>Toca para usar</small>
        </div>
        <div className="saved-address-chips">
          {savedAddresses.slice(0,4).map((address,index)=>
            <button
              type="button"
              key={`${address}-${index}`}
              className={form.address===address?'active':''}
              onClick={()=>{
                setForm(current=>({...current,address}));
                setSelectedPoint(null);
                setAddressResults([]);
                setAddressTouched(false);
              }}
            >
              <span>📍</span>
              <small>{address}</small>
            </button>
          )}
        </div>
      </section>
    }

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

function OrdersPage({customer,setToast,onReorder,onOrderStatusUpdate,focusOrderCode}){
  const [orders,setOrders]=useState([]);
  const [selected,setSelected]=useState(null);
  const [loading,setLoading]=useState(false);

  async function load(){
    if(!customer) return;
    setLoading(true);
    try{
      const r=await axios.get(`${API_BASE}/customers/orders/`,{params:{phone:customer.phone}});
      const rows=Array.isArray(r.data)?r.data:(r.data.orders||[]);
      const previous=getOrderStatusCache();
      const nextCache={...previous};

      rows.forEach(order=>{
        const oldStatus=previous[order.order_code];
        if(oldStatus&&oldStatus!==order.status){
          onOrderStatusUpdate?.(order,oldStatus);
        }
        nextCache[order.order_code]=order.status;
      });
      saveOrderStatusCache(nextCache);

      setOrders(rows);
      setSelected(current=>{
        if(focusOrderCode){
          return rows.find(row=>row.order_code===focusOrderCode)||current||rows[0]||null;
        }
        if(current){
          return rows.find(row=>row.order_code===current.order_code)||rows[0]||null;
        }
        return rows[0]||null;
      });
    }catch(e){
      setToast('No se pudieron cargar los pedidos.');
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    load();
    const id=setInterval(load,5000);
    return()=>clearInterval(id);
  },[customer?.phone]);

  const order=selected;
  const idx=order?statusSteps.findIndex(x=>x[0]===order.status):-1;
  const activeOrders=orders.filter(o=>!['delivered','cancelled'].includes(o.status));
  const previousOrders=orders.filter(o=>['delivered','cancelled'].includes(o.status));

  return <main className="page orders-page-pro">
    <div className="page-title-pro orders-title">
      <div><small>Seguimiento e historial</small><h1>Mis pedidos</h1></div>
      <button className="ghost refresh-orders" onClick={load}>{loading?'...':'↻ Actualizar'}</button>
    </div>

    {loading&&!orders.length&&<div className="orders-skeleton">
      {[1,2,3].map(x=><div key={x}></div>)}
    </div>}

    {!orders.length&&!loading&&<div className="empty-state pro-empty">
      <span>🧾</span><h3>Aún no tienes pedidos</h3><p>Cuando hagas tu primer pedido aparecerá aquí.</p>
    </div>}

    {activeOrders.length>0&&<section className="active-order-banner">
      <div><span>● Pedido activo</span><b>{activeOrders[0].order_code}</b><small>{activeOrders[0].address||'Recogida en tienda'}</small></div>
      <button onClick={()=>setSelected(activeOrders[0])}>Ver seguimiento</button>
    </section>}

    {orders.length>0&&<div className="order-card-strip">
      {orders.map(o=><button
        key={o.order_code}
        className={`order-history-card ${order?.order_code===o.order_code?'active':''}`}
        onClick={()=>setSelected(o)}
      >
        <div>
          <b>{o.order_code}</b>
          <span>{money(o.total)}</span>
        </div>
        <small>{new Date(o.created_at||Date.now()).toLocaleDateString('es-ES')}</small>
        <em>{(statusSteps.find(x=>x[0]===o.status)||[null,o.status])[1]}</em>
      </button>)}
    </div>}

    {order&&<>
      <section className="tracking-overview-card">
        <div className="tracking-overview-head">
          <div><small>Pedido seleccionado</small><h2>{order.order_code}</h2><p>{order.address||'Recogida en tienda'}</p></div>
          <strong>{money(order.total)}</strong>
        </div>

        {!['delivered','cancelled'].includes(order.status)&&
          <div className="timeline pro-timeline">
            {statusSteps.map(([s,label],i)=><div key={s} className={i<=idx?'done':''}>
              <span>{i<idx?'✓':i+1}</span><small>{label}</small>
            </div>)}
          </div>}

        {!['delivered','cancelled'].includes(order.status)&&<TrackingMap order={order}/>}

        <div className="order-detail-list">
          {(order.items||[]).map((item,index)=><div key={item.id||index}>
            <span>{item.quantity} × {item.name_snapshot||item.name_es||'Producto'}</span>
            <b>{money(item.total||Number(item.price_snapshot||0)*Number(item.quantity||1))}</b>
          </div>)}
        </div>

        <div className="order-actions-pro">
          <button className="primary" onClick={()=>onReorder(order)}>Volver a pedir</button>
          {!['delivered','cancelled'].includes(order.status)&&order.customer_phone&&
            <a className="secondary" href={`tel:${order.customer_phone}`}>Ayuda</a>}
        </div>
      </section>
    </>}

    {previousOrders.length>0&&<section className="previous-orders-summary">
      <small>Pedidos completados</small>
      <b>{previousOrders.length}</b>
      <span>Disponibles para volver a pedir</span>
    </section>}
  </main>;
}


function NotificationCenter({items,onReadAll,onClear,onOpenOrder}){
  return <main className="page notifications-page">
    <div className="page-title-pro notification-page-title">
      <div><small>Actualizaciones de tus pedidos</small><h1>Notificaciones</h1></div>
      <div className="notification-tools">
        <button className="ghost" onClick={onReadAll}>Marcar leídas</button>
        <button className="ghost danger-ghost" onClick={onClear}>Limpiar</button>
      </div>
    </div>

    {!items.length?<div className="empty-state pro-empty">
      <span>🔔</span><h3>No tienes notificaciones</h3>
      <p>Las actualizaciones de tus pedidos aparecerán aquí.</p>
    </div>:null}

    <div className="notification-list">
      {items.map(item=><article key={item.id} className={item.read?'read':'unread'}>
        <button className="notification-main" onClick={()=>onOpenOrder(item)}>
          <div className={`notification-icon status-${item.status||'pending'}`}>{
            item.status==='delivered'?'✓':
            item.status==='out_for_delivery'?'🛵':
            item.status==='preparing'?'🍳':
            item.status==='ready'?'📦':'🔔'
          }</div>
          <div>
            <div className="notification-line">
              <b>{item.title}</b>
              {!item.read?<i></i>:null}
            </div>
            <p>{item.message}</p>
            <small>{new Date(item.created_at).toLocaleString('es-ES')}</small>
          </div>
        </button>
      </article>)}
    </div>
  </main>;
}

function AccountPage({
  customer,onLogout,onGoOrders,menu,favorites,onToggleFavorite,onAdd,
  savedAddresses,onDeleteAddress,onUseAddress
}){
  const allItems=menu.flatMap(category=>category.items||[]);
  const favoriteItems=allItems.filter(item=>favorites.includes(item.id));

  return <main className="page account-page-pro">
    <section className="profile-hero-card">
      <div className="avatar">{(customer?.name||customer?.phone||'C')[0]}</div>
      <div><small>Mi cuenta</small><h1>{customer?.name||'Cliente'}</h1><p>{customer?.phone}</p></div>
    </section>

    <section className="account-grid-pro">
      <button onClick={onGoOrders}><span>🧾</span><b>Mis pedidos</b><small>Historial y seguimiento</small></button>
      <button onClick={()=>document.getElementById('saved-addresses-section')?.scrollIntoView({behavior:'smooth'})}>
        <span>📍</span><b>Direcciones</b><small>{savedAddresses.length?`${savedAddresses.length} guardadas`:'Sin direcciones guardadas'}</small>
      </button>
      <button onClick={()=>document.getElementById('favorites-section')?.scrollIntoView({behavior:'smooth'})}>
        <span>♥</span><b>Favoritos</b><small>{favoriteItems.length?`${favoriteItems.length} productos`:'Todavía vacío'}</small>
      </button>
      <button><span>🎁</span><b>Ofertas</b><small>Promociones disponibles</small></button>
    </section>

    <section className="account-details-card">
      <div><small>Teléfono</small><b>{customer?.phone}</b></div>
      <div><small>Email</small><b>{customer?.email||'Sin email'}</b></div>
      <div><small>Dirección principal</small><b>{customer?.default_address||'Sin dirección guardada'}</b></div>
    </section>

    <section className="account-section-card" id="saved-addresses-section">
      <div className="account-section-title">
        <div><small>Entrega más rápida</small><h2>Direcciones guardadas</h2></div>
        <span>{savedAddresses.length}</span>
      </div>
      {!savedAddresses.length?<p className="account-muted">Las direcciones usadas al pedir aparecerán aquí automáticamente.</p>:null}
      <div className="saved-address-list">
        {savedAddresses.map((address,index)=><article key={`${address}-${index}`}>
          <button className="saved-address-main" onClick={()=>onUseAddress(address)}>
            <span>📍</span><div><b>{index===0?'Dirección reciente':`Dirección ${index+1}`}</b><small>{address}</small></div>
          </button>
          <button className="saved-address-delete" onClick={()=>onDeleteAddress(address)}>×</button>
        </article>)}
      </div>
    </section>

    <section className="account-section-card" id="favorites-section">
      <div className="account-section-title">
        <div><small>Acceso rápido</small><h2>Mis favoritos</h2></div>
        <span>{favoriteItems.length}</span>
      </div>
      {!favoriteItems.length?<p className="account-muted">Pulsa el corazón de un producto para guardarlo aquí.</p>:null}
      <div className="favorite-account-list">
        {favoriteItems.map(item=><article key={item.id}>
          <div className="favorite-account-image">
            {item.image_url?<img src={item.image_url} alt={item.name_es}/>:<span>🥙</span>}
          </div>
          <div><b>{item.name_es}</b><small>{money(item.price)}</small></div>
          <button onClick={()=>onAdd(item)}>+</button>
          <button className="remove-favorite" onClick={()=>onToggleFavorite(item.id)}>♥</button>
        </article>)}
      </div>
    </section>

    <button className="danger wide logout-pro" onClick={onLogout}>Cerrar sesión</button>
  </main>;
}

function BottomNav({tab,setTab,cartCount,notificationCount}){
  const items=[
    ['menu','⌂','Inicio'],
    ['cart','🛒','Cesta'],
    ['orders','📍','Pedidos'],
    ['notifications','🔔','Avisos'],
    ['account','👤','Cuenta']
  ];
  return <nav className="bottom-nav pro-bottom-nav five-items">{items.map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>
    <span>{icon}</span><small>{label}</small>
    {id==='cart'&&cartCount>0?<b>{cartCount}</b>:null}
    {id==='notifications'&&notificationCount>0?<b>{notificationCount}</b>:null}
  </button>)}</nav>;
}

function App(){
  const [tab,setTab]=useState('menu');
  const [menu,setMenu]=useState(fallbackMenu);
  const [cart,setCart]=useState(getSavedCart());
  const [favorites,setFavorites]=useState(getFavorites());
  const [customer,setCustomer]=useState(getCustomer());
  const [otp,setOtp]=useState(false);
  const [checkout,setCheckout]=useState(false);
  const [receipt,setReceipt]=useState(null);
  const [toast,setToast]=useState('');
  const [menuLoading,setMenuLoading]=useState(true);
  const [cartPulse,setCartPulse]=useState(false);
  const [savedAddresses,setSavedAddresses]=useState(()=>{
    const local=getSavedAddresses();
    const initial=customer?.default_address?.trim();
    return initial&&!local.includes(initial)?[initial,...local]:local;
  });
  const [preferredAddress,setPreferredAddress]=useState('');
  const [recentItems,setRecentItems]=useState(getRecentItems());
  const [isOnline,setIsOnline]=useState(navigator.onLine);
  const [notifications,setNotifications]=useState(getNotifications());
  const [focusOrderCode,setFocusOrderCode]=useState('');
  const [pushReady,setPushReady]=useState(false);

  useEffect(()=>{
    const cached=getCachedMenu();
    if(Array.isArray(cached)&&cached.length)setMenu(cached);

    axios.get(`${API_BASE}/menu/`)
      .then(r=>{
        if(Array.isArray(r.data)&&r.data.length){
          setMenu(r.data);
          saveCachedMenu(r.data);
        }
      })
      .catch(()=>{})
      .finally(()=>setMenuLoading(false));
  },[]);

  useEffect(()=>{
    const online=()=>setIsOnline(true);
    const offline=()=>setIsOnline(false);
    window.addEventListener('online',online);
    window.addEventListener('offline',offline);
    return()=>{
      window.removeEventListener('online',online);
      window.removeEventListener('offline',offline);
    };
  },[]);

  useEffect(()=>{saveCart(cart)},[cart]);
  useEffect(()=>{saveFavorites(favorites)},[favorites]);
  useEffect(()=>{saveSavedAddresses(savedAddresses)},[savedAddresses]);
  useEffect(()=>{saveRecentItems(recentItems)},[recentItems]);
  useEffect(()=>{saveNotifications(notifications)},[notifications]);
  useEffect(()=>{
    if(customer) requestLocalNotificationPermission();
  },[customer?.phone]);

  useEffect(()=>{
    if(!customer||!Capacitor.isNativePlatform()) return;

    let disposed=false;
    const removers=[];

    async function setupPush(){
      try{
        const current=await PushNotifications.checkPermissions();
        let permission=current.receive;
        if(permission!=='granted'){
          const requested=await PushNotifications.requestPermissions();
          permission=requested.receive;
        }
        if(permission!=='granted') return;

        const registrationListener=await PushNotifications.addListener('registration',async token=>{
          if(disposed) return;
          await registerPushTokenWithBackend(customer,token.value);
          setPushReady(true);
        });
        removers.push(registrationListener);

        const errorListener=await PushNotifications.addListener('registrationError',error=>{
          console.warn('Firebase registration error',error);
          setPushReady(false);
        });
        removers.push(errorListener);

        const receiveListener=await PushNotifications.addListener('pushNotificationReceived',notification=>{
          const data=notification?.data||{};
          const item={
            id:`fcm-${data.order_code||Date.now()}-${Date.now()}`,
            order_code:data.order_code||'',
            status:data.status||'pending',
            title:notification.title||'Casa de Kebab Turco',
            message:notification.body||'Tienes una nueva actualización.',
            created_at:new Date().toISOString(),
            read:false
          };
          setNotifications(current=>[item,...current.filter(row=>row.id!==item.id)].slice(0,50));
          setToast(item.message);
        });
        removers.push(receiveListener);

        const actionListener=await PushNotifications.addListener('pushNotificationActionPerformed',action=>{
          const data=action?.notification?.data||{};
          const orderCode=data.order_code||'';
          if(orderCode){
            setFocusOrderCode(orderCode);
            setTab('orders');
          }else{
            setTab('notifications');
          }
        });
        removers.push(actionListener);

        await PushNotifications.register();
      }catch(error){
        console.warn('Push setup failed',error);
        setPushReady(false);
      }
    }

    setupPush();

    return()=>{
      disposed=true;
      removers.forEach(listener=>{
        try{ listener.remove(); }catch{}
      });
    };
  },[customer?.phone]);




  async function handleOrderStatusUpdate(order,oldStatus){
    const item={
      id:`${order.order_code}-${order.status}-${Date.now()}`,
      order_code:order.order_code,
      status:order.status,
      title:`${order.order_code} · ${statusLabel(order.status)}`,
      message:notificationText(order),
      created_at:new Date().toISOString(),
      read:false
    };
    setNotifications(current=>[item,...current].slice(0,50));
    await showLocalOrderNotification(order);
    setToast(notificationText(order));
  }

  function markAllNotificationsRead(){
    setNotifications(current=>current.map(item=>({...item,read:true})));
  }

  function clearNotifications(){
    setNotifications([]);
  }

  function openNotification(item){
    setNotifications(current=>current.map(row=>row.id===item.id?{...row,read:true}:row));
    setFocusOrderCode(item.order_code||'');
    setTab('orders');
  }

  function rememberViewedItem(item){
    if(!item?.id) return;
    setRecentItems(current=>[
      item,
      ...current.filter(row=>row.id!==item.id),
    ].slice(0,10));
  }

  const smartSuggestions=useMemo(()=>{
    const allItems=menu.flatMap(category=>category.items||[]);
    const cartIds=new Set(cart.map(item=>item.id));
    const beverageKeywords=['bebida','cola','fanta','agua','sprite','refresco'];
    const sideKeywords=['patata','salsa','postre'];

    const ranked=allItems
      .filter(item=>!cartIds.has(item.id))
      .map(item=>{
        const text=`${item.name_es||''} ${item.description_es||''}`.toLowerCase();
        let score=0;
        if(beverageKeywords.some(k=>text.includes(k))) score+=3;
        if(sideKeywords.some(k=>text.includes(k))) score+=2;
        if(favorites.includes(item.id)) score+=2;
        if(recentItems.some(row=>row.id===item.id)) score+=1;
        return {...item,_score:score};
      })
      .sort((a,b)=>b._score-a._score || Number(a.price)-Number(b.price));

    return ranked.slice(0,6);
  },[menu,cart,favorites,recentItems]);

  function rememberAddress(address){
    const clean=String(address||'').trim();
    if(!clean) return;
    setSavedAddresses(current=>[clean,...current.filter(item=>item!==clean)].slice(0,6));
  }

  function deleteSavedAddress(address){
    setSavedAddresses(current=>current.filter(item=>item!==address));
  }

  function useSavedAddress(address){
    setPreferredAddress(address);
    setTab('cart');
    setToast('Dirección preparada para tu próximo pedido.');
  }

  function reorder(order){
    const allItems=menu.flatMap(category=>category.items||[]);
    const rebuilt=(order.items||[]).map(orderItem=>{
      const menuItemId=Number(
        orderItem.menu_item_id ??
        orderItem.menu_item ??
        orderItem.menu_item_data?.id ??
        0
      );
      const match=allItems.find(item=>Number(item.id)===menuItemId) ||
        allItems.find(item=>(item.name_es||'').trim().toLowerCase()===(orderItem.name_snapshot||'').trim().toLowerCase());

      if(!match) return null;
      return {...match,qty:Number(orderItem.quantity||1)};
    }).filter(Boolean);

    if(!rebuilt.length){
      setToast('Los productos de este pedido ya no están disponibles en el menú.');
      return;
    }

    setCart(rebuilt);
    if(order.address) rememberAddress(order.address);
    setTab('cart');
    setToast('Pedido anterior añadido a la cesta.');
  }

  function toggleFavorite(id){
    setFavorites(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  }

  function add(item){
    setCart(current=>{
      const existing=current.find(x=>x.id===item.id);
      return existing
        ? current.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x)
        : [...current,{...item,qty:1}];
    });
    setCartPulse(true);
    setTimeout(()=>setCartPulse(false),500);
    setToast(`${item.name_es} añadido a la cesta.`);
  }

  function beginCheckout(){if(!customer)return setOtp(true);setCheckout(true);}
  function verified(c){setCustomer(c);setOtp(false);setCheckout(true);}
  function success(order){setReceipt(order);setCheckout(false);setCart([]);}
  async function logout(){
    await unregisterPushTokenFromBackend(customer);
    clearCustomer();setCustomer(null);setTab('menu');
  }
  const count=cart.reduce((s,x)=>s+x.qty,0);
  const cartTotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);

  let body=<MenuPage
    menu={menu}
    onAdd={add}
    favorites={favorites}
    onToggleFavorite={toggleFavorite}
    onView={rememberViewedItem}
    customer={customer}
    onGoOrders={()=>setTab('orders')}
    loading={menuLoading}
    recentItems={recentItems}
    isOnline={isOnline}
  />;
  if(tab==='cart') body=<CartPage
    cart={cart}
    setCart={setCart}
    onCheckout={beginCheckout}
    suggestions={smartSuggestions}
    onAdd={add}
  />;
  if(tab==='orders') body=customer?<OrdersPage
    customer={customer}
    setToast={setToast}
    onReorder={reorder}
    onOrderStatusUpdate={handleOrderStatusUpdate}
    focusOrderCode={focusOrderCode}
  />:<main className="page"><div className="empty-state pro-empty"><span>🔐</span><h3>Inicia sesión</h3><p>Necesitamos verificar tu teléfono para mostrar tus pedidos.</p></div><button className="primary wide" onClick={()=>setOtp(true)}>Entrar por SMS</button></main>;
  if(tab==='notifications') body=<NotificationCenter
    items={notifications}
    onReadAll={markAllNotificationsRead}
    onClear={clearNotifications}
    onOpenOrder={openNotification}
  />;
  if(tab==='account') body=customer?<AccountPage
    customer={customer}
    onLogout={logout}
    onGoOrders={()=>setTab('orders')}
    menu={menu}
    favorites={favorites}
    onToggleFavorite={toggleFavorite}
    onAdd={add}
    savedAddresses={savedAddresses}
    onDeleteAddress={deleteSavedAddress}
    onUseAddress={useSavedAddress}
  />:<main className="page"><div className="empty-state pro-empty"><span>👤</span><h3>Tu cuenta está lista</h3><p>Entra por SMS para guardar pedidos y direcciones.</p></div><button className="primary wide" onClick={()=>setOtp(true)}>Entrar por SMS</button></main>;
  if(checkout) body=<CheckoutPage
    cart={cart}
    customer={customer}
    onSuccess={success}
    setToast={setToast}
    onBack={()=>setCheckout(false)}
    savedAddresses={preferredAddress?[preferredAddress,...savedAddresses.filter(x=>x!==preferredAddress)]:savedAddresses}
    onAddressUsed={rememberAddress}
  />;
  if(receipt) body=<ReceiptPage order={receipt} onTrack={()=>{setReceipt(null);setTab('orders')}} onHome={()=>{setReceipt(null);setTab('menu')}}/>;

  return <div className="app-shell pro-app-shell">
    <Header customer={customer} onLogout={logout} onAccount={()=>setTab('account')} isOnline={isOnline} pushReady={pushReady}/>
    {body}
    {!checkout&&!receipt&&tab==='menu'&&count>0?<button className={`floating-cart-bar ${cartPulse?'pulse':''}`} onClick={()=>setTab('cart')}>
      <span className="floating-cart-count">{count}</span>
      <b>Ver cesta</b>
      <strong>{money(cartTotal)}</strong>
    </button>:null}
    {!checkout&&!receipt&&<BottomNav
      tab={tab}
      setTab={setTab}
      cartCount={count}
      notificationCount={notifications.filter(item=>!item.read).length}
    />}
    {otp&&<OtpModal phone={customer?.phone} onVerified={verified} onClose={()=>setOtp(false)} setToast={setToast}/>}
    <Toast message={toast} onClose={()=>setToast('')}/>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
