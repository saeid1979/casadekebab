import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import L from "leaflet";
import { Geolocation } from "@capacitor/geolocation";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import logo from "./assets/logo.png";

const PROD = "https://casadekebab-backend.onrender.com/api/restaurant";
const ENV = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const API = !ENV || /localhost|127\.0\.0\.1/i.test(ENV) ? PROD : ENV;

const KEY = "cdkt_rider_session";
const LOC = "cdkt_rider_last_location";
const HISTORY_KEY = "cdkt_rider_history_v1";
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

function DeliveryMap({ order, loc }) {
  const ref = useRef(null);
  const map = useRef(null);
  const layers = useRef([]);

  const customerLat = num(order?.delivery_latitude);
  const customerLng = num(order?.delivery_longitude);
  const riderLat = num(loc?.lat);
  const riderLng = num(loc?.lng);

  const hasCustomer = valid(customerLat, customerLng);
  const hasRider = valid(riderLat, riderLng);

  useEffect(() => {
    if (!ref.current || map.current) return;

    map.current = L.map(ref.current, {
      zoomControl: true,
    }).setView([REST.lat, REST.lng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map.current);
  }, []);

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;

    layers.current.forEach((layer) => currentMap.removeLayer(layer));
    layers.current = [];

    const add = (layer) => {
      layers.current.push(layer);
      return layer;
    };

    const bounds = [[REST.lat, REST.lng]];

    add(
      L.circleMarker([REST.lat, REST.lng], {
        radius: 10,
        color: "#ffffff",
        fillColor: "#8f1d18",
        fillOpacity: 1,
        weight: 4,
      })
        .addTo(currentMap)
        .bindPopup("Casa de Kebab Turco"),
    );

    if (hasCustomer) {
      add(
        L.circleMarker([customerLat, customerLng], {
          radius: 10,
          color: "#ffffff",
          fillColor: "#ef4444",
          fillOpacity: 1,
          weight: 4,
        })
          .addTo(currentMap)
          .bindPopup("Cliente"),
      );

      bounds.push([customerLat, customerLng]);
    }

    if (hasRider) {
      add(
        L.circleMarker([riderLat, riderLng], {
          radius: 11,
          color: "#ffffff",
          fillColor: "#16a34a",
          fillOpacity: 1,
          weight: 5,
        })
          .addTo(currentMap)
          .bindPopup("Tu ubicación"),
      );

      bounds.push([riderLat, riderLng]);
    }

    async function drawRoute() {
      if (hasRider && hasCustomer) {
        let line = [
          [riderLat, riderLng],
          [customerLat, customerLng],
        ];

        try {
          const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${riderLng},${riderLat};${customerLng},${customerLat}` +
            "?overview=full&geometries=geojson";

          const data = await fetch(url).then((response) => response.json());
          const coords = data?.routes?.[0]?.geometry?.coordinates;

          if (coords?.length) {
            line = coords.map(([lng, lat]) => [lat, lng]);
          }
        } catch {
          // Straight line fallback.
        }

        add(
          L.polyline(line, {
            color: "#ffffff",
            weight: 12,
            opacity: 0.95,
          }).addTo(currentMap),
        );

        add(
          L.polyline(line, {
            color: "#8f1d18",
            weight: 7,
            opacity: 0.95,
          }).addTo(currentMap),
        );
      }

      if (bounds.length > 1) {
        currentMap.fitBounds(bounds, {
          padding: [34, 34],
          maxZoom: 16,
        });
      }
    }

    drawRoute();
  }, [
    order?.order_code,
    customerLat,
    customerLng,
    riderLat,
    riderLng,
    hasCustomer,
    hasRider,
  ]);

  return <div ref={ref} className="delivery-map" />;
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
        {next && (
          <button
            type="button"
            className="primary-action"
            onClick={() => changeStatus(next)}
          >
            {next === "delivered"
              ? "Marcar como entregado"
              : `Cambiar a ${(META[next] || [next])[0]}`}
          </button>
        )}

        <button
          type="button"
          className="danger-action"
          onClick={() => changeStatus("cancelled")}
        >
          Registrar incidencia
        </button>
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

        <div className="hero-scooter">🛵</div>
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

function Dashboard({ rider, logout, msg }) {
  const [orders, setOrders] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [gps, setGps] = useState(false);
  const [tab, setTab] = useState("home");
  const [detailOpen, setDetailOpen] = useState(false);
  const [history, setHistory] = useState(readHistory);

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

  async function load(silent = false) {
    if (!silent) setLoading(true);

    try {
      const response = await axios.get(`${API}/rider/secure/orders/`, {
        headers: authHeaders(rider),
        timeout: 70000,
      });

      const list = response.data.orders || [];
      setOrders(list);

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

  return (
    <div className="rider-shell">
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
