import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './styles.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import restaurantLogo from './assets/logo.png';
import foodHeroOne from './assets/foods/food-hero-1.jpg';
import foodHeroTwo from './assets/foods/food-hero-2.png';
import foodHeroThree from './assets/foods/food-hero-3.png';
import foodHeroFour from './assets/foods/food-hero-4.png';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/restaurant';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
let googleMapsScriptPromise = null;
const RESTAURANT_ADDRESS = 'Calle García Lorca, 1. Salamanca 37004';
const RESTAURANT_PHONE_1 = '923058275';
const RESTAURANT_PHONE_2 = '617664656';
const RESTAURANT_OPENING_HOURS = 'Todos los días: 12:00 - 01:00';
const RESTAURANT_COORD = { lat: 40.974836942683254, lng: -5.649336331469509 };
const DEFAULT_DELIVERY_RADIUS_KM = 6;
const DELIVERY_BASE_FEE = 1.50;
const DELIVERY_INCLUDED_KM = 2;
const DELIVERY_PRICE_PER_EXTRA_KM = 0.70;
const SALAMANCA_VIEWBOX = '-5.75,41.04,-5.55,40.90';

const ADMIN_TOKEN_KEY = 'cdkt_admin_token';
const ADMIN_USER_KEY = 'cdkt_admin_user';

