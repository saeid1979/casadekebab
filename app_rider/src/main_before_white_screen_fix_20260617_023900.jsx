import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import L from "leaflet";
import { Geolocation } from "@capacitor/geolocation";
import { PushNotifications } from "@capacitor/push-notifications";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import logo from "./assets/logo.png";

const PROD = "https://casadekebab-backend.onrender.com/api/restaurant";
const ENV = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const API = !ENV || /localhost|127\.0\.0\.1/i.test(ENV) ? PROD : ENV;

const KEY = "cdkt_rider_session";
const LOC = "cdkt_rider_last_location";
const HISTORY_KEY = "cdkt_rider_history_v1";
const ALERT_SEEN_KEY = "cdkt_rider_alert_seen_v1";
const PENDING_PUSH_ORDER_KEY = "cdkt_rider_pending_push_order";
const RIDER_PUSH_CHANNEL_ID = "rider_orders";
const REST = { lat: 40.974836942683254, lng: -5.649336331469509 };

const META = {
  pending: ["Recibido", "amber"],
  accepted: ["Aceptado", "blue"],
  preparing: ["Preparando", "orange"],
  ready: ["Listo", "violet"],
  out_for_delivery: ["En reparto", "green"],
  delivered: ["Entregado", "gray"],
  cancelled: ["Cancelado", "red"],
};

const NEXT = {
  pending: "accepted",
  accepted: "out_for_delivery",
  preparing: "out_for_delivery",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
};

// AUTO_FLOW_PATCH_V1
const AUTO_PROGRESS_TARGET = {
  pending: "accepted",
  accepted: "out_for_delivery",
  preparing: "out_for_delivery",
  ready: "out_for_delivery",
};

const AUTO_PROGRESS_DELAY_MS = {
  pending: 700,
  accepted: 1100,
  preparing: 900,
  ready: 700,
};

const sleep = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;

  const earthRadius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

const money = (value) =>
  `${Number(value || 0).toFixed(2).replace(".", ",")} €`;

const digits = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(-9);

const num = (value) =>
  value === null || value === undefined || value === ""
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;

const valid = (lat, lng) =>
  lat !== null &&
  lng !== null &&
  lat >= 40.8 &&
  lat <= 41.12 &&
  lng >= -5.9 &&
  lng <= -5.35;

const session = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};

const readHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const route = (address) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address || "",
  )}`;

const authHeaders = (rider) => ({
  Authorization: `Bearer ${rider?.token || ""}`,
});

function readSeenOrderCodes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALERT_SEEN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSeenOrderCodes(codes) {
  localStorage.setItem(
    ALERT_SEEN_KEY,
    JSON.stringify(Array.from(new Set(codes)).slice(-200)),
  );
}

function playRiderAlert(durationMs = 5000) {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return () => {};

  const context = new AudioContextClass();
  let stopped = false;
  let timer = null;

  const beep = () => {
    if (stopped) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(620, now + 0.24);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.34);
  };

  const start = async () => {
    try {
      if (context.state === "suspended") {
        await context.resume();
      }
    } catch {
      // Continue even if resume is blocked.
    }

    beep();
    timer = window.setInterval(beep, 520);
  };

  start();

  const stop = () => {
    if (stopped) return;
    stopped = true;

    if (timer) {
      window.clearInterval(timer);
    }

    try {
      context.close();
    } catch {
      // Ignore close error.
    }
  };

  window.setTimeout(stop, durationMs);
  return stop;
}

function NewOrderAlert({ order, onOpen, onClose }) {
  if (!order) return null;

  return (
    <div className="new-order-alert-backdrop" role="alert">
      <button
        type="button"
        className="new-order-alert-card"
        onClick={onOpen}
      >
        <span className="new-order-alert-ring ring-one" />
        <span className="new-order-alert-ring ring-two" />
        <span className="new-order-alert-ring ring-three" />

        <div className="new-order-alert-logo">
          <img src={logo} alt="Casa de Kebab Turco" />
        </div>

        <span className="new-order-alert-kicker">NUEVO PEDIDO</span>
        <h2>{order.order_code}</h2>
        <p>{order.customer_name || "Cliente"}</p>
        <strong>{money(order.total)}</strong>
        <small>Toca para abrir la entrega</small>
      </button>

      <button
        type="button"
        className="new-order-alert-close"
        onClick={onClose}
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  );
}

function Toast({ message, close }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(close, 4200);
    return () => window.clearTimeout(timer);
  }, [message, close]);

  return message ? (
    <button type="button" className="toast" onClick={close}>
      {message}
    </button>
  ) : null;
}

function Login({ done, msg }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function go(event) {
    event.preventDefault();

    if (!username.trim() || !password) {
      msg("Escribe usuario y contraseña.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/auth/rider/login/`,
        {
          username: username.trim(),
          password,
        },
        { timeout: 70000 },
      );

      const user = {
        ...response.data.rider,
        token: response.data.token,
      };

      localStorage.setItem(KEY, JSON.stringify(user));
      done(user);
    } catch (error) {
      msg(
        error?.response?.data?.detail ||
          "Usuario o contraseña incorrectos.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />

      <section className="login-card">
        <div className="login-logo-wrap">
          <img src={logo} alt="Casa de Kebab Turco" />
        </div>

        <span className="eyebrow">RIDER PRO</span>
        <h1>Acceso seguro</h1>
        <p>
          Entra con el usuario y la contraseña asignados por el
          administrador.
        </p>

        <form onSubmit={go}>
          <label>Nombre de usuario</label>
          <div className="field">
            <span>👤</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="repartidor1"
            />
          </div>

          <label>Contraseña</label>
          <div className="field">
            <span>🔒</span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              className="field-action"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          <button className="login-submit" disabled={loading}>
            {loading ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>

        <small>
          El acceso requiere credenciales activas de repartidor.
        </small>
      </section>
    </div>
  );
}

function DeliveryMap({ order, loc, compact = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const routeOutlineRef = useRef(null);
  const routeLineRef = useRef(null);
  const animationRef = useRef(null);
  const lastRouteOriginRef = useRef(null);
  const lastRouteAtRef = useRef(0);
  const fittedRef = useRef(false);

  const customerLat = num(order?.delivery_latitude);
  const customerLng = num(order?.delivery_longitude);
  const riderLat = num(loc?.lat);
  const riderLng = num(loc?.lng);

  const hasCustomer = valid(customerLat, customerLng);
  const hasRider = valid(riderLat, riderLng);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: !compact,
      attributionControl: !compact,
      preferCanvas: true,
    }).setView([REST.lat, REST.lng], compact ? 13 : 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      updateWhenIdle: false,
      keepBuffer: 4,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    L.circleMarker([REST.lat, REST.lng], {
      radius: compact ? 7 : 10,
      color: "#ffffff",
      fillColor: "#8f1d18",
      fillOpacity: 1,
      weight: compact ? 3 : 4,
    })
      .addTo(map)
      .bindPopup("Casa de Kebab Turco");

    mapRef.current = map;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize(false);
    }, 160);

    return () => {
      window.clearTimeout(resizeTimer);

      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }

      map.remove();
      mapRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasCustomer) return;

    const point = [customerLat, customerLng];

    if (!customerMarkerRef.current) {
      customerMarkerRef.current = L.circleMarker(point, {
        radius: compact ? 7 : 10,
        color: "#ffffff",
        fillColor: "#ef4444",
        fillOpacity: 1,
        weight: compact ? 3 : 4,
      })
        .addTo(map)
        .bindPopup("Cliente");
    } else {
      customerMarkerRef.current.setLatLng(point);
    }
  }, [customerLat, customerLng, hasCustomer, compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasRider) return;

    const nextPoint = L.latLng(riderLat, riderLng);

    if (!riderMarkerRef.current) {
      riderMarkerRef.current = L.circleMarker(nextPoint, {
        radius: compact ? 8 : 11,
        color: "#ffffff",
        fillColor: "#16a34a",
        fillOpacity: 1,
        weight: compact ? 4 : 5,
      })
        .addTo(map)
        .bindPopup("Tu ubicación");

      return;
    }

    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
    }

    const marker = riderMarkerRef.current;
    const startPoint = marker.getLatLng();
    const startedAt = performance.now();
    const duration = 900;

    const animate = (time) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;

      const lat =
        startPoint.lat + (nextPoint.lat - startPoint.lat) * eased;
      const lng =
        startPoint.lng + (nextPoint.lng - startPoint.lng) * eased;

      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        animationRef.current = window.requestAnimationFrame(animate);
      }
    };

    animationRef.current = window.requestAnimationFrame(animate);
  }, [riderLat, riderLng, hasRider, compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasRider || !hasCustomer) return;

    const origin = { lat: riderLat, lng: riderLng };
    const destination = { lat: customerLat, lng: customerLng };
    const moved = distanceMeters(lastRouteOriginRef.current, origin);
    const elapsed = Date.now() - lastRouteAtRef.current;

    if (moved < 18 && elapsed < 12000 && routeLineRef.current) {
      return;
    }

    lastRouteOriginRef.current = origin;
    lastRouteAtRef.current = Date.now();

    let cancelled = false;

    async function updateRoute() {
      let line = [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ];

      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
          "?overview=full&geometries=geojson";

        const data = await fetch(url).then((response) => response.json());
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;

        if (coordinates?.length) {
          line = coordinates.map(([lng, lat]) => [lat, lng]);
        }
      } catch {
        // Straight line fallback.
      }

      if (cancelled || !mapRef.current) return;

      if (!routeOutlineRef.current) {
        routeOutlineRef.current = L.polyline(line, {
          color: "#ffffff",
          weight: compact ? 8 : 12,
          opacity: 0.94,
          interactive: false,
          smoothFactor: 1.4,
        }).addTo(map);
      } else {
        routeOutlineRef.current.setLatLngs(line);
      }

      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(line, {
          color: "#8f1d18",
          weight: compact ? 5 : 7,
          opacity: 0.96,
          interactive: false,
          smoothFactor: 1.4,
        }).addTo(map);
      } else {
        routeLineRef.current.setLatLngs(line);
      }

      if (!fittedRef.current) {
        map.fitBounds(
          [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ],
          {
            padding: compact ? [18, 18] : [34, 34],
            maxZoom: compact ? 15 : 16,
            animate: true,
            duration: 0.7,
          },
        );

        fittedRef.current = true;
      }
    }

    updateRoute();

    return () => {
      cancelled = true;
    };
  }, [
    riderLat,
    riderLng,
    customerLat,
    customerLng,
    hasRider,
    hasCustomer,
    compact,
  ]);

  return (
    <div
      ref={containerRef}
      className={compact ? "delivery-map compact-map" : "delivery-map"}
    />
  );
}

