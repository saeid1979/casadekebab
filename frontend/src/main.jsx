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
      <div><strong>{title}</strong><span>{subtitle}</span></div>
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

function App() {
  usePageChrome();
  const [menu, setMenu] = useState(fallbackMenu);
  const [cart, setCart] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('details');
  const [phone, setPhone] = useState(() => getSessionCustomer()?.phone || '+34');
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
    if (form.delivery_type !== 'delivery') return 0;
    return calculateDynamicDeliveryFee(deliveryDistance, subtotal, settings);
  }, [form.delivery_type, settings, subtotal, deliveryDistance]);
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
    try {
      setLoading(true);
      setMessage('');
      await axios.post(`${API_BASE}/auth/send-code/`, { phone });
      setCodeSent(true);
      setMessage('Código enviado. En modo prueba mira la terminal de Django.');
    } catch (err) {
      setMessage('No se pudo enviar el código. Revisa el backend.');
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

  async function placeOrder() {
    try {
      if (!phone || phone.length < 6) return setLoginOpen(true);
      if (!cart.length) return setMessage('La cesta está vacía.');
      if (form.delivery_type === 'delivery' && !form.address.trim()) return setMessage('La dirección es obligatoria para entrega a domicilio.');
      if (form.delivery_type === 'delivery' && !deliveryAllowed) return setMessage(`Esta dirección está fuera de la zona de reparto (${DEFAULT_DELIVERY_RADIUS_KM} km).`);

      setLoading(true);
      const payload = {
        customer_name: form.name,
        customer_phone: phone,
        delivery_type: form.delivery_type,
        address: form.address,
        delivery_latitude: deliveryPoint?.lat || null,
        delivery_longitude: deliveryPoint?.lng || null,
        route_distance_km: deliveryDistance || null,
        route_duration_min: deliveryDuration || null,
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
      if (form.payment_method === 'online') {
        await axios.post(`${API_BASE}/payments/demo/${orderCode}/create/`);
        window.location.href = `/payment-demo/${orderCode}`;
        return;
      }
      setMessage(`Pedido confirmado: ${orderCode}. Puedes ver el ticket en /receipt/${orderCode}`);
    } catch (err) {
      setMessage('No se pudo registrar el pedido. Revisa que el menú esté cargado en la base de datos.');
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
        <button className="pay blink" disabled={!cart.length} onClick={() => { setCheckoutStep('details'); setCheckoutOpen(true); }}>Proceder al pago <b>{money(total)}</b></button>
      </aside>
    </main>

    <LocationSection />

    {activeItem && <ProductModal item={activeItem} onClose={() => setActiveItem(null)} onAdd={(item, options) => { addItem(item, options); setActiveItem(null); }} />}

    {loginOpen && <Modal onClose={() => setLoginOpen(false)}>
      <h2>Identifícate con tu número de móvil</h2>
      <p>Te enviaremos por SMS un código de verificación y sólo utilizaremos tu número para actualizaciones importantes de tu pedido.</p>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+34" />
      {!codeSent ? <button className="pay" disabled={loading} onClick={sendCode}>Continuar</button> : <>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código" />
        <button className="pay" disabled={loading} onClick={verifyCode}>Verificar</button>
      </>}
    </Modal>}

    {checkoutOpen && <Modal onClose={() => setCheckoutOpen(false)} className="checkout-modal checkout-details-modal direct-checkout-modal">
      <div className="checkout-details-head">
        <h2>Finalizar pedido</h2>
        <p>Completa tus datos para confirmar el pedido.</p>
      </div>

      <div className="delivery-choice-header direct-choice-header">
        <button className={form.delivery_type === 'delivery' ? 'choice-tab active' : 'choice-tab'} onClick={() => setForm({...form, delivery_type:'delivery', payment_method: form.payment_method === 'store' ? 'cash' : form.payment_method})}>🛵 Entregar</button>
        <button className={form.delivery_type === 'collection' ? 'choice-tab active' : 'choice-tab'} onClick={() => setForm({...form, delivery_type:'collection', address: RESTAURANT_ADDRESS, floor: '', payment_method: form.payment_method === 'card_delivery' ? 'store' : form.payment_method})}>🛍️ Recoger</button>
      </div>

      <input placeholder="Nombre" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
      <input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)}/>

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
        <option value="online">Pago online</option>
      </select>
      <button className="pay" disabled={loading || settings?.is_open === false || (form.delivery_type === 'delivery' && !form.address.trim()) || !deliveryAllowed} onClick={placeOrder}>Confirmar pedido <b>{money(total)}</b></button>
    </Modal>}
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
  const [newRider, setNewRider] = useState({ name: '', phone: '' });
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

  async function addRider() {
    try {
      if (!newRider.name || !newRider.phone) return setMessage('Nombre y teléfono del repartidor son obligatorios.');
      await axios.post(`${API_BASE}/riders/`, newRider);
      setNewRider({ name: '', phone: '' });
      await loadRiders();
      setMessage('Repartidor guardado.');
    } catch (err) {
      setMessage('No se pudo guardar el repartidor.');
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
        <h2>Repartidores</h2>
        <div className="inline-form">
          <input placeholder="Nombre" value={newRider.name} onChange={e => setNewRider({...newRider, name: e.target.value})}/>
          <input placeholder="Teléfono" value={newRider.phone} onChange={e => setNewRider({...newRider, phone: e.target.value})}/>
          <button onClick={addRider}>Añadir repartidor</button>
        </div>
        <div className="rider-list">{riders.map(r => <span key={r.id}>{r.name} · {r.phone} · {r.active_orders_count} pedidos</span>)}</div>
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
            {riders.map(r => <option key={r.id} value={r.id}>{r.name} · {r.phone}</option>)}
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
  const rider = order?.assigned_rider_data;
  const riderLat = rider?.current_latitude ? Number(rider.current_latitude) : null;
  const riderLng = rider?.current_longitude ? Number(rider.current_longitude) : null;
  const customerLat = order?.delivery_latitude ? Number(order.delivery_latitude) : null;
  const customerLng = order?.delivery_longitude ? Number(order.delivery_longitude) : null;

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { scrollWheelZoom: true, zoomControl: true }).setView([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], 14);
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
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];
    const points = [];

    const restaurantIcon = L.divIcon({
      className: 'tracking-restaurant-marker',
      html: `<img src="${restaurantLogo}" alt="Casa de Kebab Turco" />`,
      iconSize: [54, 54],
      iconAnchor: [27, 54],
      popupAnchor: [0, -52]
    });
    const restaurantMarker = L.marker([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], { icon: restaurantIcon }).addTo(map).bindPopup(`<b>Casa de Kebab Turco</b><br/>${RESTAURANT_ADDRESS}`);
    layersRef.current.push(restaurantMarker);
    points.push([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng]);

    if (riderLat && riderLng) {
      const riderMarker = L.circleMarker([riderLat, riderLng], {
        radius: 11,
        color: '#0b6b35',
        fillColor: '#21b15c',
        fillOpacity: .95,
        weight: 4
      }).addTo(map).bindPopup(`<b>Repartidor</b><br/>${rider?.name || ''}<br/>${rider?.phone || ''}`);
      layersRef.current.push(riderMarker);
      points.push([riderLat, riderLng]);
    }

    if (customerLat && customerLng) {
      const customerMarker = L.marker([customerLat, customerLng]).addTo(map).bindPopup(`<b>Cliente</b><br/>${order?.address || ''}`);
      layersRef.current.push(customerMarker);
      points.push([customerLat, customerLng]);
    }

    if (riderLat && riderLng) {
      const routePoints = customerLat && customerLng
        ? [[riderLat, riderLng], [customerLat, customerLng]]
        : [[RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], [riderLat, riderLng]];
      const line = L.polyline(routePoints, { color: '#b3261e', weight: 4, opacity: .75, dashArray: '8 10' }).addTo(map);
      layersRef.current.push(line);
    }

    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 });
    else map.setView([RESTAURANT_COORD.lat, RESTAURANT_COORD.lng], 14);
  }, [order?.order_code, riderLat, riderLng, customerLat, customerLng]);

  return <div className={compact ? 'tracking-map compact' : 'tracking-map'}>
    <div ref={boxRef} className="tracking-map-box"></div>
    {(!riderLat || !riderLng) && <div className="tracking-map-note">Todavía no hay ubicación GPS del repartidor. Se mostrará aquí cuando el repartidor envíe su ubicación.</div>}
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
        <div className="admin-card"><h2>Mapa en vivo</h2><TrackingMap order={order} /></div>
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