function getAttachmentLabel(url = '') {
  const cleanUrl = String(url).split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.pdf')) return 'Ver PDF';
  if (/\.(jpg|jpeg|png|webp|gif|bmp|tif|tiff)$/.test(cleanUrl)) {
    return 'Ver imagen';
  }
  return 'Descargar archivo';
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function getAdminUser() {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function setAdminSession(token, user) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (user) localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  localStorage.setItem('cdkt_role', 'admin');
  window.dispatchEvent(new Event('cdkt-admin-auth-change'));
  window.dispatchEvent(new Event('cdkt-role-change'));
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
  if (localStorage.getItem('cdkt_role') === 'admin') localStorage.setItem('cdkt_role', 'customer');
  window.dispatchEvent(new Event('cdkt-admin-auth-change'));
  window.dispatchEvent(new Event('cdkt-role-change'));
}

function adminAuthHeaders() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isAdminRoute(path = window.location.pathname) {
  return path.includes('dashboard') || path.includes('menu-admin') || path.includes('settings-admin');
}

axios.interceptors.request.use(config => {
  const url = String(config.url || '');
  if (url.startsWith(API_BASE) && getAdminToken()) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${getAdminToken()}`;
  }
  return config;
});

axios.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401 && isAdminRoute()) {
      clearAdminSession();
      if (!window.location.pathname.includes('admin-login')) {
        window.location.href = '/admin-login';
      }
    }
    return Promise.reject(error);
  }
);

function getPageTitle() {
  const path = window.location.pathname;
  if (path.includes('orders-live')) return 'Pedidos en vivo | Casa de Kebab Turco';
  if (path.includes('admin-login')) return 'Acceso Admin | Casa de Kebab Turco';
  if (path.includes('dashboard')) return 'Dashboard de ventas | Casa de Kebab Turco';
  if (path.includes('menu-admin')) return 'Menú Admin | Casa de Kebab Turco';
  if (path.includes('settings-admin')) return 'Ajustes del restaurante | Casa de Kebab Turco';
  if (path.includes('account')) return 'Mi cuenta | Casa de Kebab Turco';
  if (path.includes('rider')) return 'Panel del repartidor | Casa de Kebab Turco';
  if (path.includes('payment-demo')) return 'Pago online | Casa de Kebab Turco';
  if (path.includes('receipt')) return 'Ticket del pedido | Casa de Kebab Turco';
  if (path.includes('track')) return 'Seguimiento de pedido | Casa de Kebab Turco';
  return 'Casa de Kebab Turco | Pedido online en Salamanca';
}

function usePageChrome() {
  useEffect(() => {
    document.title = getPageTitle();
    const splash = document.getElementById('app-splash');
    const timer = setTimeout(() => splash?.classList.add('hide'), 250);
    return () => clearTimeout(timer);
  }, []);
}

function loadGoogleMapsPlaces() {
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-places-script="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&language=es&region=ES&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      script.dataset.googlePlacesScript = 'true';
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Google Maps script load failed'));
      document.head.appendChild(script);
    });
  }
  return googleMapsScriptPromise;
}

const fallbackMenu = [
  { id: 1, name_es: 'OFERTA COMBO', slug: 'oferta-combo', items: [
    { id: 101, name_es: 'Combo 1', description_es: '2 kebabs, 4 alitas o 2 muslos, patatas y 2 bebidas.', price: '11.95', image_url: '', option_groups: [] },
    { id: 102, name_es: 'Combo 2', description_es: '2 durum, 4 alitas o 2 muslos, patatas y 2 bebidas.', price: '12.95', image_url: '', option_groups: [] },
  ]},
  { id: 2, name_es: 'DURUM', slug: 'durum', items: [
    { id: 201, name_es: 'Durum Mixto', description_es: 'Durum con carne mixta, ensalada y salsa.', price: '5.95', image_url: '', option_groups: [] },
  ]},
  { id: 3, name_es: 'COMIDA HINDÚ', slug: 'comida-hindu', items: [
    { id: 301, name_es: 'Pollo Tikka Masala', description_es: 'Pollo cocinado con nata, almendras y yogur.', price: '9.95', image_url: '', option_groups: [] },
  ]},
];

function money(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(-9);
}

function optionExtraSum(options) {
  return (options || []).reduce((sum, opt) => sum + Number(opt.extra_price || 0), 0);
}

function makeCartKey(item, selectedOptions = []) {
  const optionPart = selectedOptions.map(o => o.id).sort((a, b) => a - b).join('-');
  return `${item.id}:${optionPart}`;
}

function getMapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getRestaurantDirectionsUrl() {
  return `https://www.google.com/maps/dir/?api=1&destination=${RESTAURANT_COORD.lat},${RESTAURANT_COORD.lng}&destination_place_id=Casa%20de%20Kebab%20Turco`;
}

function getItemImage(item) {
  if (item?.image_url) return item.image_url;
  const hay = `${item?.name_es || ''} ${item?.description_es || ''}`.toLowerCase();
  if (hay.includes('durum') || hay.includes('wrap')) return foodHeroTwo;
  if (hay.includes('kebab') || hay.includes('doner') || hay.includes('pollo') || hay.includes('ternera') || hay.includes('mixto')) return foodHeroThree;
  if (hay.includes('lahmacun') || hay.includes('plato') || hay.includes('hamburguesa') || hay.includes('pan')) return foodHeroFour;
  if (hay.includes('combo') || hay.includes('bebida')) return foodHeroOne;
  return foodHeroOne;
}



function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatKm(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return `${Number(value).toFixed(2).replace('.', ',')} km`;
}

function formatMinutes(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  const minutes = Math.max(1, Math.round(Number(value)));
  return `${minutes} min`;
}

function calculateDynamicDeliveryFee(distanceKm, subtotal, settings) {
  const freeMin = Number(settings?.free_delivery_minimum ?? 25);
  if (subtotal >= freeMin) return 0;
  const baseFee = Number(settings?.delivery_fee ?? DELIVERY_BASE_FEE);
  if (!distanceKm || Number.isNaN(Number(distanceKm))) return baseFee;
  const extraKm = Math.max(0, Number(distanceKm) - DELIVERY_INCLUDED_KM);
  const fee = baseFee + extraKm * DELIVERY_PRICE_PER_EXTRA_KM;
  return Math.max(baseFee, Math.round(fee * 100) / 100);
}

function cleanAddressPart(value) {
  return String(value || '')
    .replace(/[\u0600-\u06FF]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .trim();
}

function formatAddressTitle(result) {
  const a = result?.address || {};
  const road = cleanAddressPart(a.road || a.pedestrian || a.footway || a.cycleway || a.path || a.neighbourhood || a.suburb || result?.name);
  const house = cleanAddressPart(a.house_number);
  if (road && house) return `${road}, ${house}`;
  if (road) return road;
  return cleanAddressPart((result?.display_name || '').split(',')[0]) || 'Dirección';
}

function formatAddressSubtitle(result) {
  const a = result?.address || {};
  const parts = [
    a.postcode,
    a.city || a.town || a.village || 'Salamanca',
    a.state || 'Castilla y León',
    'España'
  ].map(cleanAddressPart).filter(Boolean);
  return [...new Set(parts)].join(', ');
}

function formatAddressFull(result) {
  const title = formatAddressTitle(result);
  const subtitle = formatAddressSubtitle(result);
  return subtitle ? `${title}, ${subtitle}` : title;
}

async function fetchSalamancaAddressResults(query, limit = 8) {
  const q = String(query || '').trim();
  if (q.length < 1) return [];
  const common = `format=json&limit=${limit}&countrycodes=es&addressdetails=1&dedupe=1&viewbox=${SALAMANCA_VIEWBOX}&bounded=1&accept-language=es`;
  const urls = [
    `https://nominatim.openstreetmap.org/search?${common}&street=${encodeURIComponent(q)}&city=${encodeURIComponent('Salamanca')}&country=${encodeURIComponent('España')}`,
    `https://nominatim.openstreetmap.org/search?${common}&q=${encodeURIComponent(`${q}, Salamanca, Castilla y León, España`)}`,
    `https://nominatim.openstreetmap.org/search?${common}&q=${encodeURIComponent(`${q}, Salamanca`)}`,
  ];
  const responses = await Promise.allSettled(urls.map(url => fetch(url, { headers: { 'Accept-Language': 'es' } }).then(r => r.json())));
  const merged = [];
  const seen = new Set();
  responses.forEach(result => {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) return;
    result.value.forEach(item => {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const insideSalamancaBox = lat >= 40.90 && lat <= 41.04 && lon >= -5.75 && lon <= -5.55;
      if (!insideSalamancaBox) return;
      const title = formatAddressTitle(item).toLowerCase();
      const subtitle = formatAddressSubtitle(item).toLowerCase();
      const key = `${title}-${subtitle}-${lat.toFixed(6)}-${lon.toFixed(6)}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
  });
  return merged.slice(0, limit);
}


async function reverseGeocodePoint(point) {
  if (!point) return '';
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(point.lat)}&lon=${encodeURIComponent(point.lng)}&addressdetails=1&accept-language=es`;
    const data = await fetch(url, { headers: { 'Accept-Language': 'es' } }).then(r => r.json());
    if (!data) return 'Punto seleccionado en el mapa';
    return formatAddressFull(data) || cleanAddressPart(data.display_name) || 'Punto seleccionado en el mapa';
  } catch (err) {
    return 'Punto seleccionado en el mapa';
  }
}

async function fetchDrivingRoute(point) {
  if (!point) return null;
  const url = `https://router.project-osrm.org/route/v1/driving/${RESTAURANT_COORD.lng},${RESTAURANT_COORD.lat};${point.lng},${point.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('route failed');
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error('route not found');
  const coords = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    coords,
    provider: 'OSRM demo'
  };
}

const ROLE_LABELS = {
  guest: 'Invitado',
  customer: 'Cliente',
  rider: 'Repartidor',
  staff: 'Empleado',
  admin: 'Admin'
};

const ROLE_ACCESS = {
  '/': ['guest', 'customer', 'rider', 'staff', 'admin'],
  '/account': ['customer', 'staff', 'admin'],
  '/rider': ['rider', 'staff', 'admin'],
  '/orders-live': ['staff', 'admin'],
  '/admin-login': ['guest', 'customer', 'rider', 'staff', 'admin'],
  '/dashboard': ['admin'],
  '/menu-admin': ['admin'],
  '/settings-admin': ['admin'],
  '/payment-demo': ['guest', 'customer', 'staff', 'admin'],
  '/receipt': ['guest', 'customer', 'rider', 'staff', 'admin'],
  '/track': ['guest', 'customer', 'rider', 'staff', 'admin']
};

function getCurrentRole() {
  if (getAdminToken()) return 'admin';
  return localStorage.getItem('cdkt_role') || 'customer';
}

function setCurrentRole(role) {
  localStorage.setItem('cdkt_role', role);
  window.dispatchEvent(new Event('cdkt-role-change'));
}

function getSessionCustomer() {
  try {
    const raw = localStorage.getItem('cdkt_customer');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function setSessionCustomer(customer) {
  if (customer) {
    localStorage.setItem('cdkt_customer', JSON.stringify(customer));
    localStorage.setItem('cdkt_customer_phone', customer.phone || '');
  }
  window.dispatchEvent(new Event('cdkt-auth-change'));
}

function clearSessionCustomer() {
  localStorage.removeItem('cdkt_customer');
  localStorage.removeItem('cdkt_customer_phone');
  window.dispatchEvent(new Event('cdkt-auth-change'));
}

function rolesToArray(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  return String(value).split(',').map(x => x.trim()).filter(Boolean);
}

function canRoleSee(role, roles) {
  const allowed = rolesToArray(roles);
  if (!allowed) return true;
  return allowed.includes(role);
}

function canAccessPath(role, path = window.location.pathname) {
  const entry = Object.entries(ROLE_ACCESS).find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
  if (!entry) return true;
  return entry[1].includes(role);
}

function RoleSwitcher({ role, setRole }) {
  return <select className="role-switcher" value={role} onChange={e => { setRole(e.target.value); setCurrentRole(e.target.value); }} title="Cambiar perfil de prueba">
    <option value="customer">Cliente</option>
    <option value="rider">Repartidor</option>
    <option value="staff">Empleado</option>
    <option value="admin">Admin</option>
  </select>;
}

function Header({ title = 'Casa de Kebab Turco', subtitle = RESTAURANT_ADDRESS, children }) {
  const [role, setRole] = useState(getCurrentRole());
  const [sessionCustomer, setSessionCustomerState] = useState(getSessionCustomer());
  const [adminUser, setAdminUserState] = useState(getAdminUser());

  useEffect(() => {
    const syncRole = () => setRole(getCurrentRole());
    const syncAuth = () => { setSessionCustomerState(getSessionCustomer()); setAdminUserState(getAdminUser()); };
    window.addEventListener('cdkt-role-change', syncRole);
    window.addEventListener('cdkt-auth-change', syncAuth);
    window.addEventListener('cdkt-admin-auth-change', syncAuth);
    window.addEventListener('storage', syncRole);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('cdkt-role-change', syncRole);
      window.removeEventListener('cdkt-auth-change', syncAuth);
      window.removeEventListener('cdkt-admin-auth-change', syncAuth);
      window.removeEventListener('storage', syncRole);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  function logout() {
    clearSessionCustomer();
    if (window.location.pathname.includes('account')) window.location.href = '/';
  }

  function adminLogout() {
    clearAdminSession();
    window.location.href = '/admin-login';
  }

  const visibleChildren = React.Children.toArray(children).filter(child => {
    if (!React.isValidElement(child)) return true;
    if (child.props.dataAuthAction === 'login' && sessionCustomer) return false;
    return canRoleSee(role, child.props.dataRoles);
  });

  return <header className="topbar">
    <div className="brand" onClick={() => window.location.href='/'} role="button" tabIndex="0">
      <img src={restaurantLogo} alt="Casa de Kebab Turco" />
      <div className="brand-text">
        <strong>{title}</strong>
        <span>{subtitle}</span>
        <span className="header-phone-line">Teléfono: {RESTAURANT_PHONE_1} · {RESTAURANT_PHONE_2}</span>
      </div>
    </div>
    <nav>
      {visibleChildren}
      {sessionCustomer && <button className="session-pill" onClick={() => window.location.href='/account'} title="Cuenta activa">{sessionCustomer.phone || 'Mi cuenta'}</button>}
      {sessionCustomer && <button className="logout-button" onClick={logout}>Cerrar sesión</button>}
      {adminUser && <button className="session-pill admin-session-pill" onClick={() => window.location.href='/dashboard'}>Admin: {adminUser.username}</button>}
      {adminUser && <button className="logout-button" onClick={adminLogout}>Salir Admin</button>}
      {role === 'admin' && !adminUser && <RoleSwitcher role={role} setRole={setRole} />}
    </nav>
  </header>;
}


function CustomerSmartAssistant({ menu = [], cart = [], onOpenProduct }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '¡Hola! Soy el asistente de Casa de Kebab Turco. Puedo ayudarte a elegir un plato, ver ofertas, consultar horario, entrega o hablar por WhatsApp.'
    }
  ]);

  const allItems = useMemo(() => {
    const rows = [];
    (menu || []).forEach(category => {
      (category.items || []).forEach(item => rows.push({ ...item, category_name: category.name_es || '' }));
    });
    return rows;
  }, [menu]);

  function buildReply(rawQuestion) {
    const query = String(rawQuestion || '').trim().toLowerCase();
    const itemsBy = words => allItems.filter(item => words.some(word => `${item.name_es || ''} ${item.description_es || ''} ${item.category_name || ''}`.toLowerCase().includes(word))).slice(0, 3);
    const offerItems = allItems.filter(item => `${item.name_es || ''} ${item.category_name || ''}`.toLowerCase().includes('oferta') || `${item.name_es || ''} ${item.category_name || ''}`.toLowerCase().includes('combo')).slice(0, 3);

    if (!query) return { text: 'Escribe una pregunta o usa una de las opciones rápidas.', items: [] };

    if (/(hola|buenas|hello)/.test(query)) {
      return { text: '¡Hola! ¿Buscas algo de pollo, ternera, mixto, una oferta familiar o una recomendación?', items: [] };
    }

    if (/(horario|abre|abierto|cerrado|hora)/.test(query)) {
      return { text: `Nuestro horario es: ${RESTAURANT_OPENING_HOURS}.`, items: [] };
    }

    if (/(direcci|donde|ubicaci|local|recoger)/.test(query)) {
      return { text: `Estamos en ${RESTAURANT_ADDRESS}. Puedes elegir “Recoger” al finalizar el pedido.`, items: [] };
    }

    if (/(whatsapp|tel[eé]fono|llamar|instagram|insta)/.test(query)) {
      return {
        text: 'Puedes escribirnos por WhatsApp al 617 664 656 o visitarnos en Instagram: @casadekebabturco.',
        items: [],
        showWhatsApp: true
      };
    }

    if (/(entrega|domicilio|reparto|env[ií]o)/.test(query)) {
      return { text: 'Hacemos entrega a domicilio en Salamanca. Al escribir tu dirección, el sistema calcula la ruta y confirma si está dentro de la zona de reparto.', items: [] };
    }

    if (/(oferta|combo|familiar|grupo|varias personas)/.test(query)) {
      return {
        text: offerItems.length ? 'Estas opciones pueden ser una buena elección para compartir o ahorrar:' : 'Consulta nuestras ofertas actuales en el menú.',
        items: offerItems
      };
    }

    if (/(pollo|chicken)/.test(query)) {
      const items = itemsBy(['pollo']);
      return { text: items.length ? 'Estas son mis recomendaciones con pollo:' : 'Ahora mismo no encontré opciones de pollo en el menú disponible.', items };
    }

    if (/(ternera|carne|beef)/.test(query)) {
      const items = itemsBy(['ternera']);
      return { text: items.length ? 'Estas son mis recomendaciones con ternera:' : 'Ahora mismo no encontré opciones de ternera en el menú disponible.', items };
    }

    if (/(mixto|mix)/.test(query)) {
      const items = itemsBy(['mixto']);
      return { text: items.length ? 'Estas son mis recomendaciones mixtas:' : 'Ahora mismo no encontré opciones mixtas en el menú disponible.', items };
    }

    if (/(durum|d[uü]r[uü]m|wrap)/.test(query)) {
      const items = itemsBy(['durum', 'dürü', 'wrap']);
      return { text: items.length ? 'Estas opciones tipo dürüm están disponibles:' : 'No encontré dürüm en el menú cargado.', items };
    }

    if (/(picante|pica|spicy)/.test(query)) {
      return { text: 'Puedes pedir que ajustemos las salsas o indicar “picante” en las notas del pedido. Revisa también la descripción de cada plato antes de confirmar.', items: [] };
    }

    if (/(vegetar|vegano|sin carne)/.test(query)) {
      return { text: 'Para alergias, dieta vegetariana o ingredientes específicos, revisa la descripción del producto y escribe tu petición en las notas. Para confirmación inmediata, escríbenos por WhatsApp.', items: [], showWhatsApp: true };
    }

    if (/(recomienda|recomendaci|qu[eé] pido|mejor|popular)/.test(query)) {
      const candidates = offerItems.length ? offerItems : allItems.slice(0, 3);
      return { text: candidates.length ? 'Basándome en el menú disponible, estas opciones son una buena forma de empezar:' : 'El menú se está cargando; vuelve a intentarlo en unos segundos.', items: candidates };
    }

    if (/(carrito|cesta|pedido actual)/.test(query)) {
      const count = (cart || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      if (!count) return { text: 'Tu cesta está vacía. Dime qué tipo de comida prefieres y te recomiendo opciones.', items: [] };
      return { text: `Tu cesta tiene ${count} producto${count === 1 ? '' : 's'}. Puedes abrir un producto recomendado para añadir bebidas, patatas u opciones según estén disponibles.`, items: [] };
    }

    const matches = allItems.filter(item => `${item.name_es || ''} ${item.description_es || ''} ${item.category_name || ''}`.toLowerCase().includes(query)).slice(0, 3);
    if (matches.length) return { text: 'He encontrado estas opciones relacionadas con tu búsqueda:', items: matches };

    return {
      text: 'Puedo ayudarte con platos de pollo, ternera, mixtos, dürüm, ofertas, entrega, horario, dirección o WhatsApp. También puedes escribir el nombre de un plato.',
      items: [],
      showWhatsApp: true
    };
  }

  function ask(value) {
    const clean = String(value || '').trim();
    if (!clean) return;
    const reply = buildReply(clean);
    setMessages(prev => [...prev, { role: 'user', text: clean }, { role: 'assistant', ...reply }]);
    setQuestion('');
  }

  const quickActions = ['¿Qué me recomiendas?', 'Ofertas familiares', 'Horario', 'Entrega a domicilio', 'WhatsApp'];

  return <>
    <button
      type="button"
      className="customer-assistant-fab"
      onClick={() => setOpen(value => !value)}
      aria-label="Abrir asistente de pedidos"
      title="Asistente de pedidos"
    >
      <span>💬</span>
      <b>Ayuda</b>
    </button>

    {open && <aside className="customer-assistant-panel" aria-live="polite">
      <header className="customer-assistant-head">
        <div>
          <span className="customer-assistant-status">● En línea</span>
          <h2>Asistente de pedidos</h2>
          <p>Casa de Kebab Turco</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente">×</button>
      </header>

      <div className="customer-assistant-messages">
        {messages.map((message, index) => <article className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}>
          <p>{message.text}</p>
          {Array.isArray(message.items) && message.items.length > 0 && <div className="assistant-item-list">
            {message.items.map(item => <button key={item.id} type="button" onClick={() => onOpenProduct?.(item)}>
              <span>{item.name_es}</span>
              <b>{money(item.price)}</b>
            </button>)}
          </div>}
          {message.showWhatsApp && <a className="assistant-whatsapp-link" href="https://wa.me/34617664656" target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
        </article>)}
      </div>

      <div className="customer-assistant-quick">
        {quickActions.map(action => <button key={action} type="button" onClick={() => ask(action)}>{action}</button>)}
      </div>

      <form className="customer-assistant-form" onSubmit={event => { event.preventDefault(); ask(question); }}>
        <input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Escribe tu pregunta..." maxLength={180} />
        <button type="submit" aria-label="Enviar pregunta">➤</button>
      </form>

      <small className="customer-assistant-note">Respuestas basadas en el menú y la información actual del restaurante.</small>
    </aside>}
  </>;
}

function App() {
  usePageChrome();
  const [menu, setMenu] = useState(fallbackMenu);
  const [cart, setCart] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOtpOpen, setCheckoutOtpOpen] = useState(false);
  const [checkoutOtpCode, setCheckoutOtpCode] = useState('');
  const [checkoutOtpMessage, setCheckoutOtpMessage] = useState('');
  const [checkoutOtpSending, setCheckoutOtpSending] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('details');
  const [phone, setPhone] = useState(() => getSessionCustomer()?.phone || '');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [customer, setCustomer] = useState(getSessionCustomer());
  const [form, setForm] = useState({ name: '', address: '', floor: '', note: '', delivery_type: 'delivery', payment_method: 'cash', coupon_code: '' });
  const [settings, setSettings] = useState(null);
  const [coupon, setCoupon] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryPoint, setDeliveryPoint] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [watchId, setWatchId] = useState(null);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const initialCategoryOpenedRef = useRef(false);
  const [menuSearchOpen, setMenuSearchOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const isAuthenticatedAdmin = Boolean(getAdminToken() && getAdminUser());
  const isAdminCollection = isAuthenticatedAdmin && form.delivery_type === 'collection';

  useEffect(() => {
    axios.get(`${API_BASE}/menu/`).then(res => {
      if (Array.isArray(res.data) && res.data.length) setMenu(res.data);
    }).catch(() => setMenu(fallbackMenu));
    axios.get(`${API_BASE}/settings/public/`).then(res => setSettings(res.data)).catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    const syncAuth = () => setCustomer(getSessionCustomer());
    window.addEventListener('cdkt-auth-change', syncAuth);
    window.addEventListener('cdkt-admin-auth-change', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('cdkt-auth-change', syncAuth);
      window.removeEventListener('cdkt-admin-auth-change', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  useEffect(() => {
    // فقط در اولین بار بارگذاری صفحه، اولین دسته باز شود.
    // بعد از آن اگر کاربر همه دسته‌ها را بست، سیستم دوباره اولی را باز نمی‌کند.
    if (!initialCategoryOpenedRef.current && menu?.length) {
      setOpenCategoryId(menu[0].id);
      initialCategoryOpenedRef.current = true;
    }
  }, [menu]);

  function openCategory(catId) {
    setOpenCategoryId(catId);
    window.setTimeout(() => {
      document.getElementById(`cat-${catId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  const normalizedMenuSearch = menuSearch.trim().toLowerCase();
  const filteredMenu = useMemo(() => {
    if (!normalizedMenuSearch) return menu;
    return menu.map(cat => {
      const categoryMatch = `${cat.name_es || ''} ${cat.name_en || ''}`.toLowerCase().includes(normalizedMenuSearch);
      const items = categoryMatch
        ? (cat.items || [])
        : (cat.items || []).filter(item => `${item.name_es || ''} ${item.name_en || ''} ${item.description_es || ''} ${item.description_en || ''}`.toLowerCase().includes(normalizedMenuSearch));
      return { ...cat, items };
    }).filter(cat => (cat.items || []).length || `${cat.name_es || ''} ${cat.name_en || ''}`.toLowerCase().includes(normalizedMenuSearch));
  }, [menu, normalizedMenuSearch]);

  const menuSearchResults = useMemo(() => {
    if (!normalizedMenuSearch) return [];
    const rows = [];
    menu.forEach(cat => {
      (cat.items || []).forEach(item => {
        const hay = `${cat.name_es || ''} ${item.name_es || ''} ${item.name_en || ''} ${item.description_es || ''} ${item.description_en || ''}`.toLowerCase();
        if (hay.includes(normalizedMenuSearch)) rows.push({ cat, item });
      });
    });
    return rows.slice(0, 12);
  }, [menu, normalizedMenuSearch]);

  function selectMenuSearchResult(row) {
    setMenuSearchOpen(false);
    setMenuSearch('');
    openCategory(row.cat.id);
    window.setTimeout(() => setActiveItem(row.item), 220);
  }


  useEffect(() => {
    const q = (addressSearch || '').trim();
    if (!checkoutOpen || form.delivery_type !== 'delivery' || q.length < 1) { setAddressResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await fetchSalamancaAddressResults(q, 6);
        if (!cancelled) setAddressResults(results);
      } catch (err) {
        if (!cancelled) setAddressResults([]);
      }
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addressSearch, checkoutOpen, form.delivery_type]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.final_price) * item.quantity, 0), [cart]);
  const straightDistance = useMemo(() => deliveryPoint ? haversineKm(RESTAURANT_COORD, deliveryPoint) : null, [deliveryPoint]);
  const deliveryDistance = routeInfo?.distanceKm || straightDistance;
  const deliveryDuration = routeInfo?.durationMin || null;
  const deliveryFee = useMemo(() => {
    if (!cart.length) return 0;
    if (form.delivery_type !== 'delivery') return 0;
    return calculateDynamicDeliveryFee(deliveryDistance, subtotal, settings);
  }, [cart.length, form.delivery_type, settings, subtotal, deliveryDistance]);
  const couponDiscount = Number(coupon?.discount || 0);
  const total = Math.max(0, subtotal + deliveryFee - couponDiscount);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const deliveryAllowed = form.delivery_type !== 'delivery' || !deliveryDistance || deliveryDistance <= DEFAULT_DELIVERY_RADIUS_KM;

  function addItem(item, selectedOptions = []) {
    const finalPrice = Number(item.price) + optionExtraSum(selectedOptions);
    const cartKey = makeCartKey(item, selectedOptions);
    setCart(prev => {
      const found = prev.find(x => x.cart_key === cartKey);
      if (found) return prev.map(x => x.cart_key === cartKey ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, {
        cart_key: cartKey,
        id: item.id,
        name_es: item.name_es,
        description_es: item.description_es,
        price: item.price,
        final_price: finalPrice,
        image_url: item.image_url,
        selected_options: selectedOptions,
        quantity: 1,
      }];
    });
  }

  function handleProductPlus(item) {
    if (item.option_groups && item.option_groups.length) return setActiveItem(item);
    addItem(item, []);
  }

  function removeCartItem(cartKey) {
    setCart(prev => prev.map(x => x.cart_key === cartKey ? { ...x, quantity: x.quantity - 1 } : x).filter(x => x.quantity > 0));
  }

  function addCartItem(cartItem) {
    setCart(prev => prev.map(x => x.cart_key === cartItem.cart_key ? { ...x, quantity: x.quantity + 1 } : x));
  }

  function qty(id) {
    return cart.filter(x => x.id === id).reduce((sum, item) => sum + item.quantity, 0);
  }

  async function sendCode() {
    const cleanPhone = normalizePhoneDigits(phone);
    if (cleanPhone.length !== 9) {
      setMessage('Escribe un número de teléfono válido.');
      return;
    }
    try {
      setLoading(true);
      setMessage('');
      await axios.post(`${API_BASE}/auth/send-code/`, { phone });
      setCodeSent(true);
      setMessage(`Código enviado por SMS al teléfono ${phone}.`);
    } catch (err) {
      setMessage(err.response?.data?.detail || 'No se pudo enviar el código por SMS.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/auth/verify-code/`, { phone, code });
      setCustomer(res.data.customer);
      setSessionCustomer(res.data.customer);
      setCurrentRole('customer');
      setPhone(res.data.customer?.phone || phone);
      setForm(f => ({ ...f, name: res.data.customer?.name || '', address: res.data.customer?.default_address || '' }));
      setLoginOpen(false);
      setMessage('Sesión iniciada correctamente.');
    } catch (err) {
      setMessage('Código incorrecto o caducado.');
    } finally {
      setLoading(false);
    }
  }

  async function applyCoupon() {
    try {
      const code = form.coupon_code.trim();
      if (!code) return setMessage('Introduce un código de descuento.');
      const res = await axios.post(`${API_BASE}/coupons/validate/`, { code, subtotal, phone });
      if (res.data.valid) {
        setCoupon(res.data);
        setMessage(`Cupón aplicado: ${res.data.code} (-${money(res.data.discount)})`);
      } else {
        setCoupon(null);
        setMessage(res.data.message || 'Cupón no válido.');
      }
    } catch (err) {
      setCoupon(null);
      setMessage(err.response?.data?.message || 'Cupón no válido.');
    }
  }

  function handleDeliveryPoint(point, addressText = '') {
    setDeliveryPoint(point);
    setRouteInfo(null);
    if (addressText) setForm(f => ({ ...f, address: addressText }));
    fetchDrivingRoute(point)
      .then(route => setRouteInfo(route))
      .catch(() => {
        const fallbackDistance = haversineKm(RESTAURANT_COORD, point);
        const fallbackDuration = fallbackDistance ? (fallbackDistance / 22) * 60 : null;
        setRouteInfo({
          distanceKm: fallbackDistance,
          durationMin: fallbackDuration,
          coords: null,
          provider: 'distancia aproximada'
        });
      });
  }

  async function searchAddress() {
    const q = (addressSearch || form.address || '').trim();
    if (!q) return setMessage('Escribe una calle o dirección en Salamanca.');
    try {
      setLoading(true);
      const results = await fetchSalamancaAddressResults(q, 8);
      setAddressResults(results);
      if (results.length === 1) {
        selectAddressResult(results[0]);
        setMessage('Dirección encontrada, ruta calculada y marcada en el mapa.');
      } else if (results.length > 1) {
        setMessage('Selecciona una dirección de la lista.');
      } else {
        setForm(f => ({ ...f, address: q }));
        setMessage('No encontré esa calle automáticamente. Puedes dejar la dirección escrita y marcar el punto en el mapa o usar tu ubicación.');
      }
    } catch (err) {
      setForm(f => ({ ...f, address: q }));
      setMessage('No se pudo buscar la dirección. Puedes escribirla manualmente y marcar el punto en el mapa.');
    } finally {
      setLoading(false);
    }
  }

  function selectAddressResult(result) {
    const point = { lat: Number(result.lat), lng: Number(result.lon) };
    const formatted = formatAddressFull(result);
    handleDeliveryPoint(point, formatted);
    setAddressSearch(formatted);
    setAddressResults([]);
    setMessage('Dirección seleccionada correctamente.');
  }

  function useCustomerLocation() {
    if (!navigator.geolocation) return setMessage('Tu navegador no permite obtener ubicación automáticamente. Puedes escribir la dirección o marcarla en el mapa.');
    setMessage('Buscando tu ubicación...');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const addressText = await reverseGeocodePoint(point);
        handleDeliveryPoint(point, addressText || 'Ubicación actual del cliente');
        setAddressSearch(addressText || 'Ubicación actual del cliente');
        setMessage('Ubicación detectada. Revisa el punto en el mapa y confirma el pedido.');
      },
      () => setMessage('No se pudo obtener la ubicación. Revisa permisos del navegador o marca el punto en el mapa.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function confirmCollectionStep() {
    setForm(f => ({ ...f, delivery_type: 'collection', address: RESTAURANT_ADDRESS, payment_method: f.payment_method === 'card_delivery' ? 'store' : f.payment_method }));
    setCheckoutStep('details');
    setMessage('Recogida en tienda seleccionada.');
  }

  function confirmDeliveryStep() {
    const writtenAddress = (form.address || '').trim();
    if (!writtenAddress) {
      setMessage('Escribe la dirección de entrega antes de continuar.');
      return;
    }
    setForm(f => ({ ...f, delivery_type: 'delivery', address: writtenAddress }));
    setCheckoutStep('details');
    setMessage('Dirección de entrega confirmada.');
  }

  async function requestCheckoutOtp() {
    if (form.payment_method === 'online') {
      setMessage('El pago online todavía no está disponible. La infraestructura bancaria BBVA está en preparación y no se ha registrado ningún pedido.');
      return;
    }

    const sessionCustomer = customer || getSessionCustomer();
    const orderPhone = sessionCustomer?.phone || phone;

    if (!cart.length) return setMessage('La cesta está vacía.');

    if (isAdminCollection) {
      setMessage('Registrando pedido de recogida desde Admin sin nombre, teléfono ni código SMS...');
      await finalizeOrderAfterOtp('', true);
      return;
    }

    if (!form.name.trim()) return setMessage('Escribe el nombre del cliente.');
    if (normalizePhoneDigits(orderPhone).length !== 9) return setMessage('Escribe un número de teléfono válido.');
    if (form.delivery_type === 'delivery' && !form.address.trim()) return setMessage('La dirección es obligatoria para entrega a domicilio.');
    if (form.delivery_type === 'delivery' && !deliveryAllowed) return setMessage(`Esta dirección está fuera de la zona de reparto (${DEFAULT_DELIVERY_RADIUS_KM} km).`);

    // El cliente que ya inició sesión ya verificó su teléfono.
    // Para él no se vuelve a enviar OTP al confirmar cada pedido.
    if (sessionCustomer?.phone) {
      if (phone !== sessionCustomer.phone) setPhone(sessionCustomer.phone);
      setMessage('Cuenta verificada. Registrando el pedido sin solicitar otro código SMS...');
      await finalizeOrderAfterOtp(sessionCustomer.phone);
      return;
    }

    // Invitados: se exige un código SMS antes de registrar el pedido.
    try {
      setCheckoutOtpSending(true);
      setCheckoutOtpMessage('');
      setCheckoutOtpCode('');
      await axios.post(`${API_BASE}/auth/send-code/`, { phone: orderPhone });
      setCheckoutOtpOpen(true);
      setCheckoutOtpMessage(`Hemos enviado un código de verificación por SMS al teléfono ${orderPhone}.`);
    } catch (err) {
      setMessage(err.response?.data?.detail || 'No se pudo enviar el código de verificación por SMS.');
    } finally {
      setCheckoutOtpSending(false);
    }
  }

  async function verifyCheckoutOtp() {
    const codeValue = checkoutOtpCode.trim();
    if (!codeValue) {
      setCheckoutOtpMessage('Introduce el código recibido por SMS.');
      return;
    }

    try {
      setCheckoutOtpSending(true);
      setCheckoutOtpMessage('');
      const res = await axios.post(`${API_BASE}/auth/verify-code/`, {
        phone,
        code: codeValue,
      });

      // Verificar un pedido como invitado no inicia sesión automáticamente.
      // La sesión de cliente sólo se crea desde el formulario «Iniciar Sesión».
      const verifiedPhone = res.data?.customer?.phone || phone;
      setCheckoutOtpOpen(false);
      setCheckoutOtpCode('');
      await finalizeOrderAfterOtp(verifiedPhone);
    } catch (err) {
      setCheckoutOtpMessage(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'El código es incorrecto o ha caducado.'
      );
    } finally {
      setCheckoutOtpSending(false);
    }
  }

  async function resendCheckoutOtp() {
    try {
      setCheckoutOtpSending(true);
      await axios.post(`${API_BASE}/auth/send-code/`, { phone });
      setCheckoutOtpMessage(`Hemos enviado un nuevo código al teléfono ${phone}.`);
    } catch (err) {
      setCheckoutOtpMessage('No se pudo reenviar el código.');
    } finally {
      setCheckoutOtpSending(false);
    }
  }

  async function finalizeOrderAfterOtp(verifiedPhone = '', adminCollection = isAdminCollection) {
    if (form.payment_method === 'online') {
      setMessage('El pago online todavía no está disponible. La infraestructura bancaria BBVA está en preparación y no se ha registrado ningún pedido.');
      return;
    }

    try {
      const orderPhone = adminCollection
        ? ''
        : (verifiedPhone || customer?.phone || getSessionCustomer()?.phone || phone);
      if (!adminCollection && normalizePhoneDigits(orderPhone).length !== 9) return setMessage('Escribe un número de teléfono válido.');
      if (!cart.length) return setMessage('La cesta está vacía.');
      if (form.delivery_type === 'delivery' && !form.address.trim()) return setMessage('La dirección es obligatoria para entrega a domicilio.');

      setLoading(true);

      let resolvedPoint = deliveryPoint;
      let resolvedRoute = routeInfo;
      let resolvedAddress = form.address.trim();

      function isValidSalamancaPoint(point) {
        return Boolean(
          point &&
          Number.isFinite(Number(point.lat)) &&
          Number.isFinite(Number(point.lng)) &&
          Number(point.lat) >= 40.80 &&
          Number(point.lat) <= 41.12 &&
          Number(point.lng) >= -5.90 &&
          Number(point.lng) <= -5.35
        );
      }

      // When the address was typed but not selected, resolve it through the
      // same backend Google Places endpoints used by the customer app.
      if (form.delivery_type === 'delivery' && !isValidSalamancaPoint(resolvedPoint)) {
        setMessage('Validando automáticamente la dirección escrita...');

        try {
          const autocompleteResponse = await axios.get(
            `${API_BASE}/places/autocomplete/`,
            { params: { q: resolvedAddress } }
          );

          const predictions = Array.isArray(autocompleteResponse.data)
            ? autocompleteResponse.data
            : (
                autocompleteResponse.data?.predictions ||
                autocompleteResponse.data?.results ||
                autocompleteResponse.data?.suggestions ||
                []
              );

          const prediction = predictions[0];
          const directLat = Number(prediction?.latitude ?? prediction?.lat);
          const directLng = Number(
            prediction?.longitude ?? prediction?.lng ?? prediction?.lon
          );

          if (
            Number.isFinite(directLat) &&
            Number.isFinite(directLng) &&
            directLat >= 40.80 && directLat <= 41.12 &&
            directLng >= -5.90 && directLng <= -5.35
          ) {
            resolvedPoint = {
              lat: Number(directLat.toFixed(7)),
              lng: Number(directLng.toFixed(7)),
            };
            resolvedAddress =
              prediction?.description ||
              prediction?.formatted_address ||
              resolvedAddress;
          } else {
            const placeId =
              prediction?.place_id ||
              prediction?.placeId ||
              prediction?.id;

            if (placeId) {
              const detailsResponse = await axios.get(
                `${API_BASE}/places/details/`,
                { params: { place_id: placeId } }
              );

              const detailsLat = Number(detailsResponse.data?.latitude);
              const detailsLng = Number(detailsResponse.data?.longitude);

              if (
                Number.isFinite(detailsLat) &&
                Number.isFinite(detailsLng) &&
                detailsLat >= 40.80 && detailsLat <= 41.12 &&
                detailsLng >= -5.90 && detailsLng <= -5.35
              ) {
                resolvedPoint = {
                  lat: Number(detailsLat.toFixed(7)),
                  lng: Number(detailsLng.toFixed(7)),
                };
                resolvedAddress =
                  detailsResponse.data?.formatted_address ||
                  prediction?.description ||
                  resolvedAddress;
              }
            }
          }
        } catch (placesError) {
          console.warn(
            'Backend Places resolution failed; trying Nominatim fallback.',
            placesError?.response?.data || placesError
          );
        }

        // Keep the existing free fallback for resilience.
        if (!isValidSalamancaPoint(resolvedPoint)) {
          const matches = await fetchSalamancaAddressResults(resolvedAddress, 5);
          const first = matches?.[0];

          if (first) {
            resolvedPoint = {
              lat: Number(Number(first.lat).toFixed(7)),
              lng: Number(Number(first.lon).toFixed(7)),
            };
            resolvedAddress = formatAddressFull(first) || resolvedAddress;
          }
        }

        if (!isValidSalamancaPoint(resolvedPoint)) {
          throw {
            response: {
              data: {
                address: [
                  'No se encontró esta dirección en Salamanca. Selecciona una sugerencia válida de la lista.'
                ]
              }
            }
          };
        }

        setDeliveryPoint(resolvedPoint);
        setForm(current => ({ ...current, address: resolvedAddress }));

        try {
          resolvedRoute = await fetchDrivingRoute(resolvedPoint);
          setRouteInfo(resolvedRoute);
        } catch (routeError) {
          const straightDistance = haversineKm(RESTAURANT_COORD, resolvedPoint);
          resolvedRoute = {
            distanceKm: straightDistance,
            durationMin: straightDistance ? Math.max(5, (straightDistance / 25) * 60) : null,
            coords: [],
            provider: 'Haversine fallback'
          };
          setRouteInfo(resolvedRoute);
        }
      }

      const resolvedDistance = resolvedRoute?.distanceKm ?? deliveryDistance ?? null;
      const resolvedDuration = resolvedRoute?.durationMin ?? deliveryDuration ?? null;

      if (form.delivery_type === 'delivery' && !resolvedPoint) {
        throw {
          response: {
            data: {
              delivery_latitude: ['La ubicación del cliente no está disponible.']
            }
          }
        };
      }

      const payload = {
        admin_collection: adminCollection,
        customer_name: adminCollection ? '' : form.name,
        customer_phone: adminCollection ? '' : orderPhone,
        delivery_type: form.delivery_type,
        address: resolvedAddress,
        delivery_latitude: resolvedPoint?.lat == null ? null : Number(Number(resolvedPoint.lat).toFixed(7)),
        delivery_longitude: resolvedPoint?.lng == null ? null : Number(Number(resolvedPoint.lng).toFixed(7)),
        route_distance_km: resolvedDistance == null ? null : Number(Number(resolvedDistance).toFixed(2)),
        route_duration_min: resolvedDuration == null ? null : Number(Number(resolvedDuration).toFixed(2)),
        delivery_fee_override: deliveryFee,
        note: [form.floor ? `Piso/Puerta: ${form.floor}` : '', form.note || ''].filter(Boolean).join(' | '),
        payment_method: form.payment_method,
        coupon_code: coupon?.code || form.coupon_code,
        items: cart.map(x => ({
          menu_item_id: x.id,
          quantity: x.quantity,
          options: x.selected_options.map(opt => ({ id: opt.id })),
        })),
      };

      const res = await axios.post(`${API_BASE}/orders/`, payload);
      const orderCode = res.data.order.order_code;
      setCart([]);
      setCheckoutOpen(false);
      window.location.href = `/receipt/${orderCode}`;
    } catch (err) {
      console.error('ORDER_CREATE_ERROR', err?.response?.data || err);

      const data = err?.response?.data;
      let detail = '';

      if (typeof data === 'string') {
        detail = data;
      } else if (data?.detail) {
        detail = Array.isArray(data.detail) ? data.detail.join(' ') : String(data.detail);
      } else if (data && typeof data === 'object') {
        detail = Object.entries(data)
          .map(([field, value]) => {
            const text = Array.isArray(value) ? value.join(' ') : String(value);
            return `${field}: ${text}`;
          })
          .join(' | ');
      }

      setMessage(
        detail
          ? `No se pudo registrar el pedido: ${detail}`
          : 'No se pudo registrar el pedido. Revisa la dirección, los productos y los datos enviados.'
      );
    } finally {
      setLoading(false);
    }
  }

  return <div>
    <Header>
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Inicio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
      <button dataRoles="admin" onClick={() => window.location.href='/dashboard'}>Dashboard</button>
      <button dataRoles="admin" onClick={() => window.location.href='/menu-admin'}>Menú Admin</button>
      <button dataRoles="admin" onClick={() => window.location.href='/settings-admin'}>Ajustes</button>
      <button dataRoles="customer,staff,admin" onClick={() => window.location.href='/account'}>Cuenta</button>
      <button dataRoles="rider,staff,admin" onClick={() => window.location.href='/rider'}>Repartidor</button>
      <button dataRoles="guest,customer,rider,staff,admin" dataAuthAction="login" onClick={() => setLoginOpen(true)}>Iniciar Sesión</button>
    </Header>

    {message && <div className="toast">{message}</div>}

    <main className="layout home-layout">
      <section className="content">
        <button className="back">← ATRÁS</button>
        <section className="hero-banner">
          <div className="hero-copy">
            <span className="hero-kicker">Sabor auténtico • Salamanca</span>
            <h1>Casa de Kebab Turco</h1>
            <p>Durum, doner kebab, combos y platos preparados con una imagen más moderna, tipografía legible y una experiencia de pedido más clara para todos los clientes.</p>
            <div className="hero-actions">
              <button type="button" className="hero-primary hero-link-button" onClick={() => openCategory(menu?.[0]?.id || 1)}>Ver menú</button>
              <a href="#cart-summary" className="hero-secondary">Ir a la cesta</a>
            </div>
          </div>
          <div className="hero-gallery">
            <div className="hero-main-card"><img src={foodHeroOne} alt="Durum Casa de Kebab Turco" /></div>
            <div className="hero-side-grid">
              <img src={foodHeroTwo} alt="Wrap kebab" />
              <img src={foodHeroThree} alt="Kebab premium" />
              <img src={foodHeroFour} alt="Pan kebab y salsa" />
            </div>
          </div>
        </section>
        <div className="info-card">
          <div className="restaurant-info-line"><img src={restaurantLogo} alt="Casa de Kebab Turco" /><span><b>Recoger</b><br/>Casa de Kebab Turco</span></div>
          <div>📍 {RESTAURANT_ADDRESS}</div>
          <div className="discount"><b>10%</b> código · PRIMERPEDIDO</div>
          <div className={settings?.is_open === false ? 'closed-status' : 'open-status'}>{settings?.is_open === false ? <span className="status-dot status-dot-closed"></span> : <span className="status-dot status-dot-open"></span>}<span>{settings?.is_open === false ? 'Cerrado ahora' : 'Abierto'} · {settings?.opening_hours || '12:00 - 01:00'}</span></div>
        </div>
        <div className={`chips menu-chips ${menuSearchOpen ? 'is-searching' : ''}`}>
          {menu.map(c => <button type="button" key={c.id} className={openCategoryId === c.id ? 'active-chip' : ''} onClick={() => openCategory(c.id)}>{c.name_es}</button>)}
          <button type="button" className="search-chip" onClick={() => setMenuSearchOpen(v => !v)} aria-label="Buscar en el menú">⌕</button>
        </div>
        {menuSearchOpen && <div className="menu-search-panel">
          <div className="menu-search-box">
            <span>⌕</span>
            <input autoFocus value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Buscar platos, combos, durum, bebidas..." />
            {menuSearch && <button type="button" onClick={() => setMenuSearch('')}>×</button>}
          </div>
          {normalizedMenuSearch && <div className="menu-search-results">
            {menuSearchResults.length ? menuSearchResults.map(row => <button type="button" key={`${row.cat.id}-${row.item.id}`} onClick={() => selectMenuSearchResult(row)}>
              <img src={getItemImage(row.item)} alt={row.item.name_es} />
              <span><b>{row.item.name_es}</b><small>{row.cat.name_es} · {money(row.item.price)}</small></span>
            </button>) : <div className="menu-search-empty">No encontré productos con ese texto.</div>}
          </div>}
        </div>}
        <div className="accordion-menu">
          {openCategoryId === null && <div className="all-categories-closed">
            <b>Menú cerrado</b>
            <span>Elige una categoría de arriba o pulsa una flecha para abrirla.</span>
          </div>}
          {filteredMenu.map(cat => {
            const isOpen = openCategoryId === cat.id;
            return <section className={`cat accordion-cat ${isOpen ? 'is-open' : 'is-closed'}`} id={`cat-${cat.id}`} key={cat.id}>
              <button type="button" className="cat-toggle" onClick={() => setOpenCategoryId(isOpen ? null : cat.id)} aria-expanded={isOpen}>
                <span>{cat.name_es}</span>
                <span className="cat-arrow">{isOpen ? '⌃' : '⌄'}</span>
              </button>
              {isOpen && <div className="grid accordion-grid">
                {(cat.items || []).map(item => <article className={`product ${qty(item.id) ? 'selected' : ''}`} key={item.id}>
                  <div onClick={() => setActiveItem(item)} className="product-text">
                    <h3>{item.name_es}</h3>
                    <p>{item.description_es}</p>
                    <strong>{money(item.price)}</strong>
                  </div>
                  <div className="fake-img"><img src={getItemImage(item)} alt={item.name_es}/></div>
                  <div className="controls">
                    {qty(item.id) > 0 && <span className="qty-badge">{qty(item.id)}</span>}
                    <button className="round red" onClick={() => handleProductPlus(item)}>+</button>
                  </div>
                </article>)}
                {!(cat.items || []).length && <div className="empty-category">No hay productos disponibles en esta categoría.</div>}
              </div>}
            </section>;
          })}
        </div>
      </section>
      <aside className="cart cart-home" id="cart-summary">
        <h2>🛒 Cesta <span>{cartCount}</span></h2>
        {!cart.length && <div className="empty-cart-state"><div className="empty-cart-icon">🛒</div><p className="empty">Tu cesta está vacía.</p></div>}
        {cart.map(item => <div className="cart-row" key={item.cart_key}>
          <div><b>{item.name_es}</b>{item.selected_options?.length ? <p>{item.selected_options.map(o => o.name_es).join(', ')}</p> : <p>{item.description_es}</p>}</div>
          <div>{money(Number(item.final_price) * item.quantity)}</div>
          <div className="cart-controls"><button onClick={() => removeCartItem(item.cart_key)}>−</button><span>{item.quantity}</span><button onClick={() => addCartItem(item)}>+</button></div>
        </div>)}
        <button className="pay blink" disabled={!cart.length} onClick={() => { setCheckoutStep('details'); setCheckoutOpen(true); }}>Proceder al pago <b>{money(subtotal)}</b></button>
      </aside>
    </main>

    <LocationSection />
    <PublicReviewsSection />

    {activeItem && <ProductModal item={activeItem} onClose={() => setActiveItem(null)} onAdd={(item, options) => { addItem(item, options); setActiveItem(null); }} />}

    {loginOpen && <Modal onClose={() => setLoginOpen(false)}>
      <h2>Identifícate con tu número de móvil</h2>
      <p>Te enviaremos por SMS un código de verificación y sólo utilizaremos tu número para actualizaciones importantes de tu pedido.</p>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono" />
      {!codeSent ? <button className="pay" disabled={loading} onClick={sendCode}>Continuar</button> : <>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código" />
        <button className="pay" disabled={loading} onClick={verifyCode}>Verificar</button>
      </>}
    </Modal>}

    {checkoutOpen && <Modal onClose={() => setCheckoutOpen(false)} className="checkout-modal checkout-details-modal direct-checkout-modal">
      <div className="checkout-details-head">
        <h2>Finalizar pedido</h2>
        <p>
          {isAdminCollection
            ? 'Recogida creada por Admin: no se requiere nombre, teléfono ni código SMS.'
            : 'Completa nombre, teléfono y dirección. La entrega requiere verificación por SMS.'}
        </p>
      </div>

      <div className="delivery-choice-header direct-choice-header">
        <button className={form.delivery_type === 'delivery' ? 'choice-tab active' : 'choice-tab'} onClick={() => setForm({...form, delivery_type:'delivery', payment_method: form.payment_method === 'store' ? 'cash' : form.payment_method})}>🛵 Entregar</button>
        <button className={form.delivery_type === 'collection' ? 'choice-tab active' : 'choice-tab'} onClick={() => setForm({...form, delivery_type:'collection', address: RESTAURANT_ADDRESS, floor: '', payment_method: form.payment_method === 'card_delivery' ? 'store' : form.payment_method})}>🛍️ Recoger</button>
      </div>

      {!isAdminCollection && <>
        <input placeholder="Nombre" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
        <input
          placeholder="Teléfono"
          value={customer?.phone || phone}
          readOnly={Boolean(customer?.phone)}
          onChange={e => setPhone(e.target.value)}
        />
        {customer?.phone && <p className="muted">Teléfono verificado en tu cuenta. No se solicitará otro código SMS para este pedido.</p>}
      </>}

      {form.delivery_type === 'delivery' ? <div className="direct-address-section">
        <GooglePlacesDeliveryAddress
          address={form.address}
          onChange={value => setForm({...form, address: value})}
          onPlaceSelected={(value, point) => {
            setForm({...form, address: value});
            if (point) handleDeliveryPoint(point, value);
          }}
        />
        <input placeholder="Piso / puerta / escalera. Ej: 2ºB" value={form.floor} onChange={e => setForm({...form, floor:e.target.value})}/>
      </div> : <div className="pickup-store-box direct-pickup-box">
        <div className="pickup-store-row selected">
          <span className="pickup-green-dot"></span>
          <div>
            <b>Recoger en Casa de Kebab Turco</b>
            <small>{RESTAURANT_ADDRESS}</small>
            <small>Horario: {RESTAURANT_OPENING_HOURS}</small>
          </div>
        </div>
      </div>}

      <textarea placeholder="Notas / referencias para cocina o repartidor. Ej: sin timbre, llamar al llegar, portal..." value={form.note} onChange={e => setForm({...form, note:e.target.value})}/>
      <div className="coupon-row">
        <input placeholder="Código descuento: PRIMERPEDIDO" value={form.coupon_code} onChange={e => setForm({...form, coupon_code:e.target.value.toUpperCase()})}/>
        <button className="mini-action" onClick={applyCoupon}>Aplicar</button>
      </div>
      <div className="checkout-summary">
        <span>Subtotal <b>{money(subtotal)}</b></span>
        <span>Envío <b>{money(deliveryFee)}</b></span>
        {couponDiscount > 0 && <span>Descuento <b>-{money(couponDiscount)}</b></span>}
        <span className="grand-total">Total <b>{money(total)}</b></span>
      </div>
      <select value={form.payment_method} onChange={e => setForm({...form, payment_method:e.target.value})}>
        {form.delivery_type === 'delivery' && <option value="cash">Efectivo</option>}
        {form.delivery_type === 'delivery' && <option value="card_delivery">Tarjeta al repartidor</option>}
        {form.delivery_type === 'collection' && <option value="store">Pagar en tienda</option>}
        <option value="online">Pago online (próximamente)</option>
      </select>
      <button className="pay" disabled={loading || settings?.is_open === false || (form.delivery_type === 'delivery' && !form.address.trim()) || !deliveryAllowed} onClick={requestCheckoutOtp}>Confirmar pedido <b>{money(total)}</b></button>
    </Modal>}

    {checkoutOtpOpen && <Modal onClose={() => {
      if (!checkoutOtpSending) setCheckoutOtpOpen(false);
    }} className="checkout-otp-modal">
      <h2>Verificación del teléfono</h2>
      <p>Introduce el código enviado por SMS a <b>{phone}</b>.</p>
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        placeholder="Código de verificación"
        value={checkoutOtpCode}
        onChange={e => setCheckoutOtpCode(e.target.value.replace(/\D/g, ''))}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            verifyCheckoutOtp();
          }
        }}
      />
      {checkoutOtpMessage && <p className="muted">{checkoutOtpMessage}</p>}
      <button
        className="pay"
        disabled={checkoutOtpSending || !checkoutOtpCode.trim()}
        onClick={verifyCheckoutOtp}
      >
        {checkoutOtpSending ? 'Verificando...' : 'Verificar y continuar'}
      </button>
      <button
        type="button"
        className="mini-action"
        disabled={checkoutOtpSending}
        onClick={resendCheckoutOtp}
      >
        Reenviar código
      </button>
    </Modal>}
    <CustomerSmartAssistant menu={menu} cart={cart} onOpenProduct={setActiveItem} />
  </div>;
}


function GooglePlacesDeliveryAddress({ address, onChange, onPlaceSelected }) {
  const [value, setValue] = useState(address || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState('');

  useEffect(() => {
    setValue(address || '');
  }, [address]);

  useEffect(() => {
    const q = (value || '').trim();
    if (q.length < 1 || selectedPlaceId) {
      setSuggestions([]);
      setError('');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/places/autocomplete/`, { params: { q } });
        if (cancelled) return;
        const rows = res.data?.predictions || [];
        setSuggestions(rows);
        setError(rows.length ? '' : (res.data?.detail ? 'Google Places no devolvió resultados. Puedes seguir escribiendo la dirección manualmente.' : ''));
      } catch (err) {
        if (!cancelled) {
          setSuggestions([]);
          setError('No se pudo consultar Google Places. Puedes escribir la dirección manualmente.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, selectedPlaceId]);

  function handleChange(e) {
    const next = e.target.value;
    setValue(next);
    setSelectedPlaceId('');
    onChange(next);
    onPlaceSelected(next, null);
  }

  function choosePrediction(row) {
    const full = row.description || row.main_text || '';
    setValue(full);
    setSelectedPlaceId(row.place_id || full);
    setSuggestions([]);
    setError('');
    onChange(full);
    onPlaceSelected(full, null);
  }

  function clearAddress() {
    setValue('');
    setSelectedPlaceId('');
    setSuggestions([]);
    setError('');
    onChange('');
    onPlaceSelected('', null);
  }

  return <section className="direct-google-address-clean places-proxy-address">
    <label className="manual-address-label">Dirección de entrega</label>
    <div className="places-proxy-input-wrap">
      <input
        value={value}
        onChange={handleChange}
        placeholder="Escribe calle y número. Ej: Calle Chile 11"
        autoComplete="off"
      />
      {!!value && <button type="button" className="direct-google-clear" onClick={clearAddress}>×</button>}
    </div>

    {loading && <div className="places-status-line">Buscando direcciones...</div>}

    {!!suggestions.length && <div className="places-suggestions-list">
      {suggestions.map((row, idx) => <button
        type="button"
        key={`${row.place_id}-${idx}`}
        className="places-suggestion-row"
        onClick={() => choosePrediction(row)}
      >
        <span className="places-pin">📍</span>
        <span>
          <b>{row.main_text || row.description}</b>
          {row.secondary_text && <small>{row.secondary_text}</small>}
        </span>
      </button>)}
    </div>}

    <div className={error ? 'direct-google-help warning' : 'direct-google-help ok'}>
      {error || 'Escribe y Google Places filtrará direcciones automáticamente con cada letra. También puedes dejar la dirección escrita manualmente.'}
    </div>
  </section>;
}


function DeliveryMap({ point, onPointChange, addressSearch, setAddressSearch, addressResults, onSearch, onSelectAddress, onUseLocation, currentAddress, routeInfo, deliveryFee, loading, deliveryAllowed, deliveryDistance, deliveryDuration }) {
  const hasQuery = (addressSearch || '').trim().length > 0;
  const selectedAddress = currentAddress && currentAddress !== 'Punto seleccionado en el mapa' ? currentAddress : '';

  return <section className="delivery-address-only">
    <div className="address-only-topbar">
      <button type="button" className="address-back-arrow" onClick={() => setAddressSearch('')}>←</button>
      <div className="address-only-field">
        <input
          autoFocus
          value={addressSearch}
          onChange={e => setAddressSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSearch(); } }}
          placeholder="Introduzca su código postal o dirección"
        />
        {hasQuery && <button type="button" className="address-clear-circle" onClick={() => { setAddressSearch(''); }}>×</button>}
      </div>
    </div>

    <button type="button" className="use-current-location-row" onClick={onUseLocation}>
      <span>➤</span>
      <b>Utilizar la ubicación actual</b>
    </button>

    {point && <div className={deliveryAllowed ? 'address-confirm-card ok' : 'address-confirm-card bad'}>
      <b>Dirección seleccionada</b>
      <span>{selectedAddress || addressSearch}</span>
      {deliveryDistance !== null && <div className="address-route-chips">
        <em>Ruta: <strong>{formatKm(deliveryDistance)}</strong></em>
        <em>Tiempo: <strong>{deliveryDuration ? formatMinutes(deliveryDuration) : '—'}</strong></em>
        <em>Envío: <strong>{money(deliveryFee)}</strong></em>
      </div>}
      {!deliveryAllowed && <small>Esta dirección está fuera de la zona de reparto.</small>}
    </div>}

    <div className="address-only-results">
      <b>{hasQuery ? 'Resultados de búsqueda' : 'Lugares recientes'}</b>
      {!!addressResults.length && addressResults.map(r => <button type="button" className="address-only-result" key={r.place_id} onClick={() => onSelectAddress(r)}>
        <span className="result-pin-icon">●</span>
        <span><strong>{formatAddressTitle(r)}</strong><small>{formatAddressSubtitle(r)}</small></span>
      </button>)}
      {!addressResults.length && hasQuery && <button type="button" className="address-not-found" onClick={() => { setAddressSearch(''); }}>
        Dirección no indicada
      </button>}
      {!hasQuery && <button type="button" className="address-only-result recent" onClick={() => { setAddressSearch(RESTAURANT_ADDRESS); onPointChange(RESTAURANT_COORD, RESTAURANT_ADDRESS); }}>
        <span className="result-pin-icon">●</span>
        <span><strong>Casa de Kebab Turco</strong><small>{RESTAURANT_ADDRESS}</small></span>
      </button>}
    </div>
  </section>;
}

function LocationSection() {
  const mapRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, {
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      zoomControl: true,
    }).setView([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const restaurantIcon = L.divIcon({
      className: 'restaurant-logo-marker location-logo-marker',
      html: `<img src="${restaurantLogo}" alt="Casa de Kebab Turco" />`,
      iconSize: [72, 72],
      iconAnchor: [36, 72],
      popupAnchor: [0, -66],
    });

    L.marker([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], { icon: restaurantIcon })
      .addTo(map)
      .bindPopup(`<b>Casa de Kebab Turco</b><br/>${RESTAURANT_ADDRESS}<br/>Tel: ${RESTAURANT_PHONE_1} / ${RESTAURANT_PHONE_2}`)
      .openPopup();

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 250);
  }, []);

  return <section className="locations-section" id="ubicaciones">
    <h2>Ubicaciones</h2>
    <div className="locations-map-card">
      <div className="location-info-card">
        <div className="location-title-row">
          <img src={restaurantLogo} alt="Casa de Kebab Turco" />
          <h3>Casa de Kebab Turco</h3>
        </div>
        <p>{RESTAURANT_ADDRESS}</p>
        <p>Teléfono: <a href={`tel:${RESTAURANT_PHONE_1}`}>{RESTAURANT_PHONE_1}</a> · <a href={`tel:${RESTAURANT_PHONE_2}`}>{RESTAURANT_PHONE_2}</a></p>
        <div className="location-hours">
          <b>Horario de entrega a domicilio</b>
          <span>{RESTAURANT_OPENING_HOURS}</span>
        </div>
        <div className="location-hours">
          <b>Horario de recogida</b>
          <span>{RESTAURANT_OPENING_HOURS}</span>
        </div>
        <a className="location-directions" href={getRestaurantDirectionsUrl()} target="_blank" rel="noreferrer">Obtener direcciones</a>
      </div>
      <div className="location-map" ref={boxRef}></div>
    </div>
  </section>;
}

function ProductModal({ item, onClose, onAdd }) {
  const [selected, setSelected] = useState({});
  const groups = item.option_groups || [];

  function toggleOption(group, option) {
    setSelected(prev => {
      const current = prev[group.id] || [];
      const exists = current.find(x => x.id === option.id);
      if (exists) return { ...prev, [group.id]: current.filter(x => x.id !== option.id) };
      if (group.max_choices === 1) return { ...prev, [group.id]: [option] };
      if (current.length >= group.max_choices) return { ...prev, [group.id]: [...current.slice(1), option] };
      return { ...prev, [group.id]: [...current, option] };
    });
  }

  function clearOptionGroup(group) {
    setSelected(prev => ({ ...prev, [group.id]: [] }));
  }

  const selectedOptions = Object.values(selected).flat();
  const finalPrice = Number(item.price) + optionExtraSum(selectedOptions);

  return <Modal onClose={onClose}>
    <div className="detail-img"><img src={getItemImage(item)} alt={item.name_es}/></div>
    <h2>{item.name_es}</h2>
    <p>{item.description_es}</p>
    {groups.map(group => {
      const isDrinkGroup = String(group.title_es || '').toLowerCase().includes('bebida');
      const currentSelection = selected[group.id] || [];
      return <div className="option-group" key={group.id}>
        <h3>{group.title_es} {group.required ? <span>Obligatorio</span> : isDrinkGroup ? <span>Opcional</span> : null}</h3>
        {(group.options || []).map(option => {
          const checked = currentSelection.some(x => x.id === option.id);
          return <label className="option-row" key={option.id}>
            <input type={group.max_choices === 1 ? 'radio' : 'checkbox'} checked={checked} onChange={() => toggleOption(group, option)} />
            <span>{option.name_es}</span>
            {Number(option.extra_price) > 0 && <em>+{money(option.extra_price)}</em>}
          </label>;
        })}
        {isDrinkGroup && currentSelection.length > 0 && <button type="button" className="clear-drink-button" onClick={() => clearOptionGroup(group)}>Quitar bebida</button>}
      </div>;
    })}
    <button className="pay" onClick={() => onAdd(item, selectedOptions)}>Siguiente <b>{money(finalPrice)}</b></button>
  </Modal>;
}

function Modal({children, onClose, className = ''}) {
  return <div className="overlay"><div className={`modal ${className}`.trim()}><button className="close" onClick={onClose}>×</button>{children}</div></div>;
}

function LiveOrdersApp() {
  usePageChrome();
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryPoint, setDeliveryPoint] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState([]);

  async function loadOrders() {
    try {
      const res = await axios.get(`${API_BASE}/orders/live/?limit=50`);
      setOrders(res.data || []);
    } catch (err) {
      setMessage('No se pudieron cargar los pedidos. Revisa el backend.');
    }
  }

  async function loadRiders() {
    try {
      const res = await axios.get(`${API_BASE}/riders/`);
      setRiders(res.data || []);
    } catch (err) {
      setRiders([]);
    }
  }

  useEffect(() => {
    loadOrders();
    loadRiders();
    const timer = setInterval(loadOrders, 10000);
    return () => clearInterval(timer);
  }, []);

  async function changeStatus(orderCode, status) {
    try {
      setLoading(true);
      await axios.patch(`${API_BASE}/orders/${orderCode}/status/`, { status });
      await loadOrders();
    } catch (err) {
      setMessage('No se pudo actualizar el estado.');
    } finally {
      setLoading(false);
    }
  }

  async function assignRider(orderCode, riderId) {
    try {
      await axios.post(`${API_BASE}/orders/${orderCode}/assign-rider/`, { rider_id: riderId || null });
      await loadOrders();
      await loadRiders();
      setMessage('Repartidor asignado.');
    } catch (err) {
      setMessage('No se pudo asignar el repartidor.');
    }
  }

  async function updatePayment(orderCode, paymentStatus) {
    try {
      await axios.patch(`${API_BASE}/orders/${orderCode}/payment/`, { payment_status: paymentStatus });
      await loadOrders();
      setMessage('Pago actualizado.');
    } catch (err) {
      setMessage('No se pudo actualizar el pago.');
    }
  }

  async function testTelegram() {
    try {
      const res = await axios.post(`${API_BASE}/telegram/test/`);
      setMessage(res.data.success ? 'Telegram funciona correctamente.' : 'Telegram no está activado o faltan variables en .env.');
    } catch (err) {
      setMessage('Error al probar Telegram.');
    }
  }

  return <div>
    <Header title="Pedidos en vivo" subtitle="Casa de Kebab Turco">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Volver al sitio</button>
      <button dataRoles="rider,staff,admin" onClick={() => window.location.href='/rider'}>Vista repartidor</button>
      <button dataRoles="admin" onClick={() => window.location.href='/dashboard'}>Dashboard</button>
      <button dataRoles="admin" onClick={testTelegram}>Test Telegram</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page">
      <h1>Pedidos en vivo</h1>
      <p className="muted">Se actualiza automáticamente cada 10 segundos.</p>
      <section className="rider-panel">
        <div className="rider-panel-heading">
          <div>
            <h2>Repartidores activos</h2>
            <p className="muted">La creación, edición y contraseña se gestionan desde Admin PRO.</p>
          </div>
          <button className="mini-action" onClick={() => window.location.href='/dashboard'}>Gestionar en Admin</button>
        </div>
        <div className="rider-list">
          {riders.filter(r => r.is_active).map(r => <span key={r.id}>{r.name} · {r.phone} · {r.active_orders_count} pedidos</span>)}
        </div>
      </section>
      <div className="orders-grid">
        {orders.map(order => <article className={`order-card status-${order.status}`} key={order.id}>
          <div className="order-head"><h2>{order.order_code}</h2><strong>{money(order.total)}</strong></div>
          <button className="mini-action" onClick={() => window.open(`/receipt/${order.order_code}`, '_blank')}>Ver ticket</button>
          <p><b>Cliente:</b> {order.customer_name || 'Sin nombre'} · {order.customer_phone}</p>
          <p><b>Tipo:</b> {order.delivery_type === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'}</p>
          {order.address && <p><b>Dirección:</b> {order.address} <a href={getMapsUrl(order.address)} target="_blank" rel="noreferrer">Mapa</a></p>}
          {order.note && <p><b>Nota:</b> {order.note}</p>}
          <p><b>Pago:</b> {order.payment_method} · {order.payment_status}</p>
          <div className="quick-actions"><button onClick={() => window.open(`/receipt/${order.order_code}`, '_blank')}>Ticket</button><button onClick={() => updatePayment(order.order_code, 'paid')}>Marcar pagado</button></div>
          <p><b>Repartidor:</b> {order.assigned_rider_data ? `${order.assigned_rider_data.name} · ${order.assigned_rider_data.phone}` : 'Sin asignar'}</p>
          <div className="order-items">{(order.items || []).map(item => <div key={item.id}>{item.quantity} x {item.name_snapshot} <span>{money(item.total)}</span></div>)}</div>
          <select disabled={loading} value={order.status} onChange={e => changeStatus(order.order_code, e.target.value)}>
            <option value="pending">Pendiente</option><option value="accepted">Aceptado</option><option value="preparing">Preparando</option><option value="ready">Listo</option><option value="out_for_delivery">En reparto</option><option value="delivered">Entregado</option><option value="cancelled">Cancelado</option>
          </select>
          <select value={order.assigned_rider_data?.id || ''} onChange={e => assignRider(order.order_code, e.target.value)}>
            <option value="">Asignar repartidor</option>
            {riders.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.name} · {r.phone}</option>)}
          </select>
        </article>)}
        {!orders.length && <p>No hay pedidos todavía.</p>}
      </div>
    </main>
  </div>;
}



function TrackingMap({ order, compact = false }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const routeRequestRef = useRef(0);
  const rider = order?.assigned_rider_data;

  function toNumber(value) {
    // Number(null) and Number('') return 0, which incorrectly places the rider
    // at latitude 0 / longitude 0 near the Gulf of Guinea.
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function isValidPoint(lat, lng) {
    return lat !== null && lng !== null &&
      lat >= 40.80 && lat <= 41.12 &&
      lng >= -5.90 && lng <= -5.35;
  }

  function formatKm(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(Number(value) < 10 ? 2 : 1)} km`;
  }

  function distanceKm(aLat, aLng, bLat, bLng) {
    if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function fetchRouteBetween(startLat, startLng, endLat, endLng) {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('OSRM route failed');
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('OSRM route unavailable');
    return {
      points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: Number(route.distance || 0) / 1000,
      durationMin: Number(route.duration || 0) / 60,
    };
  }

  const riderLat = toNumber(rider?.current_latitude);
  const riderLng = toNumber(rider?.current_longitude);
  const customerLat = toNumber(order?.delivery_latitude);
  const customerLng = toNumber(order?.delivery_longitude);

  const hasRider = isValidPoint(riderLat, riderLng);
  const hasCustomer = isValidPoint(customerLat, customerLng);

  const restaurantToRiderKm = hasRider
    ? distanceKm(RESTAURANT_COORD.lat, RESTAURANT_COORD.lng, riderLat, riderLng)
    : null;

  const riderToCustomerKm = hasRider && hasCustomer
    ? distanceKm(riderLat, riderLng, customerLat, customerLng)
    : null;

  const routeLabel = hasRider && hasCustomer
    ? 'Repartidor → Cliente'
    : hasRider
      ? 'Restaurante → Repartidor'
      : hasCustomer
        ? 'Restaurante → Cliente'
        : 'Esperando ubicación GPS';

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;

    const map = L.map(boxRef.current, {
      scrollWheelZoom: true,
      zoomControl: true
    }).setView([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], 14);

    map.createPane('routeShadowPane');
    map.getPane('routeShadowPane').style.zIndex = '445';

    map.createPane('routeMainPane');
    map.getPane('routeMainPane').style.zIndex = '446';

    map.createPane('trackingMarkerPane');
    map.getPane('trackingMarkerPane').style.zIndex = '650';

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 250);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const requestId = ++routeRequestRef.current;
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    const addLayer = layer => {
      layersRef.current.push(layer);
      return layer;
    };

    const pointsForBounds = [];

    const restaurantIcon = L.divIcon({
      className: 'tracking-restaurant-marker',
      html: `<img src="${restaurantLogo}" alt="Casa de Kebab Turco" />`,
      iconSize: [54, 54],
      iconAnchor: [27, 54],
      popupAnchor: [0, -52]
    });

    addLayer(
      L.marker(
        [RESTAURANT_COORD.lat, RESTAURANT_COORD.lng],
        { icon: restaurantIcon, pane: 'trackingMarkerPane' }
      )
        .addTo(map)
        .bindPopup(`<b>Casa de Kebab Turco</b><br/>${RESTAURANT_ADDRESS}`)
    );

    pointsForBounds.push([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng]);

    if (hasRider) {
      addLayer(
        L.circleMarker([riderLat, riderLng], {
          pane: 'trackingMarkerPane',
          radius: 12,
          color: '#075c2d',
          fillColor: '#22c55e',
          fillOpacity: 1,
          weight: 5
        })
          .addTo(map)
          .bindPopup(`<b>Repartidor</b><br/>${rider?.name || ''}<br/>${rider?.phone || ''}`)
      );
      pointsForBounds.push([riderLat, riderLng]);
    }

    if (hasCustomer) {
      addLayer(
        L.circleMarker([customerLat, customerLng], {
          pane: 'trackingMarkerPane',
          radius: 12,
          color: '#7f1d1d',
          fillColor: '#ef4444',
          fillOpacity: 1,
          weight: 5
        })
          .addTo(map)
          .bindPopup(`<b>Cliente</b><br/>${order?.address || ''}`)
      );
      pointsForBounds.push([customerLat, customerLng]);
    }

    if (hasRider) {
      addLayer(
        L.polyline([
          [RESTAURANT_COORD.lat, RESTAURANT_COORD.lng],
          [riderLat, riderLng]
        ], {
          pane: 'routeMainPane',
          color: '#16a34a',
          weight: 5,
          opacity: .9,
          dashArray: '10 12'
        }).addTo(map)
      );
    }

    async function drawCurrentRoute() {
      if (hasRider && hasCustomer) {
        let routePoints = [
          [riderLat, riderLng],
          [customerLat, customerLng]
        ];

        try {
          const route = await fetchRouteBetween(
            riderLat,
            riderLng,
            customerLat,
            customerLng
          );
          if (requestId !== routeRequestRef.current) return;
          if (route.points.length > 1) routePoints = route.points;
        } catch (error) {
          console.warn('Rider-customer road route unavailable; using direct line.', error);
        }

        if (requestId !== routeRequestRef.current) return;

        addLayer(
          L.polyline(routePoints, {
            pane: 'routeShadowPane',
            color: '#ffffff',
            weight: 12,
            opacity: .96,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map)
        );

        addLayer(
          L.polyline(routePoints, {
            pane: 'routeMainPane',
            color: '#dc2626',
            weight: 7,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round'
          })
            .addTo(map)
            .bindPopup('<b>Ruta actual</b><br/>Repartidor → Cliente')
        );
      } else if (!hasRider && hasCustomer) {
        addLayer(
          L.polyline([
            [RESTAURANT_COORD.lat, RESTAURANT_COORD.lng],
            [customerLat, customerLng]
          ], {
            pane: 'routeMainPane',
            color: '#f59e0b',
            weight: 6,
            opacity: 1,
            dashArray: '10 10'
          }).addTo(map)
        );
      }

      if (pointsForBounds.length > 1) {
        map.fitBounds(L.latLngBounds(pointsForBounds), {
          paddingTopLeft: [40, 210],
          paddingBottomRight: [40, 40],
          maxZoom: 17
        });
      } else {
        map.setView([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], 14);
      }
    }

    drawCurrentRoute();

    return () => {
      routeRequestRef.current += 1;
    };
  }, [
    order?.order_code,
    riderLat,
    riderLng,
    customerLat,
    customerLng,
    rider?.name,
    rider?.phone,
    order?.address
  ]);

  return <div className={compact ? 'tracking-map compact' : 'tracking-map'}>
    <div ref={boxRef} className="tracking-map-box"></div>

    <div className="tracking-route-panel">
      <div className="tracking-route-legend">
        <span className="tracking-route-pill tracking-route-pill-restaurant">Restaurante</span>
        <span className="tracking-route-pill tracking-route-pill-rider">Repartidor</span>
        <span className="tracking-route-pill tracking-route-pill-customer">Cliente</span>
      </div>

      <div className="tracking-route-summary-grid">
        <div>
          <small>Ruta actual</small>
          <b>{routeLabel}</b>
        </div>
        <div>
          <small>Restaurante → repartidor</small>
          <b>{formatKm(restaurantToRiderKm)}</b>
        </div>
        <div>
          <small>Repartidor → cliente</small>
          <b>{formatKm(riderToCustomerKm)}</b>
        </div>
        <div>
          <small>Color de la ruta</small>
          <b className="tracking-current-route-label">Línea roja gruesa</b>
        </div>
      </div>

      <p className="tracking-route-caption">
        La ruta roja gruesa sigue las calles desde la ubicación actual del repartidor hasta el cliente. La línea verde discontinua conecta el restaurante con el repartidor.
      </p>
    </div>

    {!hasRider && <div className="tracking-map-note">
      Todavía no hay ubicación GPS válida del repartidor. La ruta roja aparecerá automáticamente en cuanto el repartidor comparta su posición.
    </div>}
  </div>;
}


function TrackOrderApp() {
  usePageChrome();
  const [orderCode, setOrderCode] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadTracking() {
    if (!orderCode || !phone) return setMessage('Introduce el código del pedido y el teléfono.');
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/orders/track/?order_code=${encodeURIComponent(orderCode)}&phone=${encodeURIComponent(phone)}`);
      setOrder(res.data);
      setMessage('');
    } catch (err) {
      setOrder(null);
      setMessage(err?.response?.data?.detail || 'No se encontró el pedido con esos datos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!order) return;
    const timer = setInterval(loadTracking, 20000);
    return () => clearInterval(timer);
  }, [order?.order_code, orderCode, phone]);

  return <div>
    <Header title="Seguimiento" subtitle="Consulta tu pedido con código y teléfono">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="guest,customer,staff,admin" onClick={() => window.location.href='/account'}>Cuenta</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page tracking-page">
      <section className="admin-hero tracking-hero">
        <div>
          <span className="admin-kicker">Pedido en reparto</span>
          <h1>Seguimiento de pedido</h1>
          <p>Introduce el código del pedido y el teléfono usado en la compra para ver el estado y la ubicación del repartidor.</p>
        </div>
      </section>
      <section className="tracking-search-card">
        <input placeholder="Código pedido: CDKT-000001" value={orderCode} onChange={e => setOrderCode(e.target.value.toUpperCase())} />
        <input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} />
        <button className="pay" disabled={loading} onClick={loadTracking}>{loading ? 'Buscando...' : 'Buscar pedido'}</button>
      </section>
      {order && <section className="tracking-result-grid">
        <div className="admin-card tracking-status-card">
          <h2>{order.order_code}</h2>
          <p><b>Estado</b><span>{order.status}</span></p>
          <p><b>Cliente</b><span>{order.customer_name || 'Sin nombre'} · {order.customer_phone}</span></p>
          <p><b>Tipo</b><span>{order.delivery_type === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'}</span></p>
          {order.address && <p><b>Dirección</b><span>{order.address}</span></p>}
          <p><b>Total</b><span>{money(order.total)}</span></p>
          <p><b>Pago</b><span>{order.payment_method} · {order.payment_status}</span></p>
          {order.assigned_rider_data ? <p><b>Repartidor</b><span>{order.assigned_rider_data.name} · {order.assigned_rider_data.phone}</span></p> : <p><b>Repartidor</b><span>Aún no asignado</span></p>}
          {order.assigned_rider_data?.last_location_at && <small>Última ubicación: {new Date(order.assigned_rider_data.last_location_at).toLocaleString()}</small>}
        </div>
        <div className="admin-card"><h2>Mapa y ruta en vivo</h2><TrackingMap order={order} /></div>
      </section>}
    </main>
  </div>;
}

function RiderApp() {
  usePageChrome();
  const [phone, setPhone] = useState(localStorage.getItem('rider_phone') || '');
  const [rider, setRider] = useState(null);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryPoint, setDeliveryPoint] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [watchId, setWatchId] = useState(null);

  async function loadRiderOrders(savedPhone = phone) {
    try {
      if (!savedPhone) return setMessage('Introduce el teléfono del repartidor.');
      setLoading(true);
      localStorage.setItem('rider_phone', savedPhone);
      const res = await axios.get(`${API_BASE}/rider/orders/?phone=${encodeURIComponent(savedPhone)}`);
      setRider(res.data.rider);
      setOrders(res.data.orders || []);
      setMessage('');
    } catch (err) {
      setRider(null);
      setOrders([]);
      setMessage('Repartidor no encontrado o sin permisos. Crea el repartidor desde Pedidos en vivo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (phone) loadRiderOrders(phone);
  }, []);

  async function updateStatus(orderCode, status) {
    try {
      await axios.patch(`${API_BASE}/orders/${orderCode}/status/`, { status });
      await loadRiderOrders(phone);
    } catch (err) {
      setMessage('No se pudo actualizar el pedido.');
    }
  }

  function sendLocation() {
    if (!navigator.geolocation) return setMessage('GPS no disponible en este navegador.');
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        await axios.post(`${API_BASE}/rider/location/`, { phone, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setMessage('Ubicación enviada correctamente.');
        await loadRiderOrders(phone);
      } catch (err) {
        setMessage('No se pudo enviar la ubicación.');
      }
    }, () => setMessage('No se pudo obtener la ubicación. Activa el GPS.'));
  }

  function startLiveLocation() {
    if (!navigator.geolocation) return setMessage('GPS no disponible en este navegador.');
    if (!phone) return setMessage('Introduce el teléfono del repartidor.');
    if (watchId) return setMessage('La ubicación en vivo ya está activa.');
    const id = navigator.geolocation.watchPosition(async pos => {
      try {
        await axios.post(`${API_BASE}/rider/location/`, { phone, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setMessage('Ubicación en vivo activa.');
      } catch (err) {
        setMessage('No se pudo enviar la ubicación en vivo.');
      }
    }, () => setMessage('No se pudo obtener la ubicación. Activa el GPS.'), { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
    setWatchId(id);
  }

  function stopLiveLocation() {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setMessage('Ubicación en vivo detenida.');
    }
  }

  return <div>
    <Header title="App Repartidor" subtitle="Casa de Kebab Turco">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page rider-app">
      <h1>Repartidor</h1>
      <div className="rider-login">
        <input placeholder="Teléfono del repartidor" value={phone} onChange={e => setPhone(e.target.value)} />
        <button disabled={loading} onClick={() => loadRiderOrders(phone)}>Entrar</button>
        <button onClick={sendLocation}>Enviar ubicación GPS</button>
        <button onClick={startLiveLocation}>Activar ubicación en vivo</button>
        <button onClick={stopLiveLocation}>Detener ubicación</button>
      </div>
      {rider && <p className="muted">Conectado como <b>{rider.name}</b> · {rider.phone}</p>}
      <div className="orders-grid">
        {orders.map(order => <article className={`order-card status-${order.status}`} key={order.id}>
          <div className="order-head"><h2>{order.order_code}</h2><strong>{money(order.total)}</strong></div>
          <button className="mini-action" onClick={() => window.open(`/receipt/${order.order_code}`, '_blank')}>Ver ticket</button>
          <p><b>Cliente:</b> {order.customer_name || 'Sin nombre'} · <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></p>
          {order.address && <p><b>Dirección:</b> {order.address}</p>}
          {order.address && <a className="map-button" href={getMapsUrl(order.address)} target="_blank" rel="noreferrer">Abrir Google Maps</a>}
          <div className="order-items">{(order.items || []).map(item => <div key={item.id}>{item.quantity} x {item.name_snapshot} <span>{money(item.total)}</span></div>)}</div>
          <OrderChatPanel orderCode={order.order_code} phone={phone} senderType="rider" closed={order.status === 'delivered'} />
          <div className="status-buttons">
            <button onClick={() => updateStatus(order.order_code, 'out_for_delivery')}>En reparto</button>
            <button onClick={() => updateStatus(order.order_code, 'delivered')}>Entregado</button>
          </div>
        </article>)}
        {rider && !orders.length && <p>No hay pedidos asignados ahora.</p>}
      </div>
    </main>
  </div>;
}



const ORDER_STATUS_LABELS = {
  pending: 'Pedido recibido', accepted: 'Aceptado', preparing: 'Preparando',
  ready: 'Listo', out_for_delivery: 'En camino', delivered: 'Entregado', cancelled: 'Cancelado'
};

function PublicReviewsSection() {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    axios.get(`${API_BASE}/reviews/public/`).then(res => setReviews(Array.isArray(res.data) ? res.data : [])).catch(() => setReviews([]));
  }, []);
  if (!reviews.length) return null;
  return <section className="public-reviews-section">
    <div className="reviews-heading"><span>Opiniones verificadas</span><h2>Lo que dicen nuestros clientes</h2></div>
    <div className="reviews-horizontal" role="region" aria-label="Opiniones de clientes">
      {reviews.map(r => <article className="review-card" key={r.id}>
        <div className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>
        <p>“{r.comment}”</p>
        <footer><b>{r.customer_name || 'Cliente'}</b><small>{new Date(r.approved_at || r.created_at).toLocaleDateString('es-ES')}</small></footer>
      </article>)}
    </div>
  </section>;
}

function SmoothRiderMap({ orderCode, phone, active }) {
  const mapBoxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const positionRef = useRef(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [notice, setNotice] = useState('Esperando la ubicación del repartidor...');

  useEffect(() => {
    if (!active || !mapBoxRef.current || mapRef.current) return;
    const map = L.map(mapBoxRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; positionRef.current = null; };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    async function refreshLocation() {
      try {
        const res = await axios.get(`${API_BASE}/orders/${encodeURIComponent(orderCode)}/location/`, { params: { phone } });
        if (cancelled) return;
        const loc = res.data?.location;
        if (!loc) { setNotice(res.data?.delivered ? 'Pedido entregado.' : 'El repartidor todavía no comparte ubicación.'); return; }
        const next = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
        setNotice(`Repartidor: ${loc.rider_name || 'En camino'}`);
        setLastUpdate(loc.updated_at ? new Date(loc.updated_at).toLocaleTimeString('es-ES') : new Date().toLocaleTimeString('es-ES'));
        if (!mapRef.current) return;
        if (!markerRef.current) {
          markerRef.current = L.marker([next.lat, next.lng], { title: 'Repartidor' }).addTo(mapRef.current).bindPopup('Repartidor en camino');
          positionRef.current = next;
          mapRef.current.setView([next.lat, next.lng], 16, { animate: true });
          return;
        }
        const start = positionRef.current || next;
        const started = performance.now();
        const duration = 900;
        function frame(now) {
          const t = Math.min(1, (now - started) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const lat = start.lat + (next.lat - start.lat) * eased;
          const lng = start.lng + (next.lng - start.lng) * eased;
          markerRef.current?.setLatLng([lat, lng]);
          if (t < 1) requestAnimationFrame(frame); else positionRef.current = next;
        }
        requestAnimationFrame(frame);
      } catch (err) { if (!cancelled) setNotice('No se pudo actualizar la ubicación.'); }
    }
    refreshLocation();
    const timer = setInterval(refreshLocation, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [active, orderCode, phone]);

  if (!active) return null;
  return <section className="live-rider-map-card">
    <div className="live-map-head"><b>Ubicación en vivo</b><span>{notice}</span>{lastUpdate && <small>Actualizado: {lastUpdate}</small>}</div>
    <div className="customer-live-map" ref={mapBoxRef}></div>
  </section>;
}

function OrderChatPanel({ orderCode, phone, senderType='customer', closed=false }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [chatClosed, setChatClosed] = useState(closed);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  async function loadChat() {
    try {
      const res = await axios.get(`${API_BASE}/orders/${encodeURIComponent(orderCode)}/chat/`, { params: { phone, sender_type: senderType } });
      setMessages(res.data?.messages || []); setChatClosed(Boolean(res.data?.chat_closed)); setError('');
    } catch (err) { setError(err.response?.data?.detail || 'No se pudo cargar el chat.'); }
  }
  useEffect(() => {
    loadChat();
    const timer = setInterval(loadChat, 4000);
    return () => clearInterval(timer);
  }, [orderCode, phone, senderType]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length]);

  async function sendMessage() {
    const value = draft.trim(); if (!value || chatClosed) return;
    try {
      await axios.post(`${API_BASE}/orders/${encodeURIComponent(orderCode)}/chat/`, { phone, sender_type: senderType, message: value });
      setDraft(''); await loadChat();
    } catch (err) { setError(err.response?.data?.detail || 'No se pudo enviar el mensaje.'); }
  }

  return <section className="order-chat-panel">
    <div className="chat-title"><b>Chat del pedido</b><span>{chatClosed ? 'Cerrado después de la entrega' : 'Cliente · Repartidor · Restaurante'}</span></div>
    {chatClosed ? <div className="chat-hidden-note">La conversación queda oculta para cliente y repartidor después de la entrega.</div> : <>
      <div className="chat-messages">{messages.map(m => <div key={m.id} className={`chat-bubble ${m.sender_type === senderType ? 'mine' : ''}`}><b>{m.sender_name || m.sender_type}</b><p>{m.message}</p><small>{new Date(m.created_at).toLocaleTimeString('es-ES')}</small></div>)}<div ref={endRef}/></div>
      <div className="chat-compose"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }} placeholder="Escribe un mensaje..."/><button onClick={sendMessage}>Enviar</button></div>
    </>}
    {error && <small className="chat-error">{error}</small>}
  </section>;
}

function OrderReviewForm({ orderCode, phone }) {
  const [rating, setRating] = useState(5); const [comment, setComment] = useState(''); const [message, setMessage] = useState('');
  async function submit() {
    try {
      const res = await axios.post(`${API_BASE}/reviews/`, { order_code: orderCode, phone, rating, comment });
      setMessage(res.data?.message || 'Opinión enviada.'); setComment('');
    } catch (err) { setMessage(err.response?.data?.detail || 'No se pudo enviar la opinión.'); }
  }
  return <section className="order-review-form"><h3>Valora tu pedido</h3><div className="review-picker">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setRating(n)} className={n <= rating ? 'active' : ''}>★</button>)}</div><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Cuéntanos tu experiencia..."/><button className="mini-action" disabled={!comment.trim()} onClick={submit}>Enviar opinión</button>{message && <p>{message}</p>}</section>;
}

function CustomerTrackingPanel({ defaultPhone='' }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [orderCode, setOrderCode] = useState('');
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState('');
  async function search() {
    try {
      const res = await axios.get(`${API_BASE}/orders/track/`, { params: { order_code: orderCode, phone } });
      setOrder(res.data); setMessage('');
    } catch (err) { setOrder(null); setMessage(err.response?.data?.detail || 'No se encontró el pedido.'); }
  }
  return <section className="customer-tracking-panel">
    <div className="tracking-search"><input value={orderCode} onChange={e => setOrderCode(e.target.value.toUpperCase())} placeholder="Número de pedido: CDKT-000001"/><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono"/><button onClick={search}>Ver estado</button></div>
    {message && <p className="tracking-error">{message}</p>}
    {order && <div className="tracking-result"><div className="tracking-status"><span>{order.order_code}</span><b>{ORDER_STATUS_LABELS[order.status] || order.status}</b><small>{new Date(order.updated_at || order.created_at).toLocaleString('es-ES')}</small></div><div className="tracking-steps">{['pending','accepted','preparing','ready','out_for_delivery','delivered'].map((s,i,arr) => { const current = arr.indexOf(order.status); return <div key={s} className={i <= current ? 'done' : ''}><i></i><span>{ORDER_STATUS_LABELS[s]}</span></div>; })}</div><SmoothRiderMap orderCode={order.order_code} phone={phone} active={order.status === 'out_for_delivery'}/><OrderChatPanel orderCode={order.order_code} phone={phone} closed={order.status === 'delivered'}/>{order.status === 'delivered' && <OrderReviewForm orderCode={order.order_code} phone={phone}/>}</div>}
  </section>;
}


function AccountApp() {
  usePageChrome();
  const sessionPhone = (typeof getSessionCustomer === 'function' ? (getSessionCustomer()?.phone || '') : '') || localStorage.getItem('customer_phone') || '';
  const [phone, setPhone] = useState(sessionPhone);
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('tracking');
  const [accountLoading, setAccountLoading] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatClosed, setChatClosed] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const statusLabels = {
    pending: 'Pedido recibido',
    accepted: 'Aceptado',
    preparing: 'Preparando',
    ready: 'Listo',
    out_for_delivery: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
  };
  const statusTone = {
    pending: 'pending',
    accepted: 'ok',
    preparing: 'warm',
    ready: 'warm',
    out_for_delivery: 'ok',
    delivered: 'done',
    cancelled: 'danger'
  };
  const stepOrder = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatDate(value) {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString('es-ES');
    } catch {
      return value;
    }
  }

  async function loadAccount(prefill = true) {
    const cleanPhone = digitsOnly(phone);
    if (cleanPhone.length < 9) {
      setMessage('Introduce un teléfono válido para ver tu cuenta.');
      return;
    }
    try {
      setAccountLoading(true);
      localStorage.setItem('customer_phone', phone);
      const res = await axios.get(`${API_BASE}/customers/orders/`, { params: { phone } });
      if (!res.data.exists) {
        setCustomer(null);
        setOrders([]);
        setTrackingOrder(null);
        setChatMessages([]);
        return setMessage('No hemos encontrado pedidos para este teléfono.');
      }
      const nextOrders = Array.isArray(res.data.orders) ? res.data.orders : [];
      setCustomer(res.data.customer || null);
      setOrders(nextOrders);
      setMessage('');
      if (prefill && nextOrders.length) {
        setTrackingCode(prev => prev || nextOrders[0].order_code || '');
      }
    } catch (err) {
      setMessage('No se pudo cargar la cuenta del cliente. Revisa el backend.');
    } finally {
      setAccountLoading(false);
    }
  }

  async function loadTracking(codeArg = trackingCode, silent = false) {
    const code = String(codeArg || '').trim().toUpperCase();
    if (!code) {
      if (!silent) setMessage('Escribe el número de pedido para ver el seguimiento.');
      return;
    }
    if (digitsOnly(phone).length < 9) {
      if (!silent) setMessage('Introduce primero un teléfono válido.');
      return;
    }
    try {
      setTrackingLoading(true);
      const res = await axios.get(`${API_BASE}/orders/track/`, { params: { order_code: code, phone } });
      setTrackingOrder(res.data);
      setTrackingCode(code);
      setMessage('');
      setReviewMessage('');
    } catch (err) {
      setTrackingOrder(null);
      setChatMessages([]);
      setChatClosed(false);
      if (!silent) setMessage(err?.response?.data?.detail || 'No se pudo cargar el seguimiento del pedido.');
    } finally {
      setTrackingLoading(false);
    }
  }

  async function loadChat(silent = true) {
    if (!trackingOrder?.order_code) return;
    try {
      const res = await axios.get(`${API_BASE}/orders/${encodeURIComponent(trackingOrder.order_code)}/chat/`, {
        params: { phone, sender_type: 'customer' }
      });
      setChatMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      setChatClosed(Boolean(res.data?.chat_closed));
      setChatError('');
    } catch (err) {
      if (!silent) setChatError(err?.response?.data?.detail || 'No se pudo cargar el chat.');
    }
  }

  async function sendChatMessage() {
    const value = chatDraft.trim();
    if (!value || !trackingOrder?.order_code || chatClosed) return;
    try {
      await axios.post(`${API_BASE}/orders/${encodeURIComponent(trackingOrder.order_code)}/chat/`, {
        phone,
        sender_type: 'customer',
        message: value
      });
      setChatDraft('');
      await loadChat(false);
    } catch (err) {
      setChatError(err?.response?.data?.detail || 'No se pudo enviar el mensaje.');
    }
  }

  async function submitReview() {
    if (!trackingOrder?.order_code || !reviewComment.trim()) return;
    try {
      const res = await axios.post(`${API_BASE}/reviews/`, {
        order_code: trackingOrder.order_code,
        phone,
        rating: reviewRating,
        comment: reviewComment
      });
      setReviewMessage(res.data?.message || 'Opinión enviada correctamente.');
      setReviewComment('');
    } catch (err) {
      setReviewMessage(err?.response?.data?.detail || 'No se pudo enviar la opinión.');
    }
  }

  function openOrder(order) {
    if (!order?.order_code) return;
    setActiveTab('tracking');
    setTrackingCode(order.order_code);
    setTrackingOrder(order);
    loadTracking(order.order_code, false);
  }

  useEffect(() => {
    if (digitsOnly(phone).length >= 9) loadAccount(true);
  }, []);

  useEffect(() => {
    if (!trackingOrder?.order_code || activeTab !== 'tracking') return;
    loadChat(true);
    const timer = setInterval(() => {
      loadTracking(trackingOrder.order_code, true);
      loadChat(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [trackingOrder?.order_code, phone, activeTab]);

  const totalSpent = orders.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const lastOrder = orders[0] || null;
  const currentStep = trackingOrder ? stepOrder.indexOf(trackingOrder.status) : -1;

  return <div>
    <Header title="Mi cuenta" subtitle="Seguimiento, chat y pedidos del cliente">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
    </Header>
    {message && <div className="toast">{message}</div>}

    <main className="orders-page account-pro-page">
      <section className="account-pro-hero">
        <div className="account-pro-copy">
          <span className="account-pro-kicker">Área de cliente</span>
          <h1>Gestiona tus pedidos con una vista profesional</h1>
          <p>Consulta el estado del pedido, abre el mapa en vivo del repartidor, escribe por chat y revisa tu historial desde una sola pantalla.</p>
          <div className="account-pro-highlights">
            <span>Actualización automática cada 5 segundos</span>
            <span>Ubicación del repartidor en tiempo real</span>
            <span>Chat directo cliente · repartidor · restaurante</span>
          </div>
        </div>

        <div className="account-pro-lookup">
          <div className="account-pro-card-head">
            <h2>Identificación del cliente</h2>
            <small>Usa tu teléfono para cargar tu cuenta</small>
          </div>
          <div className="account-pro-form-row">
            <input
              className="account-pro-input"
              placeholder="Teléfono del cliente"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <button className="account-pro-primary" disabled={accountLoading} onClick={() => loadAccount(true)}>
              {accountLoading ? 'Cargando...' : 'Cargar cuenta'}
            </button>
          </div>
          <div className="account-pro-mini-stats">
            <div><b>{customer?.total_orders || orders.length || 0}</b><span>Pedidos</span></div>
            <div><b>{money(totalSpent)}</b><span>Total gastado</span></div>
            <div><b>{lastOrder?.order_code || '-'}</b><span>Último pedido</span></div>
          </div>
        </div>
      </section>

      <section className="account-pro-shell">
        <aside className="account-pro-sidebar">
          <div className="account-pro-profile-card">
            <div className="account-pro-avatar-wrap"><img src={restaurantLogo} alt="Casa de Kebab Turco" /></div>
            <div>
              <h3>{customer?.name || 'Cliente'}</h3>
              <p>{customer?.phone || phone || 'Sin teléfono'}</p>
              <small>{customer?.default_address || 'Todavía no hay dirección guardada.'}</small>
            </div>
          </div>

          <div className="account-pro-tabs">
            <button className={activeTab === 'tracking' ? 'active' : ''} onClick={() => setActiveTab('tracking')}>
              <b>Seguimiento en vivo</b>
              <span>Mapa, estado y chat del pedido</span>
            </button>
            <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
              <b>Historial de pedidos</b>
              <span>Resumen y acceso rápido a tickets</span>
            </button>
          </div>

          <div className="account-pro-recent-card">
            <div className="account-pro-card-head">
              <h3>Pedidos recientes</h3>
              <small>Acceso rápido</small>
            </div>
            <div className="account-pro-recent-list">
              {orders.slice(0, 5).map(order => <button key={order.order_code} className="account-pro-recent-order" onClick={() => openOrder(order)}>
                <div>
                  <b>{order.order_code}</b>
                  <span>{statusLabels[order.status] || order.status}</span>
                </div>
                <strong>{money(order.total)}</strong>
              </button>)}
              {!orders.length && <div className="account-pro-empty-side">Aún no hay pedidos para este teléfono.</div>}
            </div>
          </div>
        </aside>

        <section className="account-pro-content">
          {activeTab === 'tracking' && <>
            <div className="account-pro-toolbar">
              <div className="account-pro-toolbar-copy">
                <h2>Seguimiento del pedido</h2>
                <p>Consulta el estado actual del pedido y sigue al repartidor sin recargar toda la página y visualiza la ruta entre repartidor y cliente.</p>
              </div>
              <div className="account-pro-track-form">
                <input
                  className="account-pro-input"
                  placeholder="Número de pedido: CDKT-000001"
                  value={trackingCode}
                  onChange={e => setTrackingCode(e.target.value.toUpperCase())}
                />
                <button className="account-pro-primary" disabled={trackingLoading} onClick={() => loadTracking(trackingCode, false)}>
                  {trackingLoading ? 'Buscando...' : 'Ver seguimiento'}
                </button>
              </div>
            </div>

            {!trackingOrder ? <div className="account-pro-empty-state">
              <div className="account-pro-empty-illustration">📦</div>
              <h3>Selecciona un pedido para empezar</h3>
              <p>Escribe el número del pedido o elige uno de tus pedidos recientes para abrir el mapa, el estado y el chat.</p>
            </div> : <>
              <div className="account-pro-grid-top">
                <section className="account-pro-panel account-pro-status-panel">
                  <div className="account-pro-card-head">
                    <div>
                      <small>Pedido activo</small>
                      <h3>{trackingOrder.order_code}</h3>
                    </div>
                    <span className={`account-pro-status-badge ${statusTone[trackingOrder.status] || ''}`}>{statusLabels[trackingOrder.status] || trackingOrder.status}</span>
                  </div>

                  <div className="account-pro-timeline">
                    {stepOrder.map((step, index) => <div key={step} className={index <= currentStep ? 'done' : ''}>
                      <i></i>
                      <span>{statusLabels[step]}</span>
                    </div>)}
                  </div>

                  <div className="account-pro-meta-list">
                    <div><span>Cliente</span><b>{trackingOrder.customer_name || 'Sin nombre'} · {trackingOrder.customer_phone}</b></div>
                    <div><span>Tipo</span><b>{trackingOrder.delivery_type === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'}</b></div>
                    <div><span>Pago</span><b>{trackingOrder.payment_method} · {trackingOrder.payment_status}</b></div>
                    <div><span>Fecha</span><b>{formatDate(trackingOrder.created_at)}</b></div>
                    <div><span>Dirección</span><b>{trackingOrder.address || 'Recogida en tienda'}</b></div>
                    <div><span>Repartidor</span><b>{trackingOrder.assigned_rider_data ? `${trackingOrder.assigned_rider_data.name || 'Repartidor'} · ${trackingOrder.assigned_rider_data.phone || ''}` : 'Aún no asignado'}</b></div>
                  </div>

                  <div className="account-pro-action-row">
                    <button className="account-pro-secondary" onClick={() => window.open(`/receipt/${trackingOrder.order_code}`, '_blank')}>Imprimir ticket</button>
                    {trackingOrder.address && <button className="account-pro-secondary" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trackingOrder.address)}`, '_blank')}>Abrir dirección</button>}
                  </div>
                </section>

                <section className="account-pro-panel account-pro-map-panel">
                  <div className="account-pro-card-head">
                    <div>
                      <h3>Mapa y ruta en vivo del repartidor</h3>
                      <small>Solo el mapa se refresca de forma suave cada 5 segundos</small>
                    </div>
                    {trackingOrder.assigned_rider_data?.last_location_at && <span className="account-pro-live-chip">Actualizado {new Date(trackingOrder.assigned_rider_data.last_location_at).toLocaleTimeString('es-ES')}</span>}
                  </div>
                  <TrackingMap order={trackingOrder} />
                </section>
              </div>

              <div className="account-pro-grid-bottom">
                <section className="account-pro-panel account-pro-chat-panel">
                  <div className="account-pro-card-head">
                    <div>
                      <h3>Chat del pedido</h3>
                      <small>{chatClosed ? 'El chat se oculta después de la entrega' : 'Habla con el repartidor o con el restaurante'}</small>
                    </div>
                    <span className="account-pro-live-chip">Auto refresh</span>
                  </div>

                  {chatClosed ? <div className="account-pro-chat-closed">La conversación queda oculta para cliente y repartidor después de la entrega.</div> : <>
                    <div className="account-pro-chat-list">
                      {chatMessages.map(row => <div key={row.id} className={`account-pro-chat-bubble ${row.sender_type === 'customer' ? 'mine' : ''}`}>
                        <b>{row.sender_name || row.sender_type}</b>
                        <p>{row.message}</p>
                        <small>{formatDate(row.created_at)}</small>
                      </div>)}
                      {!chatMessages.length && <div className="account-pro-chat-empty">Todavía no hay mensajes. Puedes enviar el primero.</div>}
                    </div>
                    <div className="account-pro-chat-compose">
                      <input
                        className="account-pro-input"
                        value={chatDraft}
                        onChange={e => setChatDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(); }}
                        placeholder="Escribe tu mensaje..."
                      />
                      <button className="account-pro-primary" onClick={sendChatMessage}>Enviar</button>
                    </div>
                  </>}
                  {chatError && <small className="account-pro-error">{chatError}</small>}
                </section>

                <section className="account-pro-panel account-pro-order-panel">
                  <div className="account-pro-card-head">
                    <div>
                      <h3>Detalle del pedido</h3>
                      <small>Productos, importe y valoración</small>
                    </div>
                    <strong>{money(trackingOrder.total)}</strong>
                  </div>

                  <div className="account-pro-items">
                    {(trackingOrder.items || []).map(item => <div key={item.id} className="account-pro-item-row">
                      <div>
                        <b>{item.quantity} × {item.name_snapshot}</b>
                        {item.options_snapshot && <small>{item.options_snapshot}</small>}
                      </div>
                      <span>{money(item.total)}</span>
                    </div>)}
                  </div>

                  <div className="account-pro-order-total">
                    <span>Total del pedido</span>
                    <b>{money(trackingOrder.total)}</b>
                  </div>

                  {trackingOrder.status === 'delivered' && <div className="account-pro-review-box">
                    <div className="account-pro-card-head compact">
                      <div>
                        <h3>Valora tu experiencia</h3>
                        <small>Tu opinión puede mostrarse después de la aprobación del administrador</small>
                      </div>
                    </div>
                    <div className="account-pro-stars">
                      {[1,2,3,4,5].map(n => <button key={n} className={n <= reviewRating ? 'active' : ''} onClick={() => setReviewRating(n)}>★</button>)}
                    </div>
                    <textarea
                      className="account-pro-textarea"
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      placeholder="Cuéntanos cómo fue el pedido, la entrega y la calidad de la comida..."
                    />
                    <button className="account-pro-primary" disabled={!reviewComment.trim()} onClick={submitReview}>Enviar opinión</button>
                    {reviewMessage && <small className="account-pro-review-message">{reviewMessage}</small>}
                  </div>}
                </section>
              </div>
            </>}
          </>}

          {activeTab === 'history' && <>
            <div className="account-pro-toolbar history">
              <div className="account-pro-toolbar-copy">
                <h2>Historial de pedidos</h2>
                <p>Accede rápidamente a tus pedidos anteriores, tickets y seguimiento.</p>
              </div>
            </div>

            <section className="summary-cards account-pro-summary-cards">
              <div><b>{customer?.name || 'Cliente'}</b><span>{customer?.phone || phone || 'Sin teléfono'}</span></div>
              <div><b>{customer?.total_orders || orders.length || 0}</b><span>Pedidos registrados</span></div>
              <div><b>{money(totalSpent)}</b><span>Importe acumulado</span></div>
              <div><b>{customer?.default_address || 'Sin dirección'}</b><span>Última dirección</span></div>
            </section>

            <div className="account-pro-history-grid">
              {orders.map(order => <article className={`order-card account-pro-history-card status-${order.status}`} key={order.id || order.order_code}>
                <div className="order-head"><h2>{order.order_code}</h2><strong>{money(order.total)}</strong></div>
                <div className="account-pro-history-meta">
                  <p><b>Estado</b><span>{statusLabels[order.status] || order.status}</span></p>
                  <p><b>Pago</b><span>{order.payment_method} · {order.payment_status}</span></p>
                  <p><b>Fecha</b><span>{formatDate(order.created_at)}</span></p>
                </div>
                <div className="order-items">{(order.items || []).map(item => <div key={item.id}>{item.quantity} × {item.name_snapshot}<span>{money(item.total)}</span></div>)}</div>
                <div className="account-pro-history-actions">
                  <button className="account-pro-secondary" onClick={() => openOrder(order)}>Seguir pedido</button>
                  <button className="account-pro-secondary" onClick={() => window.open(`/receipt/${order.order_code}`, '_blank')}>Ver ticket</button>
                </div>
              </article>)}
              {!orders.length && <div className="account-pro-empty-state slim"><h3>No hay pedidos todavía</h3><p>Cuando el cliente realice un pedido, aparecerá aquí con su resumen y acciones rápidas.</p></div>}
            </div>
          </>}
        </section>
      </section>
    </main>
  </div>;
}