function StatusBadge({ status }) {
  const [label, tone] = META[status] || [status, "gray"];

  return <span className={`status-badge ${tone}`}>{label}</span>;
}

function OrderCard({ order, active, onClick }) {
  const itemCount = (order.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  return (
    <button
      type="button"
      className={`order-card ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <div className="order-card-top">
        <div>
          <small>Pedido</small>
          <strong>{order.order_code}</strong>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="order-customer">
        <span className="order-avatar">
          {(order.customer_name || "C").slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h3>{order.customer_name || "Cliente"}</h3>
          <p>{order.address || "Sin dirección"}</p>
        </div>
      </div>

      <div className="order-card-bottom">
        <span>{itemCount} productos</span>
        <b>{money(order.total)}</b>
      </div>
    </button>
  );
}

function Chat({ order, rider, msg }) {
  const [list, setList] = useState([]);
  const [text, setText] = useState("");

  async function load() {
    try {
      const response = await axios.get(
        `${API}/orders/${order.order_code}/chat/`,
        {
          params: {
            phone: rider.phone,
            sender_type: "rider",
          },
        },
      );

      setList(
        Array.isArray(response.data)
          ? response.data
          : response.data.messages || [],
      );
    } catch {
      // Chat is non-blocking.
    }
  }

  useEffect(() => {
    let cleanup = () => {};

    setupRiderPushNotifications(
      rider,
      openOrderByCode,
      msg,
    ).then((removeListeners) => {
      cleanup = removeListeners;
      setPushReady(true);

      const pendingOrderCode =
        localStorage.getItem(PENDING_PUSH_ORDER_KEY);

      if (pendingOrderCode) {
        window.setTimeout(() => {
          openOrderByCode(pendingOrderCode);
        }, 600);
      }
    });

    return () => {
      cleanup();
    };
  }, [rider?.token]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [order.order_code]);

  async function send() {
    if (!text.trim()) return;

    try {
      await axios.post(`${API}/orders/${order.order_code}/chat/`, {
        phone: rider.phone,
        sender_type: "rider",
        sender_name: rider.name || "Repartidor",
        message: text.trim(),
      });

      setText("");
      load();
    } catch (error) {
      msg(error?.response?.data?.detail || "No se pudo enviar.");
    }
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <div>
          <small>Comunicación</small>
          <h2>Chat con cliente</h2>
        </div>
        <span className="live-pill">Auto 5s</span>
      </div>

      <div className="chat-list">
        {!list.length && (
          <div className="empty-inline">Sin mensajes todavía.</div>
        )}

        {list.map((message) => (
          <article
            className={message.sender_type === "rider" ? "mine" : ""}
            key={message.id}
          >
            <b>{message.sender_name || message.sender_type}</b>
            <p>{message.message}</p>
          </article>
        ))}
      </div>

      <div className="chat-compose">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Escribe al cliente..."
        />
        <button type="button" onClick={send}>
          Enviar
        </button>
      </div>
    </section>
  );
}

function DeliveryDetail({
  order,
  rider,
  loc,
  changed,
  msg,
  onBack,
}) {
  const next = NEXT[order.status];

  async function changeStatus(status) {
    try {
      const response = await axios.post(
        `${API}/rider/secure/orders/${order.order_code}/status/`,
        { status },
        { headers: authHeaders(rider) },
      );

      changed(response.data);
      msg("Estado actualizado.");
    } catch (error) {
      msg(error?.response?.data?.detail || "No se pudo actualizar.");
    }
  }

  return (
    <div className="screen animate-in">
      <div className="screen-title-row">
        <button type="button" className="back-button" onClick={onBack}>
          ‹
        </button>

        <div>
          <small>Entrega activa</small>
          <h1>{order.order_code}</h1>
        </div>

        <StatusBadge status={order.status} />
      </div>

      <section className="panel map-panel">
        <DeliveryMap order={order} loc={loc} />
      </section>

      <section className="panel customer-panel">
        <div className="customer-main">
          <span className="customer-avatar">
            {(order.customer_name || "C").slice(0, 1).toUpperCase()}
          </span>

          <div>
            <small>Cliente</small>
            <h2>{order.customer_name || "Cliente"}</h2>
            <p>{order.customer_phone || "Sin teléfono"}</p>
          </div>
        </div>

        <div className="customer-actions">
          <a href={`tel:${order.customer_phone}`}>☎</a>
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/34${digits(
              order.customer_phone,
            )}?text=${encodeURIComponent(
              `Hola, soy el repartidor de tu pedido ${order.order_code}`,
            )}`}
          >
            WA
          </a>
        </div>
      </section>

      <section className="panel address-panel">
        <div className="panel-heading compact">
          <div>
            <small>Destino</small>
            <h2>Dirección de entrega</h2>
          </div>
          <span className="pin-bubble">📍</span>
        </div>

        <p className="address-text">{order.address}</p>
        {order.note && <div className="note-box">{order.note}</div>}

        <a
          className="wide-action"
          target="_blank"
          rel="noreferrer"
          href={route(order.address)}
        >
          Abrir navegación
        </a>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <div>
            <small>Resumen</small>
            <h2>Productos</h2>
          </div>
          <b>{money(order.total)}</b>
        </div>

        <div className="items-list">
          {(order.items || []).map((item) => (
            <div className="item-row" key={item.id}>
              <span>
                {item.quantity}× {item.name_snapshot}
              </span>
              <b>{money(item.total)}</b>
            </div>
          ))}
        </div>

        <div className="payment-row">
          <span>Pago</span>
          <b>
            {order.payment_method} · {order.payment_status}
          </b>
        </div>
      </section>

      <section className="sticky-actions">
        {order.status === "out_for_delivery" && (
          <button
            type="button"
            className="primary-action"
            onClick={() => changeStatus("delivered")}
          >
            Confirmar entrega al cliente
          </button>
        )}

        <button
          type="button"
          className="danger-action"
          onClick={() => changeStatus("cancelled")}
        >
          Registrar incidencia
        </button>

        <div className="auto-flow-note">
          <span className="auto-flow-icon">⚡</span>
          <div>
            <b>Flujo automático activo</b>
            <small>
              Aceptación y salida a reparto se actualizan automáticamente.
              Solo la entrega final requiere tu confirmación.
            </small>
          </div>
        </div>
      </section>

      <Chat order={order} rider={rider} msg={msg} />
    </div>
  );
}

function HomeScreen({
  rider,
  orders,
  selected,
  gps,
  cash,
  startGps,
  stopGps,
  setTab,
  openOrder,
  refresh,
}) {
  return (
    <div className="screen animate-in">
      <section className="hero-card">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />

        <div className="hero-content">
          <span className="shift-pill">
            <i className={gps ? "dot online" : "dot"} />
            {gps ? "TURNO ACTIVO" : "GPS DESCONECTADO"}
          </span>

          <h1>Hola, {rider.name || "repartidor"}</h1>
          <p>
            {gps
              ? "Tu ubicación se comparte en tiempo real."
              : "Activa el GPS para comenzar a recibir rutas."}
          </p>

          <button
            type="button"
            className={`gps-main-button ${gps ? "is-on" : ""}`}
            onClick={gps ? stopGps : startGps}
          >
            {gps ? "GPS ACTIVO" : "ACTIVAR GPS"}
          </button>
        </div>

        <div className={`hero-scooter-scene ${gps ? "is-moving" : ""}`}>
  <div className="gps-wave gps-wave-one" />
  <div className="gps-wave gps-wave-two" />
  <div className="gps-wave gps-wave-three" />

  <div className="motion-trails" aria-hidden="true">
    <i />
    <i />
    <i />
  </div>

  <div className="road-dust" aria-hidden="true">
    <span />
    <span />
    <span />
  </div>

  <div className="hero-scooter" aria-label="Moto de reparto">
    🛵
  </div>
</div>
      </section>

      <section className="metrics-grid">
        <article>
          <span>📦</span>
          <div>
            <small>Activos</small>
            <b>{orders.length}</b>
          </div>
        </article>

        <article>
          <span>💶</span>
          <div>
            <small>Efectivo</small>
            <b>{money(cash)}</b>
          </div>
        </article>

        <article>
          <span>📍</span>
          <div>
            <small>Estado</small>
            <b>{gps ? "Online" : "Offline"}</b>
          </div>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <small>Ahora</small>
            <h2>Entrega prioritaria</h2>
          </div>

          <button type="button" className="icon-button" onClick={refresh}>
            ↻
          </button>
        </div>

        {selected ? (
          <div className="priority-card">
            <div className="priority-top">
              <div>
                <small>Pedido</small>
                <h3>{selected.order_code}</h3>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div className="priority-customer">
              <span>
                {(selected.customer_name || "C")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <div>
                <b>{selected.customer_name || "Cliente"}</b>
                <p>{selected.address}</p>
              </div>
            </div>

            <div className="priority-actions">
              <button type="button" onClick={() => openOrder(selected)}>
                Ver entrega
              </button>

              <a
                target="_blank"
                rel="noreferrer"
                href={route(selected.address)}
              >
                Navegar
              </a>
            </div>
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <div className="empty-icon">🛵</div>
            <h3>Sin entregas activas</h3>
            <p>Las nuevas asignaciones aparecerán aquí.</p>
          </div>
        )}
      </section>

      <section className="quick-grid">
        <button type="button" onClick={() => setTab("deliveries")}>
          <span>📋</span>
          <b>Mis entregas</b>
          <small>Ver pedidos activos</small>
        </button>

        <button type="button" onClick={() => setTab("history")}>
          <span>🕘</span>
          <b>Historial</b>
          <small>Entregas terminadas</small>
        </button>
      </section>
    </div>
  );
}

function DeliveriesScreen({
  orders,
  loading,
  selected,
  openOrder,
  refresh,
}) {
  return (
    <div className="screen animate-in">
      <div className="screen-heading">
        <div>
          <small>Trabajo actual</small>
          <h1>Mis entregas</h1>
        </div>

        <button type="button" className="icon-button" onClick={refresh}>
          ↻
        </button>
      </div>

      <div className="delivery-list">
        {loading && (
          <>
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </>
        )}

        {!loading && !orders.length && (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No hay entregas activas</h3>
            <p>Cuando el administrador asigne un pedido, aparecerá aquí.</p>
          </div>
        )}

        {orders.map((order) => (
          <OrderCard
            key={order.order_code}
            order={order}
            active={selected?.order_code === order.order_code}
            onClick={() => openOrder(order)}
          />
        ))}
      </div>
    </div>
  );
}

function HistoryScreen({ history }) {
  const total = history
    .filter((order) => order.status === "delivered")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  return (
    <div className="screen animate-in">
      <div className="screen-heading">
        <div>
          <small>Actividad guardada</small>
          <h1>Historial</h1>
        </div>
        <span className="history-count">{history.length}</span>
      </div>

      <section className="history-summary">
        <div>
          <small>Entregas registradas</small>
          <b>{history.length}</b>
        </div>

        <div>
          <small>Importe acumulado</small>
          <b>{money(total)}</b>
        </div>
      </section>

      {!history.length ? (
        <div className="empty-state">
          <div className="empty-icon">🕘</div>
          <h3>Historial vacío</h3>
          <p>
            Las entregas completadas o canceladas se guardarán en este
            dispositivo.
          </p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((order) => (
            <article
              className="history-card"
              key={`${order.order_code}-${order.saved_at}`}
            >
              <div className="history-card-top">
                <div>
                  <small>{order.saved_at_label}</small>
                  <h3>{order.order_code}</h3>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <p>{order.customer_name || "Cliente"}</p>
              <span>{order.address}</span>

              <div className="history-card-bottom">
                <b>{money(order.total)}</b>
                <small>
                  {(order.items || []).reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0,
                  )}{" "}
                  productos
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountScreen({
  rider,
  gps,
  startGps,
  stopGps,
  logout,
  history,
}) {
  const delivered = history.filter(
    (order) => order.status === "delivered",
  ).length;

  return (
    <div className="screen animate-in">
      <section className="profile-card">
        <div className="profile-avatar">
          {(rider.name || "R").slice(0, 1).toUpperCase()}
          <i className={gps ? "profile-status online" : "profile-status"} />
        </div>

        <h1>{rider.name || "Repartidor"}</h1>
        <p>{rider.phone || "Sin teléfono"}</p>

        <span className={`account-state ${gps ? "online" : ""}`}>
          {gps ? "Disponible" : "No disponible"}
        </span>
      </section>

      <section className="profile-stats">
        <article>
          <small>Entregadas</small>
          <b>{delivered}</b>
        </article>
        <article>
          <small>Historial</small>
          <b>{history.length}</b>
        </article>
      </section>

      <section className="panel settings-list">
        <button type="button" onClick={gps ? stopGps : startGps}>
          <span>{gps ? "📍" : "🛰️"}</span>
          <div>
            <b>{gps ? "Desactivar GPS" : "Activar GPS"}</b>
            <small>
              {gps
                ? "Dejar de compartir ubicación"
                : "Compartir ubicación en tiempo real"}
            </small>
          </div>
          <i>›</i>
        </button>

        <a href="tel:+34613473564">
          <span>☎️</span>
          <div>
            <b>Llamar al restaurante</b>
            <small>Casa de Kebab Turco</small>
          </div>
          <i>›</i>
        </a>
      </section>

      <button type="button" className="logout-button" onClick={logout}>
        Cerrar sesión
      </button>

      <p className="app-version">Casa Kebab Rider Pro · v1</p>
    </div>
  );
}

function FloatingLiveRoute({ order, loc, hidden, onOpen }) {
  if (!order || hidden) return null;

  return (
    <aside className="floating-live-route">
      <button
        type="button"
        className="floating-live-map"
        onClick={onOpen}
        aria-label="Abrir mapa en vivo"
      >
        <DeliveryMap order={order} loc={loc} compact />
        <span className="live-map-label">
          <i />
          MAPA EN VIVO
        </span>
      </button>

      <button
        type="button"
        className="floating-live-info"
        onClick={onOpen}
      >
        <span>
          <small>{order.order_code}</small>
          <b>{order.customer_name || "Cliente"}</b>
        </span>
        <strong>Ver ruta ›</strong>
      </button>
    </aside>
  );
}
function BottomNavigation({ tab, setTab, badge }) {
  const items = [
    ["home", "⌂", "Inicio"],
    ["deliveries", "▣", "Entregas"],
    ["history", "◷", "Historial"],
    ["account", "●", "Cuenta"],
  ];

  return (
    <nav className="bottom-navigation">
      {items.map(([value, icon, label]) => (
        <button
          type="button"
          key={value}
          className={tab === value ? "active" : ""}
          onClick={() => setTab(value)}
        >
          <span className="nav-icon">{icon}</span>
          <small>{label}</small>
          {value === "deliveries" && badge > 0 && (
            <i className="nav-badge">{badge}</i>
          )}
        </button>
      ))}
    </nav>
  );
}

function RiderHeader({ rider, gps, refresh }) {
  return (
    <header className="rider-header">
      <div className="header-brand">
        <img src={logo} alt="Casa de Kebab Turco" />
        <div>
          <small>Casa Kebab</small>
          <b>Rider Pro</b>
        </div>
      </div>

      <button type="button" className="header-refresh" onClick={refresh}>
        ↻
      </button>

      <div className={`header-status ${gps ? "online" : ""}`}>
        <i />
        {gps ? "Online" : "Offline"}
      </div>
    </header>
  );
}


async function setupRiderPushNotifications(rider, onOrderOpen, onMessage) {
  if (!rider?.token) return () => {};

  const listeners = [];

  try {
    const currentPermission = await PushNotifications.checkPermissions();
    let receivePermission = currentPermission.receive;

    if (receivePermission !== "granted") {
      const requested = await PushNotifications.requestPermissions();
      receivePermission = requested.receive;
    }

    if (receivePermission !== "granted") {
      onMessage("Permiso de notificaciones desactivado.");
      return () => {};
    }

    await PushNotifications.createChannel({
      id: RIDER_PUSH_CHANNEL_ID,
      name: "Pedidos nuevos",
      description: "Avisos urgentes de nuevos pedidos asignados",
      importance: 5,
      visibility: 1,
      sound: "rider_order_alert.wav",
      vibration: true,
      lights: true,
      lightColor: "#8F1D18",
    });

    listeners.push(
      await PushNotifications.addListener("registration", async (token) => {
        try {
          await axios.post(
            `${API}/rider/secure/push/register/`,
            {
              device_token: token.value,
              platform: "android",
              app_version: "1.1.0",
            },
            {
              headers: authHeaders(rider),
              timeout: 45000,
            },
          );
        } catch (error) {
          console.error("RIDER_PUSH_REGISTER_FAILED", error);
          onMessage("No se pudo registrar el dispositivo para avisos push.");
        }
      }),
    );

    listeners.push(
      await PushNotifications.addListener("registrationError", (error) => {
        console.error("RIDER_PUSH_REGISTRATION_ERROR", error);
        onMessage("Firebase no pudo registrar las notificaciones.");
      }),
    );

    listeners.push(
      await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          const orderCode =
            notification?.data?.order_code ||
            notification?.data?.orderCode ||
            "";

          if (orderCode) {
            localStorage.setItem(PENDING_PUSH_ORDER_KEY, orderCode);
          }

          onMessage(
            notification?.title
              ? `${notification.title}: ${notification.body || ""}`
              : "Nuevo pedido asignado.",
          );
        },
      ),
    );

    listeners.push(
      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (event) => {
          const orderCode =
            event?.notification?.data?.order_code ||
            event?.notification?.data?.orderCode ||
            "";

          if (!orderCode) return;

          localStorage.setItem(PENDING_PUSH_ORDER_KEY, orderCode);
          onOrderOpen(orderCode);
        },
      ),
    );

    await PushNotifications.register();
  } catch (error) {
    console.error("RIDER_PUSH_SETUP_FAILED", error);
    onMessage("No se pudieron activar las notificaciones push.");
  }

  return async () => {
    for (const listener of listeners) {
      await listener?.remove();
    }
  };
}

function Dashboard({ rider, logout, msg }) {
  const [orders, setOrders] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [gps, setGps] = useState(false);
  const [tab, setTab] = useState("home");
  const [detailOpen, setDetailOpen] = useState(false);
  const [history, setHistory] = useState(readHistory);
  const autoProgressRef = useRef(new Set());
  const autoProgressBusyRef = useRef(false);
  const [alertOrder, setAlertOrder] = useState(null);
  const [pushReady, setPushReady] = useState(false);
  const alertStopRef = useRef(null);
  const alertTimerRef = useRef(null);

  const [loc, setLoc] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LOC) || "null");
    } catch {
      return null;
    }
  });

  const watch = useRef(null);
  const last = useRef(0);

  const selected =
    orders.find((order) => order.order_code === selectedCode) ||
    orders[0] ||
    null;

  const cash = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.payment_method === "cash" &&
            order.payment_status !== "paid",
        )
        .reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders],
  );

  function saveHistory(order) {
    const now = new Date();
    const record = {
      ...order,
      saved_at: now.toISOString(),
      saved_at_label: now.toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setHistory((current) => {
      const filtered = current.filter(
        (item) => item.order_code !== order.order_code,
      );

      const next = [record, ...filtered].slice(0, 100);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }


  async function openOrderByCode(orderCode) {
    if (!orderCode) return;

    let target = orders.find((order) => order.order_code === orderCode);

    if (!target) {
      try {
        const response = await axios.get(`${API}/rider/secure/orders/`, {
          headers: authHeaders(rider),
          timeout: 70000,
        });

        const list = response.data.orders || [];
        setOrders(list);
        target = list.find((order) => order.order_code === orderCode);
      } catch (error) {
        console.error("OPEN_PUSH_ORDER_FAILED", error);
      }
    }

    if (target) {
      setSelectedCode(target.order_code);
      setDetailOpen(true);
      setTab("deliveries");
      localStorage.removeItem(PENDING_PUSH_ORDER_KEY);
    }
  }


  useEffect(() => {
    let cleanup = () => {};

    setupRiderPushNotifications(
      rider,
      openOrderByCode,
      msg,
    ).then((removeListeners) => {
      cleanup = removeListeners;
      setPushReady(true);

      const pendingOrderCode =
        localStorage.getItem(PENDING_PUSH_ORDER_KEY);

      if (pendingOrderCode) {
        window.setTimeout(() => {
          openOrderByCode(pendingOrderCode);
        }, 600);
      }
    });

    return () => {
      cleanup();
    };
  }, [rider?.token]);

  async function autoProgressOrders(list) {
    if (autoProgressBusyRef.current) return;

    const candidates = list.filter(
      (order) =>
        AUTO_PROGRESS_TARGET[order.status] &&
        !autoProgressRef.current.has(
          `${order.order_code}:${order.status}`,
        ),
    );

    if (!candidates.length) return;

    autoProgressBusyRef.current = true;

    try {
      for (const order of candidates) {
        const key = `${order.order_code}:${order.status}`;
        autoProgressRef.current.add(key);

        await sleep(AUTO_PROGRESS_DELAY_MS[order.status] || 700);

        try {
          const response = await axios.post(
            `${API}/rider/secure/orders/${order.order_code}/status/`,
            { status: AUTO_PROGRESS_TARGET[order.status] },
            {
              headers: authHeaders(rider),
              timeout: 45000,
            },
          );

          const updated = response.data;

          setOrders((current) =>
            current.map((item) =>
              item.order_code === updated.order_code ? updated : item,
            ),
          );

          if (AUTO_PROGRESS_TARGET[updated.status]) {
            const nextKey = `${updated.order_code}:${updated.status}`;

            if (!autoProgressRef.current.has(nextKey)) {
              await sleep(
                AUTO_PROGRESS_DELAY_MS[updated.status] || 900,
              );

              autoProgressRef.current.add(nextKey);

              try {
                const nextResponse = await axios.post(
                  `${API}/rider/secure/orders/${updated.order_code}/status/`,
                  { status: AUTO_PROGRESS_TARGET[updated.status] },
                  {
                    headers: authHeaders(rider),
                    timeout: 45000,
                  },
                );

                const nextUpdated = nextResponse.data;

                setOrders((current) =>
                  current.map((item) =>
                    item.order_code === nextUpdated.order_code
                      ? nextUpdated
                      : item,
                  ),
                );
              } catch {
                // Future polling retries if necessary.
              }
            }
          }
        } catch {
          autoProgressRef.current.delete(key);
        }
      }
    } finally {
      autoProgressBusyRef.current = false;
    }
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);

    try {
      const response = await axios.get(`${API}/rider/secure/orders/`, {
        headers: authHeaders(rider),
        timeout: 70000,
      });

      const list = response.data.orders || [];
      setOrders(list);
      autoProgressOrders(list);

      const seenCodes = readSeenOrderCodes();
      const unseenOrders = list.filter(
        (order) => !seenCodes.includes(order.order_code),
      );

      if (unseenOrders.length) {
        const newest = unseenOrders[0];

        setAlertOrder(newest);

        if (alertStopRef.current) {
          alertStopRef.current();
        }

        alertStopRef.current = playRiderAlert(5000);

        if ("vibrate" in navigator) {
          navigator.vibrate([
            350, 180, 350, 180, 350, 180, 350, 180, 350,
          ]);
        }

        saveSeenOrderCodes([
          ...seenCodes,
          ...unseenOrders.map((order) => order.order_code),
        ]);

        if (alertTimerRef.current) {
          window.clearTimeout(alertTimerRef.current);
        }

        alertTimerRef.current = window.setTimeout(() => {
          setAlertOrder(null);
        }, 5000);
      }

      if (!selectedCode && list[0]) {
        setSelectedCode(list[0].order_code);
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem(KEY);
        localStorage.removeItem(LOC);
        msg(
          "Tu cuenta está inactiva, tus datos cambiaron o la sesión caducó.",
        );
        window.setTimeout(() => window.location.reload(), 900);
        return;
      }

      if (!silent) {
        msg(
          error?.response?.data?.detail ||
            "No se pudieron cargar pedidos.",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 7000);
    return () => window.clearInterval(timer);
  }, [rider.phone]);

  async function sendLocation(point) {
    if (Date.now() - last.current < 4000) return;
    last.current = Date.now();

    try {
      await axios.post(
        `${API}/rider/secure/location/`,
        {
          latitude: Number(point.lat.toFixed(7)),
          longitude: Number(point.lng.toFixed(7)),
        },
        { headers: authHeaders(rider) },
      );
    } catch {
      // Location upload should not freeze the UI.
    }
  }

  async function startGps() {
    try {
      await Geolocation.requestPermissions();

      watch.current = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000,
        },
        (position, error) => {
          if (error || !position?.coords) return;

          const point = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          if (!valid(point.lat, point.lng)) return;

          setLoc(point);
          localStorage.setItem(LOC, JSON.stringify(point));
          sendLocation(point);
        },
      );

      setGps(true);
      msg("GPS activo.");
    } catch {
      msg("No se pudo activar GPS.");
    }
  }

  async function stopGps() {
    if (watch.current !== null) {
      try {
        await Geolocation.clearWatch({ id: watch.current });
      } catch {
        // Ignore clear watch error.
      }
    }

    watch.current = null;
    setGps(false);
  }

  function changed(updated) {
    if (
      updated.status === "delivered" ||
      updated.status === "cancelled"
    ) {
      saveHistory(updated);

      setOrders((current) =>
        current.filter(
          (order) => order.order_code !== updated.order_code,
        ),
      );

      setSelectedCode("");
      setDetailOpen(false);
      setTab("history");
      return;
    }

    setOrders((current) =>
      current.map((order) =>
        order.order_code === updated.order_code ? updated : order,
      ),
    );
  }

  function openOrder(order) {
    setSelectedCode(order.order_code);
    setDetailOpen(true);
  }

  function switchTab(nextTab) {
    setDetailOpen(false);
    setTab(nextTab);
  }

  function closeNewOrderAlert() {
    setAlertOrder(null);

    if (alertStopRef.current) {
      alertStopRef.current();
      alertStopRef.current = null;
    }

    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }

    if (alertTimerRef.current) {
      window.clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
  }

  function openAlertOrder() {
    if (!alertOrder) return;
    const order = alertOrder;
    closeNewOrderAlert();
    openOrder(order);
  }

  useEffect(() => {
    return () => {
      if (alertStopRef.current) {
        alertStopRef.current();
      }

      if (alertTimerRef.current) {
        window.clearTimeout(alertTimerRef.current);
      }

      if ("vibrate" in navigator) {
        navigator.vibrate(0);
      }
    };
  }, []);

  return (
    <div className="rider-shell">
      <NewOrderAlert
        order={alertOrder}
        onOpen={openAlertOrder}
        onClose={closeNewOrderAlert}
      />
      <RiderHeader rider={rider} gps={gps} refresh={() => load()} />

      <main className="rider-main">
        {detailOpen && selected ? (
          <DeliveryDetail
            order={selected}
            rider={rider}
            loc={loc}
            changed={changed}
            msg={msg}
            onBack={() => setDetailOpen(false)}
          />
        ) : (
          <>
            {tab === "home" && (
              <HomeScreen
                rider={rider}
                orders={orders}
                selected={selected}
                gps={gps}
                cash={cash}
                startGps={startGps}
                stopGps={stopGps}
                setTab={switchTab}
                openOrder={openOrder}
                refresh={() => load()}
              />
            )}

            {tab === "deliveries" && (
              <DeliveriesScreen
                orders={orders}
                loading={loading}
                selected={selected}
                openOrder={openOrder}
                refresh={() => load()}
              />
            )}

            {tab === "history" && (
              <HistoryScreen history={history} />
            )}

            {tab === "account" && (
              <AccountScreen
                rider={rider}
                gps={gps}
                startGps={startGps}
                stopGps={stopGps}
                logout={logout}
                history={history}
              />
            )}
          </>
        )}
      </main>

      <FloatingLiveRoute
        order={selected}
        loc={loc}
        hidden={detailOpen}
        onOpen={() => selected && openOrder(selected)}
      />

      {!detailOpen && (
        <BottomNavigation
          tab={tab}
          setTab={switchTab}
          badge={orders.length}
        />
      )}
    </div>
  );
}

function App() {
  const [rider, setRider] = useState(session());
  const [message, setMessage] = useState("");

  const logout = () => {
    localStorage.removeItem(KEY);
    setRider(null);
  };

  return (
    <>
      {rider ? (
        <Dashboard rider={rider} logout={logout} msg={setMessage} />
      ) : (
        <Login done={setRider} msg={setMessage} />
      )}

      <Toast
        message={message}
        close={() => setMessage("")}
      />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);