function AccountApp() {
  usePageChrome();
  const [phone, setPhone] = useState(localStorage.getItem('customer_phone') || '+34');
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');

  async function loadAccount() {
    try {
      if (!phone || phone.length < 6) return setMessage('Introduce un teléfono válido.');
      localStorage.setItem('customer_phone', phone);
      const res = await axios.get(`${API_BASE}/customers/orders/?phone=${encodeURIComponent(phone)}`);
      if (!res.data.exists) {
        setCustomer(null);
        setOrders([]);
        return setMessage('No hemos encontrado pedidos para este teléfono.');
      }
      setCustomer(res.data.customer);
      setOrders(res.data.orders || []);
      setMessage('');
    } catch (err) {
      setMessage('No se pudo cargar la cuenta. Revisa el backend.');
    }
  }

  useEffect(() => {
    if (phone && phone !== '+34') loadAccount();
  }, []);

  const totalSpent = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  return <div>
    <Header title="Mi cuenta" subtitle="Historial de pedidos">
      <button dataRoles="guest,customer,rider,staff,admin" onClick={() => window.location.href='/'}>Sitio</button>
      <button dataRoles="staff,admin" onClick={() => window.location.href='/orders-live'}>Pedidos</button>
    </Header>
    {message && <div className="toast">{message}</div>}
    <main className="orders-page account-page">
      <h1>Cuenta del cliente</h1>
      <div className="rider-login">
        <input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} />
        <button onClick={loadAccount}>Buscar</button>
      </div>
      {customer && <section className="summary-cards">
        <div><b>{customer.name || 'Cliente'}</b><span>{customer.phone}</span></div>
        <div><b>{customer.total_orders}</b><span>Pedidos registrados</span></div>
        <div><b>{money(totalSpent)}</b><span>Gasto total</span></div>
        <div><b>{customer.default_address || 'Sin dirección'}</b><span>Última dirección</span></div>
      </section>}
      <div className="orders-grid">
        {orders.map(order => <article className={`order-card status-${order.status}`} key={order.id}>
          <div className="order-head"><h2>{order.order_code}</h2><strong>{money(order.total)}</strong></div>
          <p><b>Estado:</b> {order.status}</p>
          <p><b>Pago:</b> {order.payment_method} · {order.payment_status}</p>
          <p><b>Fecha:</b> {new Date(order.created_at).toLocaleString()}</p>
          <div className="order-items">{(order.items || []).map(item => <div key={item.id}>{item.quantity} x {item.name_snapshot}<span>{money(item.total)}</span></div>)}</div>
          <button className="mini-action" onClick={() => window.open(`/receipt/${order.order_code}`, '_blank')}>Ver ticket</button>
        </article>)}
      </div>
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
  const [newRider, setNewRider] = useState({ name: '', phone: '' });

  async function loadAdminPanel() {
    try {
      const [summaryRes, ordersRes, ridersRes, customersRes, catRes, itemRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE}/dashboard/summary/`),
        axios.get(`${API_BASE}/orders/live/?limit=80`),
        axios.get(`${API_BASE}/riders/`),
        axios.get(`${API_BASE}/admin/customers/`),
        axios.get(`${API_BASE}/admin/categories/`),
        axios.get(`${API_BASE}/admin/menu-items/`),
        axios.get(`${API_BASE}/admin/settings/`),
      ]);
      setData(summaryRes.data);
      setOrders(ordersRes.data || []);
      setRiders(ridersRes.data || []);
      setCustomers(customersRes.data || []);
      setCategories(catRes.data || []);
      setItems(itemRes.data || []);
      setSettings(settingsRes.data || null);
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

  async function createRiderFromAdmin() {
    try {
      const name = newRider.name.trim();
      const phone = newRider.phone.trim();
      if (!name || !phone) {
        setMessage('Nombre y teléfono del repartidor son obligatorios.');
        return;
      }
      await axios.post(`${API_BASE}/riders/`, { name, phone });
      setNewRider({ name: '', phone: '' });
      setMessage('Repartidor creado o actualizado correctamente.');
      await loadAdminPanel();
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'No se pudo crear el repartidor.');
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
  const cardRows = (data?.payment_breakdown || []).filter(p => ['card_delivery', 'online'].includes(p.payment_method));
  const tabs = [
    ['overview','Resumen'],
    ['orders','Pedidos vivos'],
    ['riders','Repartidores'],
    ['tracking','Mapa repartidores en vivo'],
    ['customers','Clientes'],
    ['accounting','Contabilidad'],
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
        {tabs.map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
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

      {tab === 'orders' && <section className="admin-card"><h2>Pedidos vivos</h2><p className="muted">Los pedidos de entrega se asignan automáticamente al repartidor activo con menos pedidos. También puedes forzar la asignación desde aquí.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Estado</th><th>Pago</th><th>Repartidor</th><th>Acciones</th></tr></thead><tbody>{activeOrders.map(o => <tr key={o.order_code}><td><b>{o.order_code}</b><small>{new Date(o.created_at).toLocaleString()}</small></td><td>{o.customer_name}<small>{o.customer_phone}</small></td><td>{o.delivery_type === 'delivery' ? 'Entrega' : 'Recoger'}</td><td>{money(o.total)}</td><td>{o.status}</td><td>{o.payment_method} · {o.payment_status}</td><td>{o.delivery_type === 'delivery' ? <><select className="admin-rider-select" value={o.assigned_rider_data?.id || ''} onChange={e => assignRiderFromAdmin(o.order_code, e.target.value)}><option value="">Sin asignar</option>{riders.map(r => <option key={r.id} value={r.id}>{r.name} · {r.active_orders_count || 0}</option>)}</select><button className="mini-action" onClick={() => autoAssignRider(o.order_code)}>Auto</button></> : '-'}</td><td><button onClick={() => quickStatus(o.order_code,'accepted')}>Aceptar</button><button onClick={() => quickStatus(o.order_code,'preparing')}>Preparar</button><button onClick={() => quickStatus(o.order_code,'out_for_delivery')}>Enviar</button><button onClick={() => quickStatus(o.order_code,'delivered')}>Entregado</button><button onClick={() => quickPayment(o.order_code,'paid')}>Pagado</button></td></tr>)}</tbody></table></div></section>}

      {tab === 'riders' && <section className="admin-grid-2 riders-admin-grid"><div className="admin-card"><h2>Crear repartidor</h2><p className="muted">El administrador puede registrar repartidores con nombre y teléfono. El teléfono es la clave para entrar en la vista repartidor.</p><div className="admin-rider-form"><input placeholder="Nombre del repartidor" value={newRider.name} onChange={e => setNewRider({...newRider, name: e.target.value})}/><input placeholder="Teléfono" value={newRider.phone} onChange={e => setNewRider({...newRider, phone: e.target.value})}/><button className="pay" onClick={createRiderFromAdmin}>Guardar repartidor</button></div><h2>Lista de repartidores</h2>{riders.map(r => <p key={r.id} className="rider-admin-row"><b>{r.name}</b><span>{r.phone} · {r.active_orders_count || 0} pedidos activos · {r.is_active ? 'Activo' : 'Pausado'}</span></p>)}{!riders.length && <p className="muted">Todavía no hay repartidores.</p>}</div><div className="admin-card"><h2>Pedidos para reparto</h2><p className="muted">Usa Auto para asignar el pedido al repartidor libre con menos pedidos activos.</p>{orders.filter(o => o.delivery_type === 'delivery').slice(0,20).map(o => <div className="rider-order-row" key={o.order_code}><p><b>{o.order_code}</b><span>{o.address || 'Sin dirección'} · {o.assigned_rider_data?.name || 'Sin repartidor'}</span></p><button className="mini-action" onClick={() => autoAssignRider(o.order_code)}>Asignar libre</button></div>)}</div></section>}

      {tab === 'tracking' && <section className="admin-tracking-grid">{orders.filter(o => o.delivery_type === 'delivery' && !['delivered','cancelled'].includes(o.status)).map(o => <article className="admin-card tracking-admin-card" key={o.order_code}><div className="order-head"><h2>{o.order_code}</h2><strong>{o.status}</strong></div><p><b>Cliente:</b> {o.customer_name || 'Sin nombre'} · {o.customer_phone}</p><p><b>Dirección:</b> {o.address || '-'}</p><p><b>Repartidor:</b> {o.assigned_rider_data?.name || 'Sin asignar'} {o.assigned_rider_data?.phone ? `· ${o.assigned_rider_data.phone}` : ''}</p>{o.assigned_rider_data?.last_location_at && <small>Última ubicación: {new Date(o.assigned_rider_data.last_location_at).toLocaleString()}</small>}<TrackingMap order={o} compact /></article>)}{!orders.filter(o => o.delivery_type === 'delivery' && !['delivered','cancelled'].includes(o.status)).length && <div className="admin-card"><h2>Sin pedidos en reparto</h2><p className="muted">Cuando un pedido se asigne a un repartidor, aparecerá aquí con su ubicación GPS.</p></div>}</section>}

      {tab === 'customers' && <section className="admin-card"><h2>Clientes</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Dirección</th><th>Pedidos</th><th>Total gastado</th><th>Último pedido</th></tr></thead><tbody>{customers.map(c => <tr key={c.id}><td><b>{c.name || 'Sin nombre'}</b><small>{c.email}</small></td><td>{c.phone}</td><td>{c.default_address || '-'}</td><td>{c.total_orders}</td><td>{money(c.total_spent)}</td><td>{c.last_order_at ? new Date(c.last_order_at).toLocaleString() : '-'}</td></tr>)}</tbody></table></div></section>}

      {tab === 'accounting' && data && <section className="admin-grid-2"><div className="admin-card accounting-card"><h2>Contabilidad</h2><p><b>Ventas totales</b><span>{money(data.total_sales)}</span></p><p><b>Cobrado</b><span>{money(data.paid_total)}</span></p><p><b>Pendiente de pago</b><span>{money(data.pending_payment_total)}</span></p><p><b>Coste envío cobrado</b><span>{money(data.delivery_fee_total)}</span></p><p><b>Descuentos aplicados</b><span>{money(data.discount_total)}</span></p></div><div className="admin-card"><h2>Por tipo de pedido</h2>{(data.delivery_breakdown || []).map((d,i) => <p key={i}><b>{d.delivery_type}</b><span>{d.count} pedidos · {money(d.total)}</span></p>)}</div></section>}

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
      <button className="print-button" onClick={() => window.print()}>Imprimir ticket</button>
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