function AdminLoginApp() {
  usePageChrome();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (getAdminToken()) {
      window.location.href = '/dashboard';
    }
  }, []);

  async function submitAdminLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`${API_BASE}/auth/admin/login/`, { username, password });
      setAdminSession(res.data.token, res.data.user);
      window.location.href = '/dashboard';
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'نام کاربری یا رمز عبور ادمین اشتباه است.');
    } finally {
      setLoading(false);
    }
  }

  return <div>
    <Header title="Acceso Admin" subtitle="Casa de Kebab Turco">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
    </Header>
    <main className="admin-login-page">
      <section className="admin-login-card">
        <img src={restaurantLogo} alt="Casa de Kebab Turco" />
        <span className="admin-kicker">Panel privado</span>
        <h1>ورود مدیر رستوران</h1>
        <p className="muted">برای ورود به داشبورد حرفه‌ای، نام کاربری و رمز عبور Django Admin را وارد کن.</p>
        {message && <div className="admin-login-error">{message}</div>}
        <form onSubmit={submitAdminLogin}>
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="مثلاً admin" autoComplete="username" />
          <label>Password</label>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز عبور" type="password" autoComplete="current-password" />
          <button className="pay" disabled={loading}>{loading ? 'در حال ورود...' : 'ورود به Admin PRO'}</button>
        </form>
        <div className="admin-login-links">
          <button className="mini-action" onClick={() => window.open('http://127.0.0.1:8000/admin/', '_blank')}>Django Admin</button>
          <button className="mini-action" onClick={() => window.location.href='/'}>بازگشت به سایت</button>
        </div>
        <p className="muted small-help">اگر هنوز کاربر ادمین نداری: <code>python manage.py createsuperuser</code></p>
      </section>
    </main>
  </div>;
}

function ReportBars({ rows = [], labelKey = 'label', valueKey = 'revenue', moneyValues = false, emptyText = 'Sin datos para este filtro.' }) {
  const maxValue = Math.max(...rows.map(row => Number(row?.[valueKey] || 0)), 1);
  if (!rows.length) return <p className="muted">{emptyText}</p>;
  return <div className="report-bars">
    {rows.map((row, index) => {
      const value = Number(row?.[valueKey] || 0);
      const width = Math.max(4, Math.round((value / maxValue) * 100));
      return <div className="report-bar-row" key={`${row?.[labelKey] || 'row'}-${index}`}>
        <div className="report-bar-label">
          <span>{row?.[labelKey] || '-'}</span>
          <b>{moneyValues ? money(value) : value}</b>
        </div>
        <div className="report-bar-track"><div className="report-bar-fill" style={{ width: `${width}%` }}></div></div>
      </div>;
    })}
  </div>;
}


function ProfitabilityPanel({
  items = [],
  ingredients = [],
  report,
  loading,
  onRefresh,
  onCreateIngredient,
  onSaveRecipe,
  onDeleteIngredient,
}) {
  const [ingredientForm, setIngredientForm] = useState({ name: '', unit: 'g', unit_cost: '', stock_quantity: '', reorder_level: '', supplier_name: '' });
  const [selectedItemId, setSelectedItemId] = useState('');
  const [recipe, setRecipe] = useState({ packaging_cost: '0', fixed_cost: '0', target_margin_percent: '55', notes: '', components: [] });
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { date_from: start.toISOString().slice(0, 10), date_to: today.toISOString().slice(0, 10) };
  });

  const selectedReportItem = useMemo(
    () => (report?.items || []).find(row => String(row.menu_item_id) === String(selectedItemId)),
    [report, selectedItemId]
  );

  useEffect(() => {
    if (!selectedItemId && items.length) setSelectedItemId(String(items[0].id));
  }, [items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) return;
    const current = (report?.items || []).find(row => String(row.menu_item_id) === String(selectedItemId));
    setRecipe({
      packaging_cost: String(current?.packaging_cost ?? '0'),
      fixed_cost: String(current?.fixed_cost ?? '0'),
      target_margin_percent: String(current?.target_margin_percent ?? '55'),
      notes: current?.notes || '',
      components: (current?.components || []).map(row => ({ ingredient_id: String(row.ingredient_id), quantity: String(row.quantity) })),
    });
  }, [selectedItemId, report]);

  const addComponent = () => {
    const first = ingredients.find(row => row.is_active);
    if (!first) return;
    setRecipe(current => ({ ...current, components: [...current.components, { ingredient_id: String(first.id), quantity: '' }] }));
  };

  const saveIngredient = async event => {
    event.preventDefault();
    await onCreateIngredient({
      ...ingredientForm,
      unit_cost: ingredientForm.unit_cost || '0',
      stock_quantity: ingredientForm.stock_quantity || '0',
      reorder_level: ingredientForm.reorder_level || '0',
    });
    setIngredientForm({ name: '', unit: 'g', unit_cost: '', stock_quantity: '', reorder_level: '', supplier_name: '' });
  };

  const saveRecipe = async event => {
    event.preventDefault();
    if (!selectedItemId) return;
    await onSaveRecipe(selectedItemId, {
      ...recipe,
      components: recipe.components.filter(row => row.ingredient_id && Number(row.quantity) > 0),
    });
  };

  return <section className="profitability-page">
    <section className="admin-card profitability-header-card">
      <div>
        <span className="admin-kicker">Costes y margen</span>
        <h2>Rentabilidad real por producto</h2>
        <p className="muted">Calcula el coste de ingredientes, envase y coste fijo por unidad. No cambia categorías ni precios del menú.</p>
      </div>
      <div className="profitability-period">
        <label>Desde<input type="date" value={period.date_from} onChange={e => setPeriod({...period, date_from: e.target.value})} /></label>
        <label>Hasta<input type="date" value={period.date_to} onChange={e => setPeriod({...period, date_to: e.target.value})} /></label>
        <button type="button" className="mini-action" onClick={() => onRefresh(period)} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar análisis'}</button>
      </div>
    </section>

    <section className="profit-summary-grid">
      <article><span>Productos configurados</span><b>{report?.summary?.configured_products || 0}</b></article>
      <article><span>Ingresos del periodo</span><b>{money(report?.summary?.sales_revenue)}</b></article>
      <article><span>Coste estimado vendido</span><b>{money(report?.summary?.estimated_cost_of_sales)}</b></article>
      <article><span>Beneficio bruto estimado</span><b>{money(report?.summary?.estimated_gross_profit)}</b></article>
      <article className={(report?.summary?.products_below_target || 0) ? 'profit-warning-card' : ''}><span>Bajo margen objetivo</span><b>{report?.summary?.products_below_target || 0}</b></article>
    </section>

    <section className="profitability-grid">
      <article className="admin-card ingredient-manager-card">
        <h2>Ingredientes y costes</h2>
        <form className="profitability-form" onSubmit={saveIngredient}>
          <input required placeholder="Ingrediente: Pollo, patatas, envase..." value={ingredientForm.name} onChange={e => setIngredientForm({...ingredientForm, name:e.target.value})} />
          <div className="profitability-inline">
            <select value={ingredientForm.unit} onChange={e => setIngredientForm({...ingredientForm, unit:e.target.value})}><option value="g">Gramos (g)</option><option value="ml">Mililitros (ml)</option><option value="unit">Unidad</option></select>
            <input required type="number" min="0" step="0.0001" placeholder="Coste por unidad" value={ingredientForm.unit_cost} onChange={e => setIngredientForm({...ingredientForm, unit_cost:e.target.value})} />
          </div>
          <div className="profitability-inline">
            <input type="number" min="0" step="0.01" placeholder="Stock actual (opcional)" value={ingredientForm.stock_quantity} onChange={e => setIngredientForm({...ingredientForm, stock_quantity:e.target.value})} />
            <input type="number" min="0" step="0.01" placeholder="Alerta de reposición" value={ingredientForm.reorder_level} onChange={e => setIngredientForm({...ingredientForm, reorder_level:e.target.value})} />
          </div>
          <input placeholder="Proveedor (opcional)" value={ingredientForm.supplier_name} onChange={e => setIngredientForm({...ingredientForm, supplier_name:e.target.value})} />
          <button className="pay" type="submit">Añadir ingrediente</button>
        </form>
        <div className="ingredient-list">
          {ingredients.map(row => <div key={row.id} className="ingredient-row">
            <div><b>{row.name}</b><small>{money(row.unit_cost)} / {row.unit} · Stock: {row.stock_quantity}</small></div>
            <button type="button" onClick={() => onDeleteIngredient(row)}>Eliminar</button>
          </div>)}
          {!ingredients.length && <p className="muted">Añade primero los ingredientes y sus costes de compra.</p>}
        </div>
      </article>

      <article className="admin-card recipe-editor-card">
        <h2>Receta y coste del producto</h2>
        <form className="profitability-form" onSubmit={saveRecipe}>
          <label>Producto del menú
            <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
              {items.map(item => <option key={item.id} value={item.id}>{item.name_es} · {money(item.price)}</option>)}
            </select>
          </label>
          <div className="profitability-inline">
            <label>Envase por unidad<input type="number" min="0" step="0.01" value={recipe.packaging_cost} onChange={e => setRecipe({...recipe, packaging_cost:e.target.value})} /></label>
            <label>Coste fijo por unidad<input type="number" min="0" step="0.01" value={recipe.fixed_cost} onChange={e => setRecipe({...recipe, fixed_cost:e.target.value})} /></label>
          </div>
          <label>Margen objetivo (%)<input type="number" min="0" max="100" step="0.01" value={recipe.target_margin_percent} onChange={e => setRecipe({...recipe, target_margin_percent:e.target.value})} /></label>
          <label>Notas de receta<textarea value={recipe.notes} onChange={e => setRecipe({...recipe, notes:e.target.value})} placeholder="Ejemplo: incluye salsa blanca y roja." /></label>
          <h3>Componentes por una unidad</h3>
          {recipe.components.map((row, index) => <div className="recipe-component-row" key={`${row.ingredient_id}-${index}`}>
            <select value={row.ingredient_id} onChange={e => setRecipe(current => ({...current, components: current.components.map((x,i) => i === index ? {...x, ingredient_id:e.target.value} : x)}))}>
              {ingredients.filter(x => x.is_active).map(ingredient => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
            </select>
            <input type="number" min="0.001" step="0.001" placeholder="Cantidad" value={row.quantity} onChange={e => setRecipe(current => ({...current, components: current.components.map((x,i) => i === index ? {...x, quantity:e.target.value} : x)}))} />
            <button type="button" onClick={() => setRecipe(current => ({...current, components: current.components.filter((_,i) => i !== index)}))}>×</button>
          </div>)}
          <button type="button" className="add-recipe-component" onClick={addComponent} disabled={!ingredients.filter(x => x.is_active).length}>+ Añadir ingrediente a receta</button>
          {selectedReportItem && <div className="recipe-live-result"><span>Coste actual estimado:</span><b>{money(selectedReportItem.total_unit_cost)}</b><span>Beneficio bruto/unidad:</span><b>{money(selectedReportItem.gross_profit_per_unit)} · {Number(selectedReportItem.margin_percent || 0).toFixed(1)}%</b></div>}
          <button className="pay" type="submit">Guardar receta y recalcular</button>
        </form>
      </article>
    </section>

    <section className="admin-card profitability-report-card">
      <h2>Informe de rentabilidad</h2>
      <div className="admin-table-wrap">
        <table className="admin-table profit-table">
          <thead><tr><th>Producto</th><th>Precio</th><th>Coste unidad</th><th>Beneficio/unidad</th><th>Margen</th><th>Unidades vendidas</th><th>Ingresos</th><th>Beneficio periodo</th></tr></thead>
          <tbody>
            {(report?.items || []).map(row => <tr key={row.menu_item_id} className={row.margin_percent < row.target_margin_percent ? 'low-margin-row' : ''}>
              <td><b>{row.menu_item_name}</b>{!row.has_recipe && <small>Sin ingredientes definidos</small>}</td>
              <td>{money(row.selling_price)}</td><td>{money(row.total_unit_cost)}</td><td>{money(row.gross_profit_per_unit)}</td>
              <td><b>{Number(row.margin_percent || 0).toFixed(1)}%</b><small>Objetivo {row.target_margin_percent}%</small></td>
              <td>{row.units_sold}</td><td>{money(row.sales_revenue)}</td><td>{money(row.estimated_gross_profit)}</td>
            </tr>)}
            {!(report?.items || []).length && <tr><td colSpan="8" className="muted">Aún no hay recetas configuradas. Añade ingredientes y define una receta por producto.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </section>;
}

function DashboardApp() {
  usePageChrome();
  if (!getAdminToken()) return <AdminLoginApp />;
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState('');
  const emptyRiderForm = {
    id: null,
    name: '',
    phone: '',
    username: '',
    password: '',
    is_active: true,
  };
  const [riderForm, setRiderForm] = useState(emptyRiderForm);
  const [riderSaving, setRiderSaving] = useState(false);
  const [showRiderPassword, setShowRiderPassword] = useState(false);
  const emptyAccountingForm = {
    id: null,
    entry_type: 'expense',
    title: '',
    description: '',
    amount: '',
    entry_date: new Date().toISOString().slice(0, 10),
    category: '',
    paid_by: 'saeid',
    contribution_from: 'saeid',
    settlement_to: 'ahmed',
    payment_method: 'cash',
    invoice_number: '',
    bank_reference: '',
    status: 'approved',
    receipt: null,
  };
  const [accountingSummary, setAccountingSummary] = useState(null);
  const [financialEntries, setFinancialEntries] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [accountingForm, setAccountingForm] = useState(emptyAccountingForm);
  const [accountingSaving, setAccountingSaving] = useState(false);
  const [accountingSearch, setAccountingSearch] = useState('');
  const [accountingPartyFilter, setAccountingPartyFilter] = useState('');
  const [accountingTypeFilter, setAccountingTypeFilter] = useState('');
  const [accountingSettingsForm, setAccountingSettingsForm] = useState({
    saeid_share_percent: '50.00',
    ahmed_share_percent: '50.00',
    bbva_initial_balance: '0.00',
  });
  const [systemHealth, setSystemHealth] = useState(null);
  const [systemBackups, setSystemBackups] = useState([]);
  const [backupWorking, setBackupWorking] = useState(false);
  const [profitIngredients, setProfitIngredients] = useState([]);
  const [profitabilityReport, setProfitabilityReport] = useState(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState(() => {
    const today = new Date();
    const before = new Date(today);
    before.setDate(before.getDate() - 29);
    return { date_from: before.toISOString().slice(0, 10), date_to: today.toISOString().slice(0, 10), delivery_type: '', payment_method: '', rider_id: '', status: '' };
  });

  function reportQueryString() {
    const params = new URLSearchParams();
    Object.entries(reportFilters).forEach(([key, value]) => {
      if (String(value || '').trim()) params.set(key, value);
    });
    return params.toString();
  }

  async function loadDynamicReports() {
    try {
      setReportLoading(true);
      const response = await axios.get(`${API_BASE}/admin/reports/dynamic/?${reportQueryString()}`);
      setReportData(response.data || null);
      setMessage('');
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudieron cargar los reportes dinámicos.');
    } finally {
      setReportLoading(false);
    }
  }

  function setQuickReportRange(days) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    setReportFilters(current => ({ ...current, date_from: start.toISOString().slice(0, 10), date_to: today.toISOString().slice(0, 10) }));
  }

  function exportDynamicReportCsv() {
    if (!reportData) return;
    const lines = [
      ['Casa de Kebab Turco - Reporte dinámico'],
      ['Desde', reportData.filters?.date_from || ''],
      ['Hasta', reportData.filters?.date_to || ''],
      [],
      ['Indicador', 'Valor'],
      ['Pedidos', reportData.metrics?.orders_count || 0],
      ['Facturación', reportData.metrics?.revenue || 0],
      ['Ticket medio', reportData.metrics?.average_order || 0],
      ['Entregas', reportData.metrics?.delivery_orders || 0],
      ['Recogidas', reportData.metrics?.collection_orders || 0],
      ['Cancelados', reportData.metrics?.cancelled_orders || 0],
      [],
      ['Producto', 'Unidades', 'Ingresos'],
      ...(reportData.top_items || []).map(x => [x.name, x.quantity, x.revenue]),
      [],
      ['Día', 'Pedidos', 'Ingresos'],
      ...(reportData.daily_sales || []).map(x => [x.day, x.orders, x.revenue]),
    ];
    const csv = '\ufeff' + lines.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-casa-kebab-${reportData.filters?.date_from || 'inicio'}-${reportData.filters?.date_to || 'fin'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openAccountingPdf(reportType = 'summary') {
    const reportLabels = {
      summary: 'Resumen contable',
      ledger: 'Libro de movimientos',
      expenses: 'Informe de gastos',
      bbva: 'Movimientos BBVA',
      settlements: 'Liquidaciones entre socios',
    };

    const allRows = Array.isArray(financialEntries) ? financialEntries : [];
    const rows = allRows.filter(row => {
      if (reportType === 'expenses') return row.entry_type === 'expense';
      if (reportType === 'bbva') return row.payment_method === 'bbva' || row.paid_by === 'bbva' || row.entry_type === 'contribution';
      if (reportType === 'settlements') return row.entry_type === 'settlement';
      return true;
    });

    const escapePdfHtml = value => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const reportTitle = reportLabels[reportType] || 'Reporte contable';
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const summary = accountingSummary || {};
    const generatedAt = new Date().toLocaleString('es-ES');

    const bodyRows = rows.length
      ? rows.map(row => `
          <tr>
            <td>${escapePdfHtml(row.entry_date || '-')}</td>
            <td>${escapePdfHtml(row.title || '-')}</td>
            <td>${escapePdfHtml(row.entry_type || '-')}</td>
            <td>${escapePdfHtml(row.category_name || row.category?.name || '-')}</td>
            <td>${escapePdfHtml(row.paid_by || '-')}</td>
            <td>${escapePdfHtml(row.payment_method || '-')}</td>
            <td>${escapePdfHtml(row.status || '-')}</td>
            <td class="amount">${money(row.amount)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="8" class="empty">No hay movimientos para este informe.</td></tr>';

    const extraSummary = reportType === 'summary' ? `
      <section class="summary-grid">
        <article><span>Gastos este mes</span><b>${money(summary.month_expenses)}</b></article>
        <article><span>Gastos históricos</span><b>${money(summary.total_expenses)}</b></article>
        <article><span>Saldo BBVA</span><b>${money(summary.bbva_balance)}</b></article>
        <article><span>Pagado por Saeid</span><b>${money(summary.saeid_expenses)}</b></article>
        <article><span>Pagado por Ahmed</span><b>${money(summary.ahmed_expenses)}</b></article>
        <article><span>Liquidación</span><b>${escapePdfHtml(Number(summary.settlement?.amount || 0) > 0 ? `${summary.settlement.debtor} debe ${money(summary.settlement.amount)} a ${summary.settlement.creditor}` : 'Socios equilibrados')}</b></article>
      </section>
    ` : '';

    const popup = window.open('', '_blank', 'width=1100,height=820');
    if (!popup) {
      setMessage('El navegador bloqueó la ventana del PDF. Permite ventanas emergentes e inténtalo de nuevo.');
      return;
    }

    popup.document.open();
    popup.document.write(`<!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapePdfHtml(reportTitle)} | Casa de Kebab Turco</title>
        <style>
          *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#1b1714;margin:0;background:#f4f1ed;padding:24px}
          .sheet{max-width:1120px;margin:0 auto;background:#fff;padding:34px;border:1px solid #ddd;box-shadow:0 8px 28px rgba(0,0,0,.08)}
          .head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #8f1d18;padding-bottom:18px;margin-bottom:20px}
          h1{margin:0 0 5px;font-size:29px;color:#611d18}h2{margin:28px 0 12px;font-size:19px}.muted{color:#6d625b;font-size:13px;margin:4px 0}
          .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.summary-grid article{border:1px solid #e1d5c9;border-radius:10px;padding:12px;background:#fffaf5}.summary-grid span{display:block;color:#755e50;font-size:12px;font-weight:700}.summary-grid b{display:block;font-size:17px;margin-top:6px;color:#3d2019}
          table{width:100%;border-collapse:collapse;font-size:12px}th{background:#8f1d18;color:#fff;text-align:left;padding:9px}td{border-bottom:1px solid #eadfd5;padding:8px;vertical-align:top}.amount{text-align:right;font-weight:700}.empty{text-align:center;color:#766b63;padding:26px}
          .total{margin-top:16px;text-align:right;font-size:16px}.total b{color:#8f1d18}
          @media print{body{padding:0;background:#fff}.sheet{border:0;box-shadow:none;max-width:none;padding:0}@page{size:A4 landscape;margin:12mm}.no-print{display:none}}
        </style>
      </head>
      <body>
        <main class="sheet">
          <section class="head">
            <div>
              <h1>Casa de Kebab Turco</h1>
              <p class="muted">Calle García Lorca, 1 · Salamanca 37004</p>
              <p class="muted">Informe: ${escapePdfHtml(reportTitle)}</p>
            </div>
            <div>
              <p class="muted"><b>Generado:</b> ${escapePdfHtml(generatedAt)}</p>
              <p class="muted"><b>Movimientos incluidos:</b> ${rows.length}</p>
            </div>
          </section>
          ${extraSummary}
          <h2>${escapePdfHtml(reportTitle)}</h2>
          <table>
            <thead><tr><th>Fecha</th><th>Título</th><th>Tipo</th><th>Categoría</th><th>Pagado por</th><th>Método</th><th>Estado</th><th>Importe</th></tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
          <p class="total">Total de movimientos: <b>${money(total)}</b></p>
          <p class="muted">Para guardar este informe como PDF, selecciona “Guardar como PDF” en la ventana de impresión.</p>
          <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:10px 14px;border:0;border-radius:8px;background:#8f1d18;color:#fff;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button>
        </main>
      </body></html>`);
    popup.document.close();
    window.setTimeout(() => popup.print(), 450);
  }


  async function loadProfitability(period = {}) {
    try {
      setProfitabilityLoading(true);
      const params = new URLSearchParams();
      if (period.date_from) params.set('date_from', period.date_from);
      if (period.date_to) params.set('date_to', period.date_to);
      const [ingredientsRes, reportRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/profitability/ingredients/`),
        axios.get(`${API_BASE}/admin/profitability/report/?${params.toString()}`),
      ]);
      setProfitIngredients(ingredientsRes.data || []);
      setProfitabilityReport(reportRes.data || null);
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo cargar el análisis de rentabilidad.');
    } finally {
      setProfitabilityLoading(false);
    }
  }

  async function createProfitIngredient(payload) {
    try {
      await axios.post(`${API_BASE}/admin/profitability/ingredients/`, payload);
      setMessage('Ingrediente añadido correctamente.');
      await loadProfitability();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo añadir el ingrediente.');
    }
  }

  async function deleteProfitIngredient(row) {
    if (!window.confirm(`¿Eliminar el ingrediente "${row.name}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/admin/profitability/ingredients/${row.id}/`);
      setMessage('Ingrediente eliminado.');
      await loadProfitability();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo eliminar el ingrediente.');
    }
  }

  async function saveProfitRecipe(menuItemId, payload) {
    try {
      await axios.put(`${API_BASE}/admin/profitability/recipes/${menuItemId}/`, payload);
      setMessage('Receta guardada y rentabilidad recalculada.');
      await loadProfitability();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo guardar la receta.');
    }
  }

  async function loadAdminPanel() {
    try {
      const [summaryRes, ordersRes, ridersRes, customersRes, catRes, itemRes, settingsRes, accountingRes, entriesRes, expenseCategoriesRes, healthRes, backupsRes] = await Promise.all([
        axios.get(`${API_BASE}/dashboard/summary/`),
        axios.get(`${API_BASE}/orders/live/?limit=80`),
        axios.get(`${API_BASE}/riders/`),
        axios.get(`${API_BASE}/admin/customers/`),
        axios.get(`${API_BASE}/admin/categories/`),
        axios.get(`${API_BASE}/admin/menu-items/`),
        axios.get(`${API_BASE}/admin/settings/`),
        axios.get(`${API_BASE}/admin/accounting/summary/`),
        axios.get(`${API_BASE}/admin/accounting/entries/?limit=500`),
        axios.get(`${API_BASE}/admin/accounting/categories/`),
        axios.get(`${API_BASE}/admin/system/health/`),
        axios.get(`${API_BASE}/admin/system/backups/`),
      ]);
      setData(summaryRes.data);
      setOrders(ordersRes.data || []);
      setRiders(ridersRes.data || []);
      setCustomers(customersRes.data || []);
      setCategories(catRes.data || []);
      setItems(itemRes.data || []);
      setSettings(settingsRes.data || null);
      setAccountingSummary(accountingRes.data || null);
      setFinancialEntries(entriesRes.data || []);
      setExpenseCategories(expenseCategoriesRes.data || []);
      setSystemHealth(healthRes.data || null);
      setSystemBackups(backupsRes.data || []);
      if (accountingRes.data?.settings) {
        setAccountingSettingsForm({
          saeid_share_percent: String(accountingRes.data.settings.saeid_share_percent || '50.00'),
          ahmed_share_percent: String(accountingRes.data.settings.ahmed_share_percent || '50.00'),
          bbva_initial_balance: String(accountingRes.data.settings.bbva_initial_balance || '0.00'),
        });
      }
      setMessage('');
    } catch (err) {
      setMessage('No se pudo cargar el panel admin. Revisa backend y permisos.');
    }
  }

  useEffect(() => {
    loadAdminPanel();
    const timer = setInterval(loadAdminPanel, 15000);
    return () => clearInterval(timer);
  }, []);

  async function quickStatus(orderCode, status) {
    try {
      await axios.patch(`${API_BASE}/orders/${orderCode}/status/`, { status });
      await loadAdminPanel();
    } catch (err) {
      setMessage('No se pudo actualizar el estado del pedido.');
    }
  }

  async function quickPayment(orderCode, payment_status) {
    try {
      await axios.patch(`${API_BASE}/orders/${orderCode}/payment/`, { payment_status });
      await loadAdminPanel();
    } catch (err) {
      setMessage('No se pudo actualizar el pago.');
    }
  }

  function startEditRider(rider) {
    setRiderForm({
      id: rider.id,
      name: rider.name || '',
      phone: rider.phone || '',
      username: rider.username || '',
      password: '',
      is_active: Boolean(rider.is_active),
    });
    setShowRiderPassword(false);
    window.setTimeout(() => {
      document.getElementById('admin-rider-editor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }

  function resetRiderForm() {
    setRiderForm(emptyRiderForm);
    setShowRiderPassword(false);
  }

  function riderErrorText(error) {
    const errors = error?.response?.data?.errors;
    if (errors) {
      return Object.values(errors).filter(Boolean).join(' ');
    }
    return error?.response?.data?.detail || 'No se pudo guardar el repartidor.';
  }

  async function saveRiderFromAdmin(e) {
    e?.preventDefault();
    const payload = {
      name: riderForm.name.trim(),
      phone: riderForm.phone.trim(),
      username: riderForm.username.trim(),
      password: riderForm.password,
      is_active: riderForm.is_active,
    };

    if (!payload.name || !payload.phone || !payload.username) {
      setMessage('Nombre, teléfono y nombre de usuario son obligatorios.');
      return;
    }
    if (!riderForm.id && !payload.password) {
      setMessage('La contraseña es obligatoria para un repartidor nuevo.');
      return;
    }
    if (payload.password && payload.password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setRiderSaving(true);
      if (riderForm.id) {
        await axios.patch(`${API_BASE}/riders/${riderForm.id}/`, payload);
        setMessage('Repartidor actualizado correctamente.');
      } else {
        await axios.post(`${API_BASE}/riders/`, payload);
        setMessage('Repartidor creado correctamente.');
      }
      resetRiderForm();
      await loadAdminPanel();
    } catch (err) {
      setMessage(riderErrorText(err));
    } finally {
      setRiderSaving(false);
    }
  }

  async function toggleRiderFromAdmin(rider) {
    const nextActive = !rider.is_active;
    const action = nextActive ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Seguro que deseas ${action} a ${rider.name}?`)) return;

    try {
      setRiderSaving(true);
      await axios.patch(`${API_BASE}/riders/${rider.id}/`, {
        name: rider.name,
        phone: rider.phone,
        username: rider.username,
        is_active: nextActive,
      });
      setMessage(`Repartidor ${nextActive ? 'activado' : 'desactivado'} correctamente.`);
      if (riderForm.id === rider.id) {
        setRiderForm(current => ({ ...current, is_active: nextActive }));
      }
      await loadAdminPanel();
    } catch (err) {
      setMessage(riderErrorText(err));
    } finally {
      setRiderSaving(false);
    }
  }

  function resetAccountingForm() {
    setAccountingForm({
      ...emptyAccountingForm,
      entry_date: new Date().toISOString().slice(0, 10),
    });
  }

  function editFinancialEntry(entry) {
    setAccountingForm({
      id: entry.id,
      entry_type: entry.entry_type || 'expense',
      title: entry.title || '',
      description: entry.description || '',
      amount: entry.amount || '',
      entry_date: entry.entry_date || new Date().toISOString().slice(0, 10),
      category: entry.category || '',
      paid_by: entry.paid_by || 'saeid',
      contribution_from: entry.contribution_from || 'saeid',
      settlement_to: entry.settlement_to || 'ahmed',
      payment_method: entry.payment_method || 'cash',
      invoice_number: entry.invoice_number || '',
      bank_reference: entry.bank_reference || '',
      status: entry.status || 'approved',
      receipt: null,
    });
    window.setTimeout(() => {
      document.getElementById('accounting-entry-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }

  async function saveFinancialEntry(e) {
    e?.preventDefault();
    if (!accountingForm.title.trim() || !accountingForm.amount) {
      setMessage('Título y cantidad son obligatorios.');
      return;
    }

    const formData = new FormData();
    Object.entries(accountingForm).forEach(([key, value]) => {
      if (key === 'id' || key === 'receipt') return;
      if (value !== null && value !== undefined) formData.append(key, value);
    });
    if (accountingForm.receipt) formData.append('receipt', accountingForm.receipt);

    try {
      setAccountingSaving(true);
      if (accountingForm.id) {
        await axios.patch(
          `${API_BASE}/admin/accounting/entries/${accountingForm.id}/`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setMessage('Movimiento financiero actualizado.');
      } else {
        await axios.post(
          `${API_BASE}/admin/accounting/entries/`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setMessage('Movimiento financiero registrado.');
      }
      resetAccountingForm();
      await loadAdminPanel();
    } catch (err) {
      const payload = err?.response?.data;
      setMessage(
        payload?.detail
        || (payload && typeof payload === 'object' ? Object.values(payload).flat().join(' ') : '')
        || 'No se pudo guardar el movimiento.'
      );
    } finally {
      setAccountingSaving(false);
    }
  }

  async function deleteFinancialEntry(entry) {
    if (!window.confirm(`¿Eliminar "${entry.title}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/admin/accounting/entries/${entry.id}/`);
      setMessage('Movimiento eliminado.');
      if (accountingForm.id === entry.id) resetAccountingForm();
      await loadAdminPanel();
    } catch (err) {
      setMessage('No se pudo eliminar el movimiento.');
    }
  }

  async function saveAccountingSettings(e) {
    e?.preventDefault();
    try {
      setAccountingSaving(true);
      await axios.patch(
        `${API_BASE}/admin/accounting/settings/`,
        accountingSettingsForm
      );
      setMessage('Configuración contable guardada.');
      await loadAdminPanel();
    } catch (err) {
      const payload = err?.response?.data;
      setMessage(
        payload?.non_field_errors?.[0]
        || payload?.detail
        || 'No se pudo guardar la configuración.'
      );
    } finally {
      setAccountingSaving(false);
    }
  }

  function exportAccountingCsv() {
    const rows = [
      ['Fecha','Tipo','Título','Categoría','Pagado por','Importe','Método','Factura','Referencia','Estado'],
      ...filteredFinancialEntries.map(entry => [
        entry.entry_date,
        entry.entry_type_label,
        entry.title,
        entry.category_name || '',
        entry.paid_by_label,
        entry.amount,
        entry.payment_method_label,
        entry.invoice_number || '',
        entry.bank_reference || '',
        entry.status_label,
      ]),
    ];
    const csv = rows.map(row =>
      row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')
    ).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `contabilidad-casa-kebab-${new Date().toISOString().slice(0,10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function formatFileSize(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  async function createSystemBackup(backupType) {
    const labels = {
      database: 'base de datos',
      configuration: 'configuración',
      media: 'archivos Media',
    };
    if (!window.confirm(`¿Crear una copia de ${labels[backupType] || backupType}?`)) return;

    try {
      setBackupWorking(true);
      const response = await axios.post(`${API_BASE}/admin/system/backups/`, {
        backup_type: backupType,
      });
      setMessage(`Copia creada: ${response.data.file_name || labels[backupType]}`);
      await loadAdminPanel();
    } catch (err) {
      setMessage(
        err?.response?.data?.detail
        || err?.response?.data?.backup?.error_message
        || 'No se pudo crear la copia.'
      );
    } finally {
      setBackupWorking(false);
    }
  }

  async function downloadSystemBackup(backup) {
    try {
      setBackupWorking(true);
      const response = await axios.get(
        `${API_BASE}/admin/system/backups/${backup.id}/download/`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = backup.file_name || `backup-${backup.id}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo descargar la copia.');
    } finally {
      setBackupWorking(false);
    }
  }

  async function verifySystemBackup(backup) {
    try {
      setBackupWorking(true);
      const response = await axios.post(
        `${API_BASE}/admin/system/backups/${backup.id}/verify/`
      );
      setMessage(response.data.detail || (response.data.valid ? 'Copia válida.' : 'Copia no válida.'));
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo verificar la copia.');
    } finally {
      setBackupWorking(false);
    }
  }

  async function toggleBackupProtection(backup) {
    try {
      setBackupWorking(true);
      await axios.patch(`${API_BASE}/admin/system/backups/${backup.id}/`, {
        is_protected: !backup.is_protected,
      });
      setMessage(backup.is_protected ? 'Protección eliminada.' : 'Copia protegida.');
      await loadAdminPanel();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo cambiar la protección.');
    } finally {
      setBackupWorking(false);
    }
  }

  async function deleteSystemBackup(backup) {
    if (!window.confirm(`¿Eliminar definitivamente "${backup.file_name || 'esta copia'}"?`)) return;
    try {
      setBackupWorking(true);
      await axios.delete(`${API_BASE}/admin/system/backups/${backup.id}/`);
      setMessage('Copia eliminada.');
      await loadAdminPanel();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo eliminar la copia.');
    } finally {
      setBackupWorking(false);
    }
  }

  async function autoAssignRider(orderCode) {
    try {
      await axios.post(`${API_BASE}/orders/${orderCode}/auto-assign-rider/`);
      setMessage(`Pedido ${orderCode} asignado automáticamente al repartidor libre.`);
      await loadAdminPanel();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo asignar automáticamente.');
    }
  }

  async function assignRiderFromAdmin(orderCode, riderId) {
    try {
      await axios.post(`${API_BASE}/orders/${orderCode}/assign-rider/`, { rider_id: riderId || null });
      setMessage(riderId ? 'Repartidor asignado.' : 'Repartidor eliminado del pedido.');
      await loadAdminPanel();
    } catch (err) {
      setMessage('No se pudo asignar el repartidor.');
    }
  }

  const activeOrders = orders.filter(o => !['delivered','cancelled'].includes(o.status));
  const filteredFinancialEntries = financialEntries.filter(entry => {
    const matchesSearch = !accountingSearch.trim() || [
      entry.title,
      entry.description,
      entry.invoice_number,
      entry.bank_reference,
      entry.category_name,
    ].join(' ').toLowerCase().includes(accountingSearch.trim().toLowerCase());
    const matchesParty = !accountingPartyFilter || entry.paid_by === accountingPartyFilter;
    const matchesType = !accountingTypeFilter || entry.entry_type === accountingTypeFilter;
    return matchesSearch && matchesParty && matchesType;
  });
  const cardRows = (data?.payment_breakdown || []).filter(p => ['card_delivery', 'online'].includes(p.payment_method));
  const tabs = [
    ['overview','Resumen'],
    ['orders','Pedidos vivos'],
    ['riders','Repartidores'],
    ['tracking','Mapa repartidores en vivo'],
    ['customers','Clientes'],
    ['reports','Reportes dinámicos'],
    ['accounting','Contabilidad'],
    ['profitability','Rentabilidad'],
    ['system','Sistema / Backup'],
    ['config','Configuración'],
    ['menu','Categorías / Menú'],
    ['payments','Pagos tarjeta'],
    ['sales','Más / Menos vendidos'],
  ];

  return <div>
    <Header title="Admin PRO" subtitle="Panel profesional Casa de Kebab Turco">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos clásico</button>
      <button dataRoles="admin" onClick={() => window.location.href='/menu-admin'}>Menú Admin</button>
      <button dataRoles="admin" onClick={() => window.location.href='/settings-admin'}>Ajustes</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page admin-pro-page">
      <section className="admin-hero">
        <div>
          <span className="admin-kicker">Panel de control</span>
          <h1>Casa de Kebab Turco Admin</h1>
          <p>Pedidos en vivo, repartidor, clientes, contabilidad, menú y ventas en una sola pantalla.</p>
        </div>
        <button className="mini-action" onClick={loadAdminPanel}>Actualizar ahora</button>
      </section>

      <nav className="admin-tabs">
        {tabs.map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); if (key === 'reports') window.setTimeout(loadDynamicReports, 0); }}>{label}</button>)}
      </nav>

      {data && <section className="admin-metrics-grid">
        <div><span>Ventas hoy</span><b>{money(data.today_sales)}</b><small>{data.today_orders_count} pedidos</small></div>
        <div><span>Pedidos activos</span><b>{data.active_orders_count}</b><small>{data.pending_orders_count} pendientes</small></div>
        <div><span>Total vendido</span><b>{money(data.total_sales)}</b><small>{data.total_orders_count} pedidos total</small></div>
        <div><span>Tarjeta / online</span><b>{money(data.card_paid_total)}</b><small>{data.card_paid_count} pagos</small></div>
        <div><span>Clientes</span><b>{data.customers_count}</b><small>{customers.length} visibles</small></div>
        <div><span>Menú</span><b>{data.menu_items_count}</b><small>{data.categories_count} categorías</small></div>
      </section>}

      {tab === 'overview' && data && <section className="admin-grid-3">
        <div className="admin-card"><h2>Estado del día</h2>{(data.status_breakdown || []).map((s, i) => <p key={i}><b>{s.status}</b><span>{s.count} pedidos · {money(s.total)}</span></p>)}</div>
        <div className="admin-card"><h2>Top hoy</h2>{(data.today_top_items || []).slice(0,8).map((x, i) => <p key={i}><b>{x.items__name_snapshot}</b><span>{x.quantity || 0} uds · {money(x.total)}</span></p>)}</div>
        <div className="admin-card"><h2>Clientes recientes</h2>{(data.recent_customers || []).map((c, i) => <p key={i}><b>{c.name || 'Sin nombre'}</b><span>{c.phone} · {c.total_orders} pedidos</span></p>)}</div>
      </section>}

      {tab === 'orders' && <section className="admin-card"><h2>Pedidos vivos</h2><p className="muted">Los pedidos de entrega se asignan automáticamente al repartidor activo con menos pedidos. También puedes forzar la asignación desde aquí.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Estado</th><th>Pago</th><th>Repartidor</th><th>Acciones</th></tr></thead><tbody>{activeOrders.map(o => <tr key={o.order_code}><td><b>{o.order_code}</b><small>{new Date(o.created_at).toLocaleString()}</small></td><td>{o.customer_name}<small>{o.customer_phone}</small></td><td>{o.delivery_type === 'delivery' ? 'Entrega' : 'Recoger'}</td><td>{money(o.total)}</td><td>{o.status}</td><td>{o.payment_method} · {o.payment_status}</td><td>{o.delivery_type === 'delivery' ? <><select className="admin-rider-select" value={o.assigned_rider_data?.id || ''} onChange={e => assignRiderFromAdmin(o.order_code, e.target.value)}><option value="">Sin asignar</option>{riders.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.name} · {r.active_orders_count || 0}</option>)}</select><button className="mini-action" onClick={() => autoAssignRider(o.order_code)}>Auto</button></> : '-'}</td><td><button onClick={() => quickStatus(o.order_code,'accepted')}>Aceptar</button><button onClick={() => quickStatus(o.order_code,'preparing')}>Preparar</button><button onClick={() => quickStatus(o.order_code,'out_for_delivery')}>Enviar</button><button onClick={() => quickStatus(o.order_code,'delivered')}>Entregado</button><button onClick={() => quickPayment(o.order_code,'paid')}>Pagado</button></td></tr>)}</tbody></table></div></section>}

      {tab === 'riders' && <section className="rider-management-layout">
        <div className="admin-card rider-editor-card" id="admin-rider-editor">
          <div className="rider-editor-title">
            <div>
              <span className="admin-kicker">{riderForm.id ? 'Edición' : 'Nuevo usuario'}</span>
              <h2>{riderForm.id ? 'Editar repartidor' : 'Añadir repartidor'}</h2>
            </div>
            {riderForm.id && <button className="mini-action" type="button" onClick={resetRiderForm}>Nuevo</button>}
          </div>
          <p className="muted">
            El nombre de usuario y la contraseña se utilizan para entrar en la aplicación del repartidor.
          </p>
          <form className="admin-rider-editor-form" onSubmit={saveRiderFromAdmin}>
            <label>Nombre completo *</label>
            <input
              placeholder="Ejemplo: Saeid Javid"
              value={riderForm.name}
              onChange={e => setRiderForm({...riderForm, name: e.target.value})}
              autoComplete="name"
            />

            <label>Teléfono *</label>
            <input
              placeholder="Ejemplo: 613473564"
              value={riderForm.phone}
              onChange={e => setRiderForm({...riderForm, phone: e.target.value})}
              inputMode="tel"
              autoComplete="tel"
            />

            <label>Nombre de usuario *</label>
            <input
              placeholder="Ejemplo: saeid_rider"
              value={riderForm.username}
              onChange={e => setRiderForm({...riderForm, username: e.target.value})}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />

            <label>{riderForm.id ? 'Nueva contraseña' : 'Contraseña *'}</label>
            <div className="rider-password-field">
              <input
                placeholder={riderForm.id ? 'Déjala vacía para conservar la actual' : 'Mínimo 6 caracteres'}
                type={showRiderPassword ? 'text' : 'password'}
                value={riderForm.password}
                onChange={e => setRiderForm({...riderForm, password: e.target.value})}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowRiderPassword(value => !value)}>
                {showRiderPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {riderForm.id && <small className="rider-form-help">
              Para cambiar la contraseña escribe una nueva. Si no quieres cambiarla, deja este campo vacío.
            </small>}

            <label className="rider-active-check">
              <input
                type="checkbox"
                checked={riderForm.is_active}
                onChange={e => setRiderForm({...riderForm, is_active: e.target.checked})}
              />
              <span>Cuenta activa y disponible para recibir pedidos</span>
            </label>

            <div className="rider-form-actions">
              <button className="pay" type="submit" disabled={riderSaving}>
                {riderSaving ? 'Guardando...' : riderForm.id ? 'Guardar cambios' : 'Crear repartidor'}
              </button>
              {riderForm.id && <button className="rider-cancel-edit" type="button" onClick={resetRiderForm}>
                Cancelar edición
              </button>}
            </div>
          </form>
        </div>

        <div className="admin-card rider-directory-card">
          <div className="rider-directory-heading">
            <div>
              <h2>Repartidores registrados</h2>
              <p className="muted">{riders.length} cuentas · {riders.filter(r => r.is_active).length} activas</p>
            </div>
          </div>
          <div className="rider-directory">
            {riders.map(r => <article key={r.id} className={`rider-directory-row ${r.is_active ? 'active' : 'inactive'}`}>
              <div className="rider-directory-identity">
                <span className={`rider-status-dot ${r.is_active ? 'active' : 'inactive'}`}></span>
                <div>
                  <b>{r.name}</b>
                  <small>@{r.username || 'sin_usuario'} · {r.phone}</small>
                </div>
              </div>
              <div className="rider-directory-meta">
                <span>{r.active_orders_count || 0} pedidos activos</span>
                <span>{r.has_password ? 'Contraseña configurada' : 'Sin contraseña'}</span>
                <span>{r.last_location_at ? `GPS: ${new Date(r.last_location_at).toLocaleString()}` : 'GPS sin registrar'}</span>
              </div>
              <div className="rider-directory-actions">
                <span className={`rider-state-badge ${r.is_active ? 'active' : 'inactive'}`}>
                  {r.is_active ? 'Activo' : 'Inactivo'}
                </span>
                <button type="button" className="rider-edit-button" onClick={() => startEditRider(r)}>Editar</button>
                <button
                  type="button"
                  className={r.is_active ? 'rider-disable-button' : 'rider-enable-button'}
                  disabled={riderSaving}
                  onClick={() => toggleRiderFromAdmin(r)}
                >
                  {r.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </article>)}
            {!riders.length && <p className="muted">Todavía no hay repartidores.</p>}
          </div>
        </div>

        <div className="admin-card rider-delivery-orders-card">
          <h2>Pedidos para reparto</h2>
          <p className="muted">Auto asigna al repartidor activo con menos pedidos pendientes.</p>
          {orders.filter(o => o.delivery_type === 'delivery').slice(0,20).map(o => <div className="rider-order-row" key={o.order_code}>
            <p><b>{o.order_code}</b><span>{o.address || 'Sin dirección'} · {o.assigned_rider_data?.name || 'Sin repartidor'}</span></p>
            <button className="mini-action" onClick={() => autoAssignRider(o.order_code)}>Asignar libre</button>
          </div>)}
        </div>
      </section>}

      {tab === 'tracking' && <section className="admin-tracking-grid">{orders.filter(o => o.delivery_type === 'delivery' && !['delivered','cancelled'].includes(o.status)).map(o => <article className="admin-card tracking-admin-card" key={o.order_code}><div className="order-head"><h2>{o.order_code}</h2><strong>{o.status}</strong></div><p><b>Cliente:</b> {o.customer_name || 'Sin nombre'} · {o.customer_phone}</p><p><b>Dirección:</b> {o.address || '-'}</p><p><b>Repartidor:</b> {o.assigned_rider_data?.name || 'Sin asignar'} {o.assigned_rider_data?.phone ? `· ${o.assigned_rider_data.phone}` : ''}</p>{o.assigned_rider_data?.last_location_at && <small>Última ubicación: {new Date(o.assigned_rider_data.last_location_at).toLocaleString()}</small>}<TrackingMap order={o} compact /></article>)}{!orders.filter(o => o.delivery_type === 'delivery' && !['delivered','cancelled'].includes(o.status)).length && <div className="admin-card"><h2>Sin pedidos en reparto</h2><p className="muted">Cuando un pedido se asigne a un repartidor, aparecerá aquí con su ubicación GPS.</p></div>}</section>}

      {tab === 'customers' && <section className="admin-card"><h2>Clientes</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Dirección</th><th>Pedidos</th><th>Total gastado</th><th>Último pedido</th></tr></thead><tbody>{customers.map(c => <tr key={c.id}><td><b>{c.name || 'Sin nombre'}</b><small>{c.email}</small></td><td>{c.phone}</td><td>{c.default_address || '-'}</td><td>{c.total_orders}</td><td>{money(c.total_spent)}</td><td>{c.last_order_at ? new Date(c.last_order_at).toLocaleString() : '-'}</td></tr>)}</tbody></table></div></section>}



      {tab === 'reports' && <section className="dynamic-reports-page">
        <section className="admin-card report-filter-card">
          <div className="report-heading-row">
            <div>
              <span className="admin-kicker">Business Intelligence</span>
              <h2>Reportes dinámicos</h2>
              <p className="muted">Filtra ventas, productos, clientes, pagos y rendimiento de repartidores por periodo.</p>
            </div>
            <div className="report-header-actions">
              <button type="button" className="mini-action" onClick={loadDynamicReports} disabled={reportLoading}>{reportLoading ? 'Actualizando...' : 'Actualizar'}</button>
              <button type="button" className="mini-action secondary-action" onClick={exportDynamicReportCsv} disabled={!reportData}>Exportar CSV</button>
            </div>
          </div>
          <div className="report-quick-ranges">
            <button type="button" onClick={() => setQuickReportRange(1)}>Hoy</button>
            <button type="button" onClick={() => setQuickReportRange(7)}>7 días</button>
            <button type="button" onClick={() => setQuickReportRange(30)}>30 días</button>
            <button type="button" onClick={() => setQuickReportRange(90)}>90 días</button>
          </div>
          <div className="report-filters-grid">
            <label>Desde<input type="date" value={reportFilters.date_from} onChange={e => setReportFilters({...reportFilters, date_from: e.target.value})} /></label>
            <label>Hasta<input type="date" value={reportFilters.date_to} onChange={e => setReportFilters({...reportFilters, date_to: e.target.value})} /></label>
            <label>Tipo de pedido<select value={reportFilters.delivery_type} onChange={e => setReportFilters({...reportFilters, delivery_type: e.target.value})}><option value="">Todos</option><option value="collection">Recoger</option><option value="delivery">Entregar</option></select></label>
            <label>Pago<select value={reportFilters.payment_method} onChange={e => setReportFilters({...reportFilters, payment_method: e.target.value})}><option value="">Todos</option><option value="cash">Efectivo</option><option value="card_delivery">Tarjeta</option><option value="store">En tienda</option><option value="online">Online</option></select></label>
            <label>Repartidor<select value={reportFilters.rider_id} onChange={e => setReportFilters({...reportFilters, rider_id: e.target.value})}><option value="">Todos</option>{riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label>Estado<select value={reportFilters.status} onChange={e => setReportFilters({...reportFilters, status: e.target.value})}><option value="">Todos</option><option value="pending">Pendiente</option><option value="accepted">Aceptado</option><option value="preparing">Preparando</option><option value="out_for_delivery">En reparto</option><option value="delivered">Entregado</option><option value="cancelled">Cancelado</option></select></label>
          </div>
        </section>

        {!reportData && !reportLoading && <section className="admin-card report-empty-state"><h2>Elige filtros y pulsa “Actualizar”</h2><p className="muted">El informe se actualiza con los pedidos guardados en la base de datos.</p></section>}

        {reportData && <>
          <section className="report-kpi-grid">
            <article><span>Facturación</span><b>{money(reportData.metrics?.revenue)}</b><small>{reportData.metrics?.orders_count || 0} pedidos válidos</small></article>
            <article><span>Ticket medio</span><b>{money(reportData.metrics?.average_order)}</b><small>Sin pedidos cancelados</small></article>
            <article><span>Recoger / Entregar</span><b>{reportData.metrics?.collection_orders || 0} / {reportData.metrics?.delivery_orders || 0}</b><small>Pedidos por tipo</small></article>
            <article><span>Cancelados</span><b>{reportData.metrics?.cancelled_orders || 0}</b><small>{reportData.metrics?.cancel_rate || 0}% del periodo</small></article>
            <article><span>Clientes únicos</span><b>{reportData.metrics?.unique_customers || 0}</b><small>Con teléfono registrado</small></article>
            <article><span>Descuentos</span><b>{money(reportData.metrics?.discount_total)}</b><small>Aplicados al periodo</small></article>
          </section>
          <section className="report-grid-two">
            <article className="admin-card"><h2>Ventas por día</h2><ReportBars rows={reportData.daily_sales || []} labelKey="day" valueKey="revenue" moneyValues /></article>
            <article className="admin-card"><h2>Productos más vendidos</h2><ReportBars rows={reportData.top_items || []} labelKey="name" valueKey="quantity" /></article>
            <article className="admin-card"><h2>Estados de pedido</h2><ReportBars rows={reportData.status_breakdown || []} labelKey="label" valueKey="count" /></article>
            <article className="admin-card"><h2>Métodos de pago</h2><ReportBars rows={reportData.payment_breakdown || []} labelKey="label" valueKey="revenue" moneyValues /></article>
          </section>
          <section className="report-grid-two">
            <article className="admin-card"><h2>Horas de mayor actividad</h2><ReportBars rows={reportData.hourly_sales || []} labelKey="hour" valueKey="orders" /></article>
            <article className="admin-card"><h2>Rendimiento de repartidores</h2><div className="report-table-wrap"><table className="admin-table"><thead><tr><th>Repartidor</th><th>Pedidos</th><th>Entregados</th><th>Ventas</th></tr></thead><tbody>{(reportData.rider_performance || []).map(row => <tr key={row.id}><td><b>{row.name}</b></td><td>{row.orders}</td><td>{row.delivered}</td><td>{money(row.revenue)}</td></tr>)}{!(reportData.rider_performance || []).length && <tr><td colSpan="4" className="muted">No hay datos de repartidores en este periodo.</td></tr>}</tbody></table></div></article>
          </section>
          <section className="admin-card"><h2>Clientes principales</h2><div className="report-table-wrap"><table className="admin-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Pedidos</th><th>Gastado</th><th>Último pedido</th></tr></thead><tbody>{(reportData.top_customers || []).map((row, index) => <tr key={`${row.phone}-${index}`}><td><b>{row.name || 'Sin nombre'}</b></td><td>{row.phone || '-'}</td><td>{row.orders}</td><td>{money(row.revenue)}</td><td>{row.last_order ? new Date(row.last_order).toLocaleString() : '-'}</td></tr>)}{!(reportData.top_customers || []).length && <tr><td colSpan="5" className="muted">No hay clientes con pedidos en este periodo.</td></tr>}</tbody></table></div></section>
        </>}
      </section>}


      {tab === 'profitability' && <ProfitabilityPanel
        items={items}
        ingredients={profitIngredients}
        report={profitabilityReport}
        loading={profitabilityLoading}
        onRefresh={loadProfitability}
        onCreateIngredient={createProfitIngredient}
        onSaveRecipe={saveProfitRecipe}
        onDeleteIngredient={deleteProfitIngredient}
      />}


      {tab === 'accounting' && <section className="partner-accounting-page">
        <section className="accounting-summary-grid">
          <article><span>Gastos este mes</span><b>{money(accountingSummary?.month_expenses)}</b><small>Total histórico: {money(accountingSummary?.total_expenses)}</small></article>
          <article><span>Pagado por Saeid</span><b>{money(accountingSummary?.saeid_expenses)}</b><small>Aportado a BBVA: {money(accountingSummary?.saeid_contributions)}</small></article>
          <article><span>Pagado por Ahmed</span><b>{money(accountingSummary?.ahmed_expenses)}</b><small>Aportado a BBVA: {money(accountingSummary?.ahmed_contributions)}</small></article>
          <article><span>Pagado desde BBVA</span><b>{money(accountingSummary?.bbva_expenses)}</b><small>Gastos comunes</small></article>
          <article className="bbva-balance-card"><span>Saldo calculado BBVA</span><b>{money(accountingSummary?.bbva_balance)}</b><small>Saldo inicial + aportaciones - gastos BBVA</small></article>
          <article className="settlement-card"><span>Liquidación 50/50</span><b>{Number(accountingSummary?.settlement?.amount || 0) > 0 ? `${accountingSummary.settlement.debtor} debe ${money(accountingSummary.settlement.amount)} a ${accountingSummary.settlement.creditor}` : 'Socios equilibrados'}</b><small>Considera gastos personales y liquidaciones registradas</small></article>
        </section>

        <section className="admin-card accounting-pdf-reports-card">
          <div className="accounting-card-heading">
            <div>
              <span className="admin-kicker">Documentos</span>
              <h2>Reportes PDF</h2>
              <p className="muted">El informe se abre listo para imprimir o guardar como PDF desde el navegador.</p>
            </div>
          </div>
          <div className="accounting-pdf-actions">
            <button type="button" onClick={() => openAccountingPdf('summary')}>Resumen contable</button>
            <button type="button" onClick={() => openAccountingPdf('ledger')}>Libro de movimientos</button>
            <button type="button" onClick={() => openAccountingPdf('expenses')}>Informe de gastos</button>
            <button type="button" onClick={() => openAccountingPdf('bbva')}>Movimientos BBVA</button>
            <button type="button" onClick={() => openAccountingPdf('settlements')}>Liquidaciones socios</button>
          </div>
        </section>

        <section className="accounting-main-grid">
          <article className="admin-card" id="accounting-entry-form">
            <div className="accounting-card-heading">
              <div>
                <span className="admin-kicker">{accountingForm.id ? 'Editar' : 'Nuevo movimiento'}</span>
                <h2>{accountingForm.id ? 'Editar movimiento' : 'Registrar movimiento'}</h2>
              </div>
              {accountingForm.id && <button className="mini-action" type="button" onClick={resetAccountingForm}>Nuevo</button>}
            </div>

            <form className="accounting-entry-form" onSubmit={saveFinancialEntry}>
              <label>Tipo de movimiento *</label>
              <select value={accountingForm.entry_type} onChange={e => setAccountingForm({...accountingForm, entry_type: e.target.value})}>
                <option value="expense">Gasto del restaurante</option>
                <option value="contribution">Aportación al BBVA</option>
                <option value="settlement">Liquidación entre socios</option>
              </select>

              <label>Fecha *</label>
              <input type="date" value={accountingForm.entry_date} onChange={e => setAccountingForm({...accountingForm, entry_date: e.target.value})}/>

              <label>Título *</label>
              <input placeholder="Ejemplo: Compra de carne" value={accountingForm.title} onChange={e => setAccountingForm({...accountingForm, title: e.target.value})}/>

              <label>Importe (€) *</label>
              <input type="number" min="0.01" step="0.01" placeholder="0.00" value={accountingForm.amount} onChange={e => setAccountingForm({...accountingForm, amount: e.target.value})}/>

              {accountingForm.entry_type === 'expense' && <>
                <label>Categoría</label>
                <select value={accountingForm.category} onChange={e => setAccountingForm({...accountingForm, category: e.target.value})}>
                  <option value="">Sin categoría</option>
                  {expenseCategories.filter(category => category.is_active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>

                <label>Pagado por *</label>
                <select value={accountingForm.paid_by} onChange={e => setAccountingForm({...accountingForm, paid_by: e.target.value})}>
                  <option value="saeid">Saeid</option>
                  <option value="ahmed">Ahmed</option>
                  <option value="bbva">Cuenta conjunta BBVA</option>
                </select>
              </>}

              {accountingForm.entry_type === 'contribution' && <>
                <label>Socio que aporta *</label>
                <select value={accountingForm.contribution_from} onChange={e => setAccountingForm({...accountingForm, contribution_from: e.target.value})}>
                  <option value="saeid">Saeid</option>
                  <option value="ahmed">Ahmed</option>
                </select>
              </>}

              {accountingForm.entry_type === 'settlement' && <>
                <label>Socio que paga *</label>
                <select value={accountingForm.paid_by} onChange={e => setAccountingForm({...accountingForm, paid_by: e.target.value, settlement_to: e.target.value === 'saeid' ? 'ahmed' : 'saeid'})}>
                  <option value="saeid">Saeid</option>
                  <option value="ahmed">Ahmed</option>
                </select>
                <label>Socio que recibe *</label>
                <select value={accountingForm.settlement_to} onChange={e => setAccountingForm({...accountingForm, settlement_to: e.target.value})}>
                  <option value="saeid">Saeid</option>
                  <option value="ahmed">Ahmed</option>
                </select>
              </>}

              <label>Método de pago</label>
              <select value={accountingForm.payment_method} onChange={e => setAccountingForm({...accountingForm, payment_method: e.target.value})}>
                <option value="cash">Efectivo</option>
                <option value="personal_card">Tarjeta personal</option>
                <option value="transfer">Transferencia</option>
                <option value="bbva">Cuenta BBVA conjunta</option>
                <option value="bizum">Bizum</option>
                <option value="other">Otro</option>
              </select>

              <label>Número de factura</label>
              <input value={accountingForm.invoice_number} onChange={e => setAccountingForm({...accountingForm, invoice_number: e.target.value})}/>

              <label>Referencia bancaria BBVA</label>
              <input value={accountingForm.bank_reference} onChange={e => setAccountingForm({...accountingForm, bank_reference: e.target.value})}/>

              <label>Descripción</label>
              <textarea value={accountingForm.description} onChange={e => setAccountingForm({...accountingForm, description: e.target.value})}/>

              <label>Factura o recibo</label>
              <input
  type="file"
  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.ods,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.zip"
  onChange={e => {
    const file = e.target.files?.[0] || null;
    const maxBytes = 20 * 1024 * 1024;

    if (file && file.size > maxBytes) {
      setMessage('El archivo no puede superar 20 MB.');
      e.target.value = '';
      setAccountingForm({...accountingForm, receipt: null});
      return;
    }

    setAccountingForm({...accountingForm, receipt: file});
  }}
/>

              <label>Estado</label>
              <select value={accountingForm.status} onChange={e => setAccountingForm({...accountingForm, status: e.target.value})}>
                <option value="approved">Aprobado</option>
                <option value="pending">Pendiente</option>
                <option value="rejected">Rechazado</option>
                <option value="reimbursed">Reembolsado</option>
              </select>

              <button className="pay" disabled={accountingSaving}>
                {accountingSaving ? 'Guardando...' : accountingForm.id ? 'Guardar cambios' : 'Registrar movimiento'}
              </button>
            </form>
          </article>

          <article className="admin-card accounting-settings-card">
            <h2>Socios y cuenta BBVA</h2>
            <form className="accounting-settings-form" onSubmit={saveAccountingSettings}>
              <label>Participación Saeid (%)</label>
              <input type="number" step="0.01" value={accountingSettingsForm.saeid_share_percent} onChange={e => setAccountingSettingsForm({...accountingSettingsForm, saeid_share_percent: e.target.value})}/>
              <label>Participación Ahmed (%)</label>
              <input type="number" step="0.01" value={accountingSettingsForm.ahmed_share_percent} onChange={e => setAccountingSettingsForm({...accountingSettingsForm, ahmed_share_percent: e.target.value})}/>
              <label>Saldo inicial cuenta BBVA (€)</label>
              <input type="number" step="0.01" value={accountingSettingsForm.bbva_initial_balance} onChange={e => setAccountingSettingsForm({...accountingSettingsForm, bbva_initial_balance: e.target.value})}/>
              <button className="mini-action" disabled={accountingSaving}>Guardar configuración</button>
            </form>

            <h2>Gastos por categoría</h2>
            <div className="accounting-category-summary">
              {(accountingSummary?.by_category || []).map(row => <p key={row.name}><b>{row.name}</b><span>{row.count} · {money(row.total)}</span></p>)}
              {!(accountingSummary?.by_category || []).length && <p className="muted">Todavía no hay gastos.</p>}
            </div>
          </article>
        </section>

        <section className="admin-card accounting-ledger-card">
          <div className="accounting-ledger-heading">
            <div><h2>Libro de movimientos</h2><p className="muted">{filteredFinancialEntries.length} movimientos visibles</p></div>
            <button className="mini-action" onClick={exportAccountingCsv}>Exportar CSV</button>
          </div>
          <div className="accounting-filters">
            <input placeholder="Buscar título, factura o referencia..." value={accountingSearch} onChange={e => setAccountingSearch(e.target.value)}/>
            <select value={accountingTypeFilter} onChange={e => setAccountingTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="expense">Gastos</option>
              <option value="contribution">Aportaciones BBVA</option>
              <option value="settlement">Liquidaciones</option>
            </select>
            <select value={accountingPartyFilter} onChange={e => setAccountingPartyFilter(e.target.value)}>
              <option value="">Todos los pagadores</option>
              <option value="saeid">Saeid</option>
              <option value="ahmed">Ahmed</option>
              <option value="bbva">BBVA</option>
            </select>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table accounting-table">
              <thead><tr><th>Fecha</th><th>Movimiento</th><th>Pagador</th><th>Categoría</th><th>Importe</th><th>Documento</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredFinancialEntries.map(entry => <tr key={entry.id}>
                  <td>{entry.entry_date}<small>{entry.created_by_username ? `por ${entry.created_by_username}` : ''}</small></td>
                  <td><b>{entry.title}</b><small>{entry.entry_type_label} · {entry.payment_method_label}</small></td>
                  <td>{entry.entry_type === 'contribution' ? `Aportación: ${entry.contribution_from === 'saeid' ? 'Saeid' : 'Ahmed'}` : entry.entry_type === 'settlement' ? `${entry.paid_by_label} → ${entry.settlement_to === 'saeid' ? 'Saeid' : 'Ahmed'}` : entry.paid_by_label}</td>
                  <td>{entry.category_name || '-'}</td>
                  <td><b>{money(entry.amount)}</b><small>{entry.invoice_number || entry.bank_reference || ''}</small></td>
                  <td>{entry.receipt_url ? <a href={entry.receipt_url} target="_blank" rel="noreferrer">{getAttachmentLabel(entry.receipt_url)}</a> : <span className="muted">Sin recibo</span>}</td>
                  <td>{entry.status_label}</td>
                  <td><button onClick={() => editFinancialEntry(entry)}>Editar</button><button className="danger-button compact" onClick={() => deleteFinancialEntry(entry)}>Eliminar</button></td>
                </tr>)}
                {!filteredFinancialEntries.length && <tr><td colSpan="8" className="muted">No hay movimientos con estos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>}



      {tab === 'system' && <section className="system-backup-page">
        <section className="system-health-grid">
          {Object.entries(systemHealth?.health || {}).map(([key, item]) => <article key={key} className={`system-health-card ${item.status}`}>
            <span>{({
              backend: 'Backend',
              database: 'PostgreSQL',
              media: 'Media / Archivos',
              sms_gateway: 'SMS Gateway',
              telegram: 'Telegram',
            })[key] || key}</span>
            <b>{item.label}</b>
            <small>{item.detail}</small>
          </article>)}
          <article className="system-health-card info">
            <span>Última copia</span>
            <b>{systemHealth?.latest_backup?.created_at ? new Date(systemHealth.latest_backup.created_at).toLocaleString() : 'Sin copias'}</b>
            <small>{systemHealth?.completed_count || 0} completadas · {systemHealth?.failed_count || 0} fallidas</small>
          </article>
        </section>

        <section className="admin-card render-backup-warning">
          <div>
            <h2>Importante sobre Render</h2>
            <p>
              Estas copias se crean en el almacenamiento del backend. Si el servicio no tiene Persistent Disk,
              el archivo puede desaparecer después de un reinicio o deploy. Descárgalo inmediatamente.
            </p>
          </div>
          <span>Restore completo no se ejecuta desde el navegador por seguridad.</span>
        </section>

        <section className="backup-action-grid">
          <article className="admin-card">
            <span className="admin-kicker">Datos del negocio</span>
            <h2>Copia de base de datos JSON</h2>
            <p className="muted">Exporta pedidos, clientes, menú, repartidores, configuración y contabilidad. No incluye contraseñas ni tokens.</p>
            <button className="pay" disabled={backupWorking} onClick={() => createSystemBackup('database')}>
              Crear copia de datos
            </button>
          </article>

          <article className="admin-card">
            <span className="admin-kicker">Configuración</span>
            <h2>Exportar configuración</h2>
            <p className="muted">Horas, categorías, cupones, ajustes contables y parámetros del restaurante.</p>
            <button className="pay" disabled={backupWorking} onClick={() => createSystemBackup('configuration')}>
              Exportar configuración
            </button>
          </article>

          <article className="admin-card">
            <span className="admin-kicker">Imágenes y documentos</span>
            <h2>Copia de archivos Media</h2>
            <p className="muted">Crea un ZIP con imágenes de productos, recibos y documentos cargados.</p>
            <button className="pay" disabled={backupWorking} onClick={() => createSystemBackup('media')}>
              Crear ZIP de Media
            </button>
          </article>
        </section>

        <section className="admin-card backup-history-card">
          <div className="backup-history-heading">
            <div>
              <h2>Historial de copias</h2>
              <p className="muted">{systemBackups.length} registros visibles</p>
            </div>
            <button className="mini-action" onClick={loadAdminPanel} disabled={backupWorking}>Actualizar</button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table backup-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Archivo</th>
                  <th>Tamaño</th>
                  <th>Creado por</th>
                  <th>Checksum</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {systemBackups.map(backup => <tr key={backup.id} className={backup.status === 'failed' ? 'backup-failed-row' : ''}>
                  <td>{new Date(backup.created_at).toLocaleString()}</td>
                  <td>{backup.backup_type_label}</td>
                  <td><span className={`backup-status-badge ${backup.status}`}>{backup.status_label}</span>{backup.error_message && <small>{backup.error_message}</small>}</td>
                  <td><b>{backup.file_name || '-'}</b>{backup.is_protected && <small>🔒 Protegida</small>}</td>
                  <td>{formatFileSize(backup.file_size)}</td>
                  <td>{backup.created_by_username || '-'}</td>
                  <td><code>{backup.checksum_sha256 ? `${backup.checksum_sha256.slice(0,12)}…` : '-'}</code></td>
                  <td className="backup-row-actions">
                    <button disabled={!backup.download_available || backupWorking} onClick={() => downloadSystemBackup(backup)}>Descargar</button>
                    <button disabled={!backup.download_available || backupWorking} onClick={() => verifySystemBackup(backup)}>Verificar</button>
                    <button disabled={backupWorking} onClick={() => toggleBackupProtection(backup)}>{backup.is_protected ? 'Desproteger' : 'Proteger'}</button>
                    <button className="danger-button compact" disabled={backup.is_protected || backupWorking} onClick={() => deleteSystemBackup(backup)}>Eliminar</button>
                  </td>
                </tr>)}
                {!systemBackups.length && <tr><td colSpan="8" className="muted">Todavía no se ha creado ninguna copia.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card restore-safety-card">
          <h2>Recuperación de emergencia</h2>
          <p>
            La restauración completa de PostgreSQL debe ejecutarse desde Render o una terminal segura.
            Antes de restaurar se debe crear una copia nueva, activar modo mantenimiento y comprobar el checksum.
          </p>
          <ol>
            <li>Descargar y conservar la copia actual.</li>
            <li>Crear un backup administrado desde Render PostgreSQL.</li>
            <li>Restaurar en una base temporal y validar los datos.</li>
            <li>Cambiar la base de producción solo después de la verificación.</li>
          </ol>
        </section>
      </section>}

      {tab === 'config' && <section className="admin-grid-2"><div className="admin-card"><h2>Configuración actual</h2>{settings && <><p><b>Restaurante</b><span>{settings.restaurant_name}</span></p><p><b>Teléfono</b><span>{settings.phone}</span></p><p><b>Dirección</b><span>{settings.address}</span></p><p><b>Horario</b><span>{settings.opening_hours}</span></p><p><b>Estado</b><span>{settings.is_open ? 'Abierto' : 'Cerrado'}</span></p></>}</div><div className="admin-card"><h2>Accesos rápidos</h2><button className="pay" onClick={() => window.location.href='/settings-admin'}>Abrir configuración completa</button><button className="mini-action" onClick={() => window.location.href='/menu-admin'}>Editar menú</button><button className="mini-action" onClick={() => window.location.href='/orders-live'}>Pedidos clásicos</button></div></section>}

      {tab === 'menu' && <section className="admin-grid-2"><div className="admin-card"><h2>Categorías</h2>{categories.map(c => <p key={c.id}><b>{c.name_es}</b><span>{c.slug} · orden {c.sort_order}</span></p>)}</div><div className="admin-card"><h2>Productos</h2>{items.slice(0,18).map(i => <p key={i.id}><b>{i.name_es}</b><span>{i.category_name || '-'} · {money(i.price)} · {i.is_available ? 'Disponible' : 'Pausado'}</span></p>)}<button className="pay" onClick={() => window.location.href='/menu-admin'}>Gestionar menú completo</button></div></section>}

      {tab === 'payments' && data && <section className="admin-grid-2"><div className="admin-card"><h2>Pagos con tarjeta / online</h2>{cardRows.map((p,i) => <p key={i}><b>{p.payment_method}</b><span>{p.count} pedidos · {money(p.total)}</span></p>)}<hr/><p><b>Total tarjeta / online pagado</b><span>{money(data.card_paid_total)}</span></p></div><div className="admin-card"><h2>Todos los métodos</h2>{(data.payment_breakdown || []).map((p,i) => <p key={i}><b>{p.payment_method}</b><span>{p.count} pedidos · {money(p.total)}</span></p>)}</div></section>}

      {tab === 'sales' && data && <section className="admin-grid-2"><div className="admin-card"><h2>Más vendidos</h2>{(data.top_items || []).map((x,i) => <p key={i}><b>{i+1}. {x.items__name_snapshot}</b><span>{x.quantity || 0} uds · {money(x.total)}</span></p>)}</div><div className="admin-card"><h2>Menos vendidos</h2>{(data.low_items || []).map((x,i) => <p key={i}><b>{i+1}. {x.items__name_snapshot}</b><span>{x.quantity || 0} uds · {money(x.total)}</span></p>)}</div></section>}
    </main>
  </div>;
}

function ReceiptApp() {
  usePageChrome();
  const orderCode = window.location.pathname.split('/').filter(Boolean).pop();
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/orders/${orderCode}/`).then(res => setOrder(res.data)).catch(() => setMessage('Ticket no encontrado.'));
  }, [orderCode]);

  return <div className="receipt-wrap">
    {message && <div className="toast">{message}</div>}
    {order && <section className="receipt">
      <img src={restaurantLogo} alt="Casa de Kebab Turco" />
      <h1>Casa de Kebab Turco</h1>
      <p>{RESTAURANT_ADDRESS}</p>
      <hr />
      <h2>{order.order_code}</h2>
      <p><b>Cliente:</b> {order.customer_name || 'Sin nombre'}</p>
      <p><b>Tel:</b> {order.customer_phone}</p>
      <p><b>Tipo:</b> {order.delivery_type === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'}</p>
      {order.address && <p><b>Dirección:</b> {order.address}</p>}
      <p><b>Fecha:</b> {new Date(order.created_at).toLocaleString()}</p>
      <hr />
      {(order.items || []).map(item => <div className="receipt-line" key={item.id}><span>{item.quantity} x {item.name_snapshot}</span><b>{money(item.total)}</b></div>)}
      <hr />
      <div className="receipt-line"><span>Subtotal</span><b>{money(order.subtotal)}</b></div>
      <div className="receipt-line"><span>Entrega</span><b>{money(order.delivery_fee)}</b></div>
      <div className="receipt-line total"><span>Total</span><b>{money(order.total)}</b></div>
      <p><b>Pago:</b> {order.payment_method} · {order.payment_status}</p>
      {order.note && <p><b>Nota:</b> {order.note}</p>}

      <hr />
      <div className="order-confirmation-message">
        <h2>Pedido confirmado</h2>
        <p>
          {order.payment_method === 'online'
            ? 'El banco ha confirmado el pago correctamente.'
            : 'Tu pedido ha sido confirmado correctamente.'}
        </p>
        <p><b>En un máximo de 20 minutos tu pedido llegará a la dirección indicada.</b></p>
        <p>Gracias por pedir tu comida en Casa de Kebab Turco.</p>
      </div>

      <button className="print-button" onClick={() => window.print()}>Imprimir factura</button>
      <button className="mini-action" onClick={() => window.location.href='/'}>Volver al menú</button>
    </section>}
  </div>;
}

function MenuAdminApp() {
  usePageChrome();
  if (!getAdminToken()) return <AdminLoginApp />;
  const emptyItem = {
    id: null,
    category: '',
    name_es: '',
    name_en: '',
    description_es: '',
    description_en: '',
    price: '0.00',
    is_active: true,
    is_available: true,
    sort_order: 0,
  };
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [catForm, setCatForm] = useState({ name_es: '', name_en: '', slug: '', sort_order: 0, is_active: true });
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryPoint, setDeliveryPoint] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState([]);

  async function loadAdminMenu() {
    try {
      const [catRes, itemRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/categories/`),
        axios.get(`${API_BASE}/admin/menu-items/`),
      ]);
      setCategories(catRes.data || []);
      setItems(itemRes.data || []);
    } catch (err) {
      setMessage('No se pudo cargar la gestión del menú. Revisa el backend.');
    }
  }

  useEffect(() => { loadAdminMenu(); }, []);

  function makeSlug(value) {
    return (value || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async function saveCategory() {
    try {
      setLoading(true);
      const payload = { ...catForm, slug: catForm.slug || makeSlug(catForm.name_es) };
      await axios.post(`${API_BASE}/admin/categories/`, payload);
      setCatForm({ name_es: '', name_en: '', slug: '', sort_order: 0, is_active: true });
      setMessage('Categoría guardada.');
      await loadAdminMenu();
    } catch (err) {
      setMessage('No se pudo guardar la categoría. Revisa que el slug no esté repetido.');
    } finally {
      setLoading(false);
    }
  }

  async function saveItem() {
    try {
      setLoading(true);
      const payload = { ...itemForm, category: itemForm.category || null };
      let saved;
      if (itemForm.id) {
        const res = await axios.patch(`${API_BASE}/admin/menu-items/${itemForm.id}/`, payload);
        saved = res.data;
      } else {
        const res = await axios.post(`${API_BASE}/admin/menu-items/`, payload);
        saved = res.data;
      }

      if (selectedFile && saved.id) {
        const fd = new FormData();
        fd.append('image', selectedFile);
        await axios.post(`${API_BASE}/admin/menu-items/${saved.id}/image/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setItemForm(emptyItem);
      setSelectedFile(null);
      setMessage('Producto guardado correctamente.');
      await loadAdminMenu();
    } catch (err) {
      setMessage('No se pudo guardar el producto. Revisa categoría, precio y backend.');
    } finally {
      setLoading(false);
    }
  }

  async function archiveItem(item) {
    if (!confirm(`¿Archivar ${item.name_es}?`)) return;
    try {
      await axios.delete(`${API_BASE}/admin/menu-items/${item.id}/`);
      setMessage('Producto archivado.');
      await loadAdminMenu();
    } catch (err) {
      setMessage('No se pudo archivar el producto.');
    }
  }

  async function toggleItem(item, field) {
    try {
      await axios.patch(`${API_BASE}/admin/menu-items/${item.id}/`, { [field]: !item[field] });
      await loadAdminMenu();
    } catch (err) {
      setMessage('No se pudo actualizar el estado del producto.');
    }
  }

  function editItem(item) {
    setItemForm({
      id: item.id,
      category: item.category || '',
      name_es: item.name_es || '',
      name_en: item.name_en || '',
      description_es: item.description_es || '',
      description_en: item.description_en || '',
      price: item.price || '0.00',
      is_active: Boolean(item.is_active),
      is_available: Boolean(item.is_available),
      sort_order: item.sort_order || 0,
    });
    setSelectedFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <div>
    <Header title="Gestión de menú" subtitle="Productos, precios, fotos y categorías">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
      <button dataRoles="admin" onClick={() => window.location.href='/dashboard'}>Dashboard</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page menu-admin-page">
      <h1>Administración del menú</h1>
      <p className="muted">Desde aquí puedes añadir comida, editar precios, activar/desactivar productos y subir fotos.</p>

      <section className="admin-panels">
        <div className="admin-panel">
          <h2>Nueva categoría</h2>
          <input placeholder="Nombre ES" value={catForm.name_es} onChange={e => setCatForm({...catForm, name_es: e.target.value, slug: makeSlug(e.target.value)})} />
          <input placeholder="Nombre EN" value={catForm.name_en} onChange={e => setCatForm({...catForm, name_en: e.target.value})} />
          <input placeholder="slug" value={catForm.slug} onChange={e => setCatForm({...catForm, slug: e.target.value})} />
          <input type="number" placeholder="Orden" value={catForm.sort_order} onChange={e => setCatForm({...catForm, sort_order: Number(e.target.value)})} />
          <button className="pay" disabled={loading || !catForm.name_es} onClick={saveCategory}>Guardar categoría</button>
        </div>

        <div className="admin-panel product-form">
          <h2>{itemForm.id ? 'Editar producto' : 'Nuevo producto'}</h2>
          <select value={itemForm.category || ''} onChange={e => setItemForm({...itemForm, category: e.target.value})}>
            <option value="">Selecciona categoría</option>
            {categories.map(c => <option value={c.id} key={c.id}>{c.name_es}</option>)}
          </select>
          <input placeholder="Nombre ES" value={itemForm.name_es} onChange={e => setItemForm({...itemForm, name_es: e.target.value})} />
          <input placeholder="Nombre EN" value={itemForm.name_en} onChange={e => setItemForm({...itemForm, name_en: e.target.value})} />
          <textarea placeholder="Descripción ES" value={itemForm.description_es} onChange={e => setItemForm({...itemForm, description_es: e.target.value})} />
          <textarea placeholder="Descripción EN" value={itemForm.description_en} onChange={e => setItemForm({...itemForm, description_en: e.target.value})} />
          <div className="form-row">
            <input type="number" step="0.01" placeholder="Precio" value={itemForm.price} onChange={e => setItemForm({...itemForm, price: e.target.value})} />
            <input type="number" placeholder="Orden" value={itemForm.sort_order} onChange={e => setItemForm({...itemForm, sort_order: Number(e.target.value)})} />
          </div>
          <div className="checks">
            <label><input type="checkbox" checked={itemForm.is_active} onChange={e => setItemForm({...itemForm, is_active: e.target.checked})}/> Activo</label>
            <label><input type="checkbox" checked={itemForm.is_available} onChange={e => setItemForm({...itemForm, is_available: e.target.checked})}/> Disponible</label>
          </div>
          <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
          <div className="form-actions">
            <button className="pay" disabled={loading || !itemForm.name_es || !itemForm.category} onClick={saveItem}>Guardar producto</button>
            {itemForm.id && <button className="mini-action" onClick={() => { setItemForm(emptyItem); setSelectedFile(null); }}>Cancelar edición</button>}
          </div>
        </div>
      </section>

      <section className="menu-table-wrap">
        <h2>Productos actuales</h2>
        <table className="menu-table">
          <thead><tr><th>Foto</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map(item => <tr key={item.id} className={!item.is_active ? 'disabled-row' : ''}>
              <td>{item.image_url ? <img src={item.image_url} alt={item.name_es} /> : <span className="no-photo">Sin foto</span>}</td>
              <td><b>{item.name_es}</b><small>{item.description_es}</small></td>
              <td>{item.category_name || '-'}</td>
              <td>{money(item.price)}</td>
              <td><span className={item.is_available ? 'badge-ok' : 'badge-warn'}>{item.is_available ? 'Disponible' : 'No disponible'}</span></td>
              <td className="table-actions">
                <button onClick={() => editItem(item)}>Editar</button>
                <button onClick={() => toggleItem(item, 'is_available')}>{item.is_available ? 'Pausar' : 'Activar'}</button>
                <button onClick={() => archiveItem(item)}>Archivar</button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </section>
    </main>
  </div>;
}


function SettingsAdminApp() {
  usePageChrome();
  if (!getAdminToken()) return <AdminLoginApp />;
  const [settings, setSettings] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({ code: 'PRIMERPEDIDO', description: '10% primer pedido', discount_type: 'percent', value: '10.00', minimum_order: '10.00', first_order_only: true, is_active: true, max_uses: 0 });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryPoint, setDeliveryPoint] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState([]);

  async function loadSettings() {
    const s = await axios.get(`${API_BASE}/admin/settings/`);
    setSettings(s.data);
    const c = await axios.get(`${API_BASE}/admin/coupons/`);
    setCoupons(c.data || []);
  }

  useEffect(() => { loadSettings().catch(() => setMessage('No se pudieron cargar los ajustes.')); }, []);

  async function saveSettings() {
    try {
      setLoading(true);
      const res = await axios.patch(`${API_BASE}/admin/settings/`, settings);
      setSettings(res.data);
      setMessage('Ajustes guardados.');
    } catch (err) {
      setMessage('No se pudieron guardar los ajustes.');
    } finally {
      setLoading(false);
    }
  }

  async function saveCoupon() {
    try {
      setLoading(true);
      const payload = { ...couponForm, code: couponForm.code.toUpperCase() };
      if (couponForm.id) {
        await axios.patch(`${API_BASE}/admin/coupons/${couponForm.id}/`, payload);
      } else {
        await axios.post(`${API_BASE}/admin/coupons/`, payload);
      }
      setCouponForm({ code: '', description: '', discount_type: 'percent', value: '10.00', minimum_order: '0.00', first_order_only: false, is_active: true, max_uses: 0 });
      setMessage('Cupón guardado.');
      await loadSettings();
    } catch (err) {
      setMessage('No se pudo guardar el cupón. Revisa que el código no esté repetido.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleCoupon(coupon) {
    try {
      await axios.patch(`${API_BASE}/admin/coupons/${coupon.id}/`, { is_active: !coupon.is_active });
      await loadSettings();
    } catch (err) {
      setMessage('No se pudo cambiar el estado del cupón.');
    }
  }

  if (!settings) return <div><Header title="Ajustes" subtitle="Casa de Kebab Turco"><button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button></Header><main className="orders-page"><p>Cargando...</p></main></div>;

  return <div>
    <Header title="Ajustes del restaurante" subtitle="Horario, envío, pedidos y descuentos">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
      <button dataRoles="admin" onClick={() => window.location.href='/menu-admin'}>Menú Admin</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page settings-page">
      <h1>Configuración general</h1>
      <section className="admin-panels">
        <div className="admin-panel">
          <h2>Restaurante</h2>
          <input value={settings.restaurant_name || ''} onChange={e => setSettings({...settings, restaurant_name:e.target.value})} placeholder="Nombre" />
          <input value={settings.phone || ''} onChange={e => setSettings({...settings, phone:e.target.value})} placeholder="Teléfono" />
          <input value={settings.address || ''} onChange={e => setSettings({...settings, address:e.target.value})} placeholder="Dirección" />
          <input value={settings.opening_hours || ''} onChange={e => setSettings({...settings, opening_hours:e.target.value})} placeholder="Horario" />
          <div className="checks">
            <label><input type="checkbox" checked={settings.is_open} onChange={e => setSettings({...settings, is_open:e.target.checked})}/> Restaurante abierto</label>
            <label><input type="checkbox" checked={settings.collection_enabled} onChange={e => setSettings({...settings, collection_enabled:e.target.checked})}/> Recogida activa</label>
            <label><input type="checkbox" checked={settings.delivery_enabled} onChange={e => setSettings({...settings, delivery_enabled:e.target.checked})}/> Reparto activo</label>
          </div>
        </div>
        <div className="admin-panel">
          <h2>Envío</h2>
          <label>Coste de envío</label>
          <input type="number" step="0.01" value={settings.delivery_fee} onChange={e => setSettings({...settings, delivery_fee:e.target.value})} />
          <label>Pedido mínimo para reparto</label>
          <input type="number" step="0.01" value={settings.minimum_delivery_order} onChange={e => setSettings({...settings, minimum_delivery_order:e.target.value})} />
          <label>Envío gratis desde</label>
          <input type="number" step="0.01" value={settings.free_delivery_minimum} onChange={e => setSettings({...settings, free_delivery_minimum:e.target.value})} />
          <button className="pay" disabled={loading} onClick={saveSettings}>Guardar ajustes</button>
        </div>
      </section>

      <section className="admin-panels">
        <div className="admin-panel">
          <h2>{couponForm.id ? 'Editar cupón' : 'Nuevo cupón'}</h2>
          <input placeholder="Código" value={couponForm.code} onChange={e => setCouponForm({...couponForm, code:e.target.value.toUpperCase()})} />
          <input placeholder="Descripción" value={couponForm.description} onChange={e => setCouponForm({...couponForm, description:e.target.value})} />
          <select value={couponForm.discount_type} onChange={e => setCouponForm({...couponForm, discount_type:e.target.value})}>
            <option value="percent">Porcentaje</option>
            <option value="amount">Importe fijo</option>
          </select>
          <div className="form-row">
            <input type="number" step="0.01" placeholder="Valor" value={couponForm.value} onChange={e => setCouponForm({...couponForm, value:e.target.value})} />
            <input type="number" step="0.01" placeholder="Pedido mínimo" value={couponForm.minimum_order} onChange={e => setCouponForm({...couponForm, minimum_order:e.target.value})} />
          </div>
          <div className="checks">
            <label><input type="checkbox" checked={couponForm.first_order_only} onChange={e => setCouponForm({...couponForm, first_order_only:e.target.checked})}/> Sólo primer pedido</label>
            <label><input type="checkbox" checked={couponForm.is_active} onChange={e => setCouponForm({...couponForm, is_active:e.target.checked})}/> Activo</label>
          </div>
          <button className="pay" disabled={loading || !couponForm.code} onClick={saveCoupon}>Guardar cupón</button>
        </div>
        <div className="admin-panel wide-panel">
          <h2>Cupones actuales</h2>
          <table className="menu-table">
            <thead><tr><th>Código</th><th>Descuento</th><th>Mínimo</th><th>Usos</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{coupons.map(c => <tr key={c.id}>
              <td><b>{c.code}</b><small>{c.description}</small></td>
              <td>{c.discount_type === 'percent' ? `${c.value}%` : money(c.value)}</td>
              <td>{money(c.minimum_order)}</td>
              <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
              <td><span className={c.is_active ? 'badge-ok' : 'badge-warn'}>{c.is_active ? 'Activo' : 'Pausado'}</span></td>
              <td className="table-actions"><button onClick={() => setCouponForm(c)}>Editar</button><button onClick={() => toggleCoupon(c)}>{c.is_active ? 'Pausar' : 'Activar'}</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  </div>;
}


function PaymentDemoApp() {
  usePageChrome();
  const orderCode = window.location.pathname.split('/').filter(Boolean).pop();
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryPoint, setDeliveryPoint] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState([]);

  async function loadPayment() {
    try {
      const res = await axios.get(`${API_BASE}/payments/demo/${orderCode}/status/`);
      setOrder(res.data);
    } catch (err) {
      setMessage('No se pudo cargar el pago. Revisa el backend.');
    }
  }

  useEffect(() => { loadPayment(); }, []);

  async function finishPayment(result) {
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/payments/demo/${orderCode}/confirm/`, { result });
      setOrder(res.data.order);
      if (result === 'success') {
        setMessage('Pago confirmado correctamente. Redirigiendo al ticket...');
        setTimeout(() => { window.location.href = `/receipt/${orderCode}`; }, 900);
      } else {
        setMessage('Pago marcado como fallido. Puedes volver al pedido o pagar en tienda.');
      }
    } catch (err) {
      setMessage('No se pudo actualizar el pago.');
    } finally {
      setLoading(false);
    }
  }

  return <div>
    <Header title="Pago online" subtitle="Modo demo · Casa de Kebab Turco">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page payment-page">
      <section className="payment-card">
        <h1>Pago online demo</h1>
        <p className="muted">Esta pantalla simula Stripe/Redsys para probar el flujo completo. No cobra dinero real.</p>
        {!order && <p>Cargando pago...</p>}
        {order && <>
          <div className="payment-row"><span>Pedido</span><b>{order.order_code}</b></div>
          <div className="payment-row"><span>Cliente</span><b>{order.customer_name || order.customer_phone}</b></div>
          <div className="payment-row"><span>Estado pago</span><b>{order.payment_status}</b></div>
          <div className="payment-total"><span>Total</span><b>{money(order.total)}</b></div>
          <div className="payment-actions">
            <button disabled={loading || order.payment_status === 'paid'} className="pay" onClick={() => finishPayment('success')}>Simular pago correcto</button>
            <button disabled={loading} className="danger-button" onClick={() => finishPayment('failed')}>Simular pago fallido</button>
          </div>
          <button className="mini-action" onClick={() => window.location.href=`/receipt/${orderCode}`}>Ver ticket</button>
        </>}
      </section>
    </main>
  </div>;
}


function AccessDeniedApp() {
  usePageChrome();
  const role = getCurrentRole();
  return <div>
    <Header title="Acceso restringido" subtitle="Casa de Kebab Turco">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Inicio</button>
      <button dataRoles="customer,staff,admin" onClick={() => window.location.href='/account'}>Cuenta</button>
      <button dataRoles="rider,staff,admin" onClick={() => window.location.href='/rider'}>Repartidor</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
      <button dataRoles="admin" onClick={() => window.location.href='/dashboard'}>Dashboard</button>
    </Header>
    <main className="orders-page access-denied-page">
      <section className="access-card">
        <img src={restaurantLogo} alt="Casa de Kebab Turco" />
        <h1>Acceso restringido</h1>
        <p>Tu perfil actual es <b>{ROLE_LABELS[role] || role}</b>. Esta sección sólo se muestra a usuarios con permiso.</p>
        <p className="muted">برای بخش مدیریت باید از صفحه ورود Admin وارد شوی.</p>
        <button className="pay" onClick={() => window.location.href=isAdminRoute() ? '/admin-login' : '/'}>{isAdminRoute() ? 'ورود Admin' : 'Volver al sitio'}</button>
      </section>
    </main>
  </div>;
}

function pickApp() {
  if (window.location.pathname.includes('admin-login')) return AdminLoginApp;
  if (isAdminRoute() && !getAdminToken()) return AdminLoginApp;
  const role = getCurrentRole();
  if (!canAccessPath(role, window.location.pathname)) return AccessDeniedApp;
  if (window.location.pathname.includes('orders-live')) return LiveOrdersApp;
  if (window.location.pathname.includes('rider')) return RiderApp;
  if (window.location.pathname.includes('track')) return TrackOrderApp;
  if (window.location.pathname.includes('account')) return AccountApp;
  if (window.location.pathname.includes('dashboard')) return DashboardApp;
  if (window.location.pathname.includes('menu-admin')) return MenuAdminApp;
  if (window.location.pathname.includes('settings-admin')) return SettingsAdminApp;
  if (window.location.pathname.includes('payment-demo')) return PaymentDemoApp;
  if (window.location.pathname.includes('receipt')) return ReceiptApp;
  return App;
}

const RootApp = pickApp();
createRoot(document.getElementById('root')).render(<RootApp />);



