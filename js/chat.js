// Importar las funciones necesarias de Firebase
import { database } from "./firebase-config.js";
import {
  ref,
  get,
  set,
  push,
  update,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Variables globales para desuscripción de listeners
let messagesUnsubscribe = null;
let chatChangesUnsubscribe = null;

// Variables globales para el mapa en el modal
let map = null;
let routeLine = null;
let simulationMarker = null;

// Variables para la simulación
let simulationInterval = null;
let currentSimulationIndex = 0;
let routeCoordinates = [];

// Flags para controlar la simulación y mapa
let routeMessageSent = false;
let simulationRunning = false;
let mapInitialized = false;
let alertShown = false; // Nuevo flag para controlar alertas duplicadas

// Variable para almacenar la referencia del chat
let chatRefGlobal = null;

// Variable para almacenar el tipo de usuario
let userTypeGlobal = null;

// Variable para almacenar el chatId
let chatIdGlobal = null;

// Definir íconos personalizados para mejor visualización
const talacheroIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", // URL de un ícono representativo
  iconSize: [38, 38], // Tamaño del ícono
  iconAnchor: [19, 38], // Punto del ícono que corresponde a la ubicación
  popupAnchor: [0, -38], // Punto desde donde se abre el popup relativo al iconAnchor
});

const userIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/194/194938.png", // URL de un ícono representativo
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

// Definir activeSession como variable global
let activeSession = null;

// Función para cargar la página
function loadPage(page) {
  window.location.href = page;
}

// Exportar la función para inicializar la página de chat
export function initChatPage() {
  console.log("initChatPage called");

  // Asignar activeSession a la variable global
  activeSession = JSON.parse(localStorage.getItem("activeSession"));
  // Asegurarse de que activeSession está definido antes de acceder a sus propiedades
  userTypeGlobal =
    activeSession && activeSession.userType ? activeSession.userType : null;
  chatIdGlobal = localStorage.getItem("activeChat");
  const chatContainer = $("#chat-messages");

  console.log("activeSession:", activeSession);
  console.log("userTypeGlobal:", userTypeGlobal);
  console.log("chatIdGlobal:", chatIdGlobal);

  if (!activeSession) {
    alert("No se pudo cargar el chat. Por favor, inicia sesión nuevamente.");
    loadPage("login.html");
    return;
  }

  chatRefGlobal = chatIdGlobal ? ref(database, `chats/${chatIdGlobal}`) : null;

  // Limpiar listeners previos
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  if (chatChangesUnsubscribe) {
    chatChangesUnsubscribe();
    chatChangesUnsubscribe = null;
  }

  // Validar el estado actual del chat
  validateChatState();
}

/**
 * Valida el estado actual del chat y renderiza la interfaz correspondiente.
 */
async function validateChatState() {
  try {
    if (!chatIdGlobal) {
      const userChatRef = ref(database, `users/${activeSession.uid}/inChat`);
      const userSnapshot = await get(userChatRef);
      chatIdGlobal = userSnapshot.val();

      if (!chatIdGlobal) {
        // No hay chat activo: mostrar inputs iniciales para crear uno nuevo (solo para usuarios)
        if (userTypeGlobal === "usuario") {
          renderInitialInputs();
        } else {
          alert("No tienes chats activos.");
          loadPage("index.html");
        }
        return;
      }

      chatRefGlobal = ref(database, `chats/${chatIdGlobal}`);
    }

    const chatSnapshot = await get(chatRefGlobal);
    if (!chatSnapshot.exists()) {
      alert("El chat no existe o fue eliminado.");
      await clearChatState();
      loadPage("index.html");
      return;
    }

    const chatData = chatSnapshot.val();

    // Si el chat está cerrado, limpiar el estado y redirigir
    if (
      chatData.status === "cancelled" ||
      chatData.status === "completed" ||
      chatData.status === "cancelled_by_user" ||
      chatData.status === "cancelled_by_talachero"
    ) {
      await clearChatState();
      alert("El chat ha sido cerrado.");
      loadPage("index.html");
      return;
    }

    // Mostrar alerta una sola vez cuando el servicio empieza
    if (
      chatData.status === "journey_started" &&
      !alertShown &&
      userTypeGlobal === "usuario"
    ) {
      alert("El talachero ha iniciado el servicio.");
      alertShown = true;
    }

    // Renderizar la interfaz según el estado del chat
    renderChat(chatData.status);
    listenForChanges();
    listenForMessages();
  } catch (error) {
    console.error("Error al validar el estado del chat:", error);
    alert("Ocurrió un error al cargar el chat. Intenta nuevamente.");
    loadPage("index.html");
  }
}

/**
 * Limpia el estado local del chat.
 */
async function clearChatState() {
  try {
    await set(ref(database, `users/${activeSession.uid}/inChat`), null);
    localStorage.removeItem("activeChat");

    // Limpiar el chatUid si el usuario es "usuario"
    if (userTypeGlobal === "usuario") {
      await set(ref(database, `users/${activeSession.uid}/chatUid`), null);
    }
  } catch (error) {
    console.error("Error al limpiar el estado del chat:", error);
  }
}

/**
 * Escucha cambios en el chat y actualiza la interfaz en tiempo real.
 */
function listenForChanges() {
  if (!chatRefGlobal) return;

  if (chatChangesUnsubscribe) {
    chatChangesUnsubscribe();
  }

  chatChangesUnsubscribe = onValue(chatRefGlobal, (snapshot) => {
    if (snapshot.exists()) {
      const chatData = snapshot.val();
      console.log("Chat data changed:", chatData);
      renderChat(chatData.status);
    }
  });
}

/**
 * Escucha mensajes nuevos y los renderiza en el chat.
 */
function listenForMessages() {
  const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);

  if (messagesUnsubscribe) {
    messagesUnsubscribe();
  }

  messagesUnsubscribe = onValue(messagesRef, (snapshot) => {
    if (snapshot.exists()) {
      const messages = Object.entries(snapshot.val()).map(([id, data]) => ({
        id,
        ...data,
      }));
      console.log("Messages received:", messages);
      renderMessages(messages);
    } else {
      $("#chat-messages").html(
        "<p class='text-muted'>No hay mensajes aún.</p>"
      );
    }
  });
}

/**
 * Renderiza los mensajes en la interfaz.
 * @param {Array} messages - Lista de mensajes.
 */
function renderMessages(messages) {
  const chatContainer = $("#chat-messages");
  chatContainer.empty();

  messages.forEach((message) => {
    // Identificar si el mensaje es de tipo 'calculo'
    const isCalculoMessage = message.type === "calculo";
    console.log("HOLA?")
    debugger
    if (message.type === "route") {
      // Renderizar un botón para abrir el modal si es un mensaje de tipo ruta
      const isTalacheroMessage =
        message.sender !== activeSession.uid && message.sender !== "system";
      const messageHtml = `
        <div class="message ${
          isTalacheroMessage ? "talachero-message" : "system-message"
        }">
            <p>${message.description}</p>
            <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#routeModal">Ver Ruta en Tiempo Real</button>
            <small>${new Date(
              message.timestamp
            ).toLocaleString()}</small>
        </div>
      `;
      chatContainer.append(messageHtml);
      return; // Saltar el renderizado de texto para mensajes de tipo "route"
    }

    // Si el mensaje es de tipo "map", omitirlo ya que ahora se usa el modal
    if (message.type === "map") {
      return;
    }

    // Manejar mensajes de tipo "rating"
    if (message.type === "rating") {
      const isUserMessage = message.sender === activeSession.uid;
      const isSystemMessage = message.sender === "system";

      let messageContent = "";

      if (isUserMessage) {
        messageContent = `<p>Has calificado este servicio con: <strong>${message.rating}/5</strong></p>`;
      } else {
        messageContent = `<p>El usuario ha calificado este servicio con: <strong>${message.rating}/5</strong></p>`;
      }

      const messageHtml = `
        <div class="message ${
          isUserMessage
            ? "user-message"
            : isSystemMessage
            ? "system-message"
            : "talachero-message"
        }">
            ${messageContent}
            <small>${new Date(message.timestamp).toLocaleString()}</small>
        </div>
      `;
      chatContainer.append(messageHtml);
      return; // Saltar el renderizado adicional para mensajes de tipo "rating"
    }

    const isUserMessage = message.sender === activeSession.uid;
    const isSystemMessage = message.sender === "system";

    let messageContent = "";

    if (isCalculoMessage) {
      // Definir la descripción específica que deseas verificar
      const targetDescription = "Servicio: test1 Precio Base: $100.00 Distancia: 2.24 km Precio por Distancia: $22.37 Subtotal: $122.37 Precio Final: $122.37 Nota: test";

      // Verificar si la descripción del mensaje coincide exactamente con la descripción objetivo
      if (message.description.trim() === targetDescription) {
        additionalClasses += " margin-bottom-100"; // Añadir la clase para el margen
      }

      if (userTypeGlobal === "talachero") {
        // Mostrar cálculo completo al talachero
        messageContent = `
          <p>${message.description}</p>
          <div id="calculo-map-${message.id}" class="mt-2" style="height: 200px;"></div>
        `;
      } else if (userTypeGlobal === "usuario") {
        // Mostrar solo el precio final al usuario
        const finalPriceMatch = message.description.match(/Precio Final: \$([\d.]+)/);
        const finalPrice = finalPriceMatch ? finalPriceMatch[1] : "N/A";
        messageContent = `
          <p>Precio Final: $${finalPrice}</p>
          <div id="calculo-map-${message.id}" class="mt-2" style="height: 200px;"></div>
        `;
      }
    } else {
      messageContent = isSystemMessage
        ? `<p><em>${message.description}</em></p>`
        : `<p>${message.description}</p>`;
    }

    let additionalClasses = "";
    if (isCalculoMessage) {
      additionalClasses += " calculo-message";
      // Añadir margin-bottom-100 si la descripción coincide
      const targetDescription = "Servicio: test1 Precio Base: $100.00 Distancia: 2.24 km Precio por Distancia: $22.37 Subtotal: $122.37 Precio Final: $122.37 Nota: test";
      if (message.description.trim() === targetDescription) {
        additionalClasses += " margin-bottom-100";
      }
    }

    const messageHtml = `
      <div class="${additionalClasses} message ${
        isSystemMessage
          ? "system-message"
          : isUserMessage
          ? "user-message"
          : "talachero-message"
      }">
          ${messageContent}
          ${
            message.photo
              ? `<img src="${message.photo}" alt="Imagen" style="max-width: 300px;">`
              : ""
          }
          <small>${new Date(message.timestamp).toLocaleString()}</small>
      </div>
    `;
    
    chatContainer.append(messageHtml);

    // Agregar mapas a los mensajes de cálculo
    if (isCalculoMessage) {
      const mapElementId = `calculo-map-${message.id}`;
      const userCoordinates = message.coordinates; // Obtener las coordenadas del usuario
      const talacheroCoordinates = message.talacheroCoordinates; // Ubicación del talachero

      if (userCoordinates) {
        // Renderizar mapa para la ubicación del usuario
        const userMapHtml = `
          <div id="user-map-${message.id}" class="mt-2" style="height: 200px;"></div>
        `;
        $(`#calculo-map-${message.id}`).append(userMapHtml);

        const userMapInstance = L.map(`user-map-${message.id}`, {
          scrollWheelZoom: false,
          dragging: false,
          zoomControl: false,
          attributionControl: false,
        }).setView([userCoordinates.latitude, userCoordinates.longitude], 15);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(userMapInstance);

        L.marker([userCoordinates.latitude, userCoordinates.longitude], {
          icon: userIcon,
        })
          .addTo(userMapInstance)
          .bindPopup("Ubicación del Usuario")
          .openPopup();
      }

      if (talacheroCoordinates) {
        // Renderizar mapa para la ubicación del talachero
        const talacheroMapHtml = `
          <div id="talachero-map-${message.id}" class="mt-2" style="height: 200px;"></div>
        `;
        $(`#calculo-map-${message.id}`).append(talacheroMapHtml);

        const talacheroMapInstance = L.map(`talachero-map-${message.id}`, {
          scrollWheelZoom: false,
          dragging: false,
          zoomControl: false,
          attributionControl: false,
        }).setView([talacheroCoordinates.latitude, talacheroCoordinates.longitude], 15);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(talacheroMapInstance);

        L.marker([talacheroCoordinates.latitude, talacheroCoordinates.longitude], {
          icon: talacheroIcon,
        })
          .addTo(talacheroMapInstance)
          .bindPopup("Ubicación del Talachero")
          .openPopup();
      }
    }

    // Incluir la ubicación en el mensaje si contiene coordenadas
    if (message.coordinates && !isCalculoMessage) {
      const mapElementId = `map-${message.id}`;
      const coordinates = message.coordinates;
      const senderType = isUserMessage ? "Tu Ubicación" : "Ubicación del Usuario";

      const mapHtml = `
        <div id="${mapElementId}" class="mt-2" style="height: 200px;"></div>
      `;
      $(`.message:last`).append(mapHtml);

      const mapInstance = L.map(mapElementId, {
        scrollWheelZoom: false,
        dragging: false,
        zoomControl: false,
        attributionControl: false,
      }).setView([coordinates.latitude, coordinates.longitude], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapInstance);

      L.marker([coordinates.latitude, coordinates.longitude], {
        icon: isUserMessage ? userIcon : talacheroIcon,
      })
        .addTo(mapInstance)
        .bindPopup(senderType)
        .openPopup();
    }
  });

  // Inicializar los mapas después de que todos los mensajes se hayan renderizado
  messages.forEach((message) => {
    if (message.type === "calculo") {
      const mapElementId = `calculo-map-${message.id}`;
      const userMapId = `user-map-${message.id}`;
      const talacheroMapId = `talachero-map-${message.id}`;

      if (message.coordinates) {
        const userCoordinates = message.coordinates;
        const talacheroCoordinates = message.talacheroCoordinates;

        if (userCoordinates) {
          createMap(
            userMapId,
            { latitude: userCoordinates.latitude, longitude: userCoordinates.longitude },
            "userCoordinates",
            `user-location-status-${message.id}`
          );
        }

        if (talacheroCoordinates) {
          createMap(
            talacheroMapId,
            { latitude: talacheroCoordinates.latitude, longitude: talacheroCoordinates.longitude },
            "talacheroCoordinates",
            `talachero-location-status-${message.id}`
          );
        }
      }
    }
  });
}


/**
 * Renderiza la interfaz según el estado del chat.
 * @param {string} status - Estado actual del chat.
 */
function renderChat(status) {
  $("#chat-inputs").empty();

  if (userTypeGlobal === "usuario") {
    renderUserChat(status);
  } else if (userTypeGlobal === "talachero") {
    renderTalacheroChat(status);
  }

  if (status === "journey_started" && !simulationRunning) {
    simulationRunning = true;
    startLocalSimulation();
  }
}

/**
 * Renderiza la interfaz del usuario según el estado del chat.
 * @param {string} status - Estado actual del chat.
 */
function renderUserChat(status) {
  if (status === "waiting") {
    $("#chat-inputs").html(`
      <p class="text-center text-muted">Esperando respuesta del talachero...</p>
      <button class="btn btn-danger mt-3" id="close-chat">Cerrar Chat</button>
    `);
    setupCloseChat("cancelled_by_user");
  } else if (status === "active") {
    $("#chat-inputs").html(`
      <p class="text-center text-muted">El talachero ha enviado una propuesta. Por favor, revísala.</p>
      <div class="mb-3">
        <label for="payment-method" class="form-label">Método de Pago:</label>
        <select id="payment-method" class="form-select">
          <option value="efectivo">Efectivo</option>
          <!-- Suponiendo que las tarjetas están almacenadas en activeSession.cards -->
          ${activeSession.cards && activeSession.cards.length > 0
            ? activeSession.cards
                .map(
                  (card) =>
                    `<option value="${card.id}">${card.brand} **** **** **** ${card.last4}</option>`
                )
                .join("")
            : `<option value="" disabled>No tienes tarjetas registradas</option>`}
        </select>
      </div>
      <button class="btn btn-success mt-3" id="accept-proposal">Aceptar</button>
      <button class="btn btn-danger mt-3" id="reject-proposal">Rechazar</button>
    `);
    setupProposalResponse();
  } else if (status === "rejected") {
    $("#chat-inputs").html(`
      <p class="text-center text-muted">El talachero rechazó tu solicitud.</p>
      <button class="btn btn-danger mt-3" id="close-rejected-chat">Cerrar Chat</button>
    `);
    setupCloseChat("cancelled_by_user");
  } else if (status === "confirmed") {
    $("#chat-inputs").html(`
      <p class="text-center text-muted">Esperando que el talachero inicie el trayecto...</p>
    `);
  } else if (status === "journey_started") {
    renderMessageInputs();
  } else if (status === "en_servicio") {
    $("#chat-inputs").html(`
      <p class="text-center text-success">El talachero ha llegado y está atendiendo tu solicitud.</p>
      <p class="text-center text-muted">Puedes enviar mensajes mientras el servicio está en curso.</p>
    `);
    renderMessageInputs(); // Opcional: Permitir enviar mensajes en este estado
  } else if (status === "completed") {
    $("#chat-inputs").html(`
      <p class="text-center text-success">El talachero ha completado el viaje.</p>
      <button class="btn btn-success mt-3" id="close-chat">Cerrar Chat</button>
    `);
    setupCloseChat("completed");
  }
}

/**
 * Renderiza la interfaz del talachero según el estado del chat.
 * @param {string} status - Estado actual del chat.
 */
function renderTalacheroChat(status) {
  if (status === "waiting") {
    renderTalacheroInitialInputs();
  } else if (status === "active") {
    $("#chat-inputs").html(`
      <p class="text-center text-muted">Esperando confirmación del usuario...</p>
    `);
  } else if (status === "confirmed") {
    $("#chat-inputs").html(`
      <button class="btn btn-primary mt-3" id="start-journey">Iniciar Trayecto</button>
      <button class="btn btn-danger mt-3" id="close-chat">Cancelar Chat</button>
    `);
    $("#start-journey").on("click", startJourney);
    $("#close-chat").on("click", () =>
      setupCloseChat("cancelled_by_talachero")
    );
  } else if (status === "journey_started") {
    $("#chat-inputs").html(`
      <p class="text-center text-muted">Trayecto en progreso...</p>
    `);
  } else if (status === "en_servicio") {
    $("#chat-inputs").html(`
      <p class="text-center text-success">Has llegado al lugar y estás atendiendo al usuario.</p>
      <button class="btn btn-success mt-3" id="complete-service">Terminar Servicio</button>
      <button class="btn btn-danger mt-3" id="close-chat">Cancelar Chat</button>
    `);
    $("#complete-service").on("click", completeService);
    $("#close-chat").on("click", () =>
      setupCloseChat("cancelled_by_talachero")
    );
  } else if (status === "rejected_by_user") {
    $("#chat-inputs").html(`
      <p class="text-center text-muted">El usuario rechazó tu propuesta.</p>
      <button class="btn btn-danger mt-3" id="close-chat">Cerrar Chat</button>
    `);
    setupCloseChat("cancelled_by_talachero");
  } else if (status === "completed") {
    $("#chat-inputs").html(`
      <p class="text-center text-success">El chat se ha completado.</p>
      <button class="btn btn-success mt-3" id="close-chat">Cerrar Chat</button>
    `);
    setupCloseChat("completed");
  }
}

/**
 * Renderiza los inputs iniciales para crear un nuevo chat (solo para usuarios).
 */
function renderInitialInputs() {
  $("#chat-inputs").html(`
    <div id="step-1" class="chat-step">
      <label for="service-selection">Selecciona un servicio:</label>
      <select id="service-selection" class="form-select"></select>
      <button class="btn btn-primary mt-3" id="next-step-1">Siguiente</button>
    </div>
    <div id="step-2" class="chat-step" style="display:none;">
      <label for="problem-description">Describe tu problema:</label>
      <textarea id="problem-description" class="form-control" rows="3"></textarea>
      <div class="mt-3 d-flex justify-content-between">
        <button class="btn btn-secondary" id="prev-step-2">Regresar</button>
        <button class="btn btn-primary" id="next-step-2">Siguiente</button>
      </div>
    </div>
    <div id="step-3" class="chat-step" style="display:none;">
      <p>Necesitamos acceder a tu ubicación para continuar.</p>
      <button class="btn btn-primary" id="get-user-location">Obtener Ubicación</button>
      <div id="user-map-container" style="display:none;">
        <p>Selecciona tu ubicación en el mapa:</p>
        <div id="user-map" style="height: 300px;"></div>
        <p id="user-location-status" class="mt-2 text-muted"></p>
      </div>
      <div class="mt-3 d-flex justify-content-between">
        <button class="btn btn-secondary" id="prev-step-3">Regresar</button>
        <button class="btn btn-primary" id="next-step-3" disabled>Siguiente</button>
      </div>
    </div>
    <div id="step-4" class="chat-step" style="display:none;">
      <label for="problem-photo">Sube una foto del problema (opcional):</label>
      <input type="file" id="problem-photo" class="form-control" accept="image/*">
      <img id="problem-photo-preview" src="" alt="Previsualización" style="display:none; max-width: 200px; margin-top:10px;">
      <div class="mt-3 d-flex justify-content-between">
        <button class="btn btn-secondary" id="prev-step-4">Regresar</button>
        <button class="btn btn-primary" id="send-initial-message">Enviar</button>
      </div>
    </div>
  `);

  setupInitialInputs();
  loadServices();
}

/**
 * Configura los eventos de los inputs iniciales (usuario).
 */
function setupInitialInputs() {
  $("#next-step-1").on("click", () => {
    const selectedService = $("#service-selection").val();
    if (!selectedService) {
      alert("Por favor, selecciona un servicio.");
      return;
    }
    $("#step-1").hide();
    $("#step-2").fadeIn();
  });

  $("#next-step-2").on("click", () => {
    const description = $("#problem-description").val().trim();
    if (!description) {
      alert("Por favor, describe tu problema.");
      return;
    }
    $("#step-2").hide();
    $("#step-3").fadeIn();
  });

  $("#prev-step-2").on("click", () => {
    $("#step-2").hide();
    $("#step-1").fadeIn();
  });

  $("#prev-step-3").on("click", () => {
    $("#step-3").hide();
    $("#step-2").fadeIn();
  });

  $("#next-step-3").on("click", () => {
    if (!window.userCoordinates) {
      alert("Por favor, selecciona tu ubicación en el mapa.");
      return;
    }
    $("#step-3").hide();
    $("#step-4").fadeIn();
  });

  $("#prev-step-4").on("click", () => {
    $("#step-4").hide();
    $("#step-3").fadeIn();
  });

  $("#problem-photo").on("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        $("#problem-photo-preview").attr("src", e.target.result).show();
      };
      reader.readAsDataURL(file);
    }
  });

  $("#send-initial-message").on("click", sendInitialMessage);

  // Botón para obtener la ubicación del usuario
  $("#get-user-location").on("click", () => {
    initializeUserMap();
  });
}

/**
 * Inicializa el mapa para el usuario.
 */
function initializeUserMap() {
  $("#get-user-location").prop("disabled", true);
  $("#user-map-container").show();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        window.userCoordinates = userCoordinates;
        createMap(
          "user-map",
          userCoordinates,
          "userCoordinates",
          "user-location-status"
        );
        $("#next-step-3").prop("disabled", false);
      },
      (error) => {
        console.error("Error al obtener la ubicación:", error);
        alert(
          "No se pudo obtener tu ubicación. Por favor, verifica los permisos de tu navegador."
        );
        const defaultCoordinates = { latitude: 19.4326, longitude: -99.1332 }; // CDMX
        createMap(
          "user-map",
          defaultCoordinates,
          "userCoordinates",
          "user-location-status"
        );
        $("#next-step-3").prop("disabled", false);
      }
    );
  } else {
    alert("La geolocalización no es compatible con este navegador.");
    const defaultCoordinates = { latitude: 19.4326, longitude: -99.1332 }; // CDMX
    createMap(
      "user-map",
      defaultCoordinates,
      "userCoordinates",
      "user-location-status"
    );
    $("#next-step-3").prop("disabled", false);
  }
}

/**
 * Inicializa el mapa para el talachero.
 */
function initializeTalacheroMap() {
  $("#get-talachero-location").prop("disabled", true);
  $("#talachero-map-container").show();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const talacheroCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        window.talacheroCoordinates = talacheroCoordinates;
        createMap(
          "talachero-map",
          talacheroCoordinates,
          "talacheroCoordinates",
          "talachero-location-status"
        );
      },
      (error) => {
        console.error("Error al obtener la ubicación del talachero:", error);
        alert(
          "No se pudo obtener tu ubicación. Por favor, verifica los permisos de tu navegador."
        );
        const defaultCoordinates = { latitude: 19.4326, longitude: -99.1332 }; // CDMX
        createMap(
          "talachero-map",
          defaultCoordinates,
          "talacheroCoordinates",
          "talachero-location-status"
        );
      }
    );
  } else {
    alert("La geolocalización no es compatible con este navegador.");
    const defaultCoordinates = { latitude: 19.4326, longitude: -99.1332 }; // CDMX
    createMap(
      "talachero-map",
      defaultCoordinates,
      "talacheroCoordinates",
      "talachero-location-status"
    );
  }
}

/**
 * Función para crear el mapa (reutilizable).
 * @param {string} mapElementId - ID del elemento del mapa.
 * @param {object} initialCoordinates - Coordenadas iniciales { latitude, longitude }.
 * @param {string} windowCoordinatesVariableName - Nombre de la variable en window para almacenar las coordenadas.
 * @param {string} locationStatusElementId - ID del elemento para mostrar el estado de la ubicación.
 */
function createMap(
  mapElementId,
  initialCoordinates,
  windowCoordinatesVariableName,
  locationStatusElementId
) {
  const mapInstance = L.map(mapElementId).setView(
    [initialCoordinates.latitude, initialCoordinates.longitude],
    15
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(mapInstance);

  let marker;

  // Si ya existen coordenadas, cargarlas automáticamente en el mapa
  if (window[windowCoordinatesVariableName]) {
    marker = L.marker(
      [initialCoordinates.latitude, initialCoordinates.longitude],
      {
        draggable: false, // Hacer el marcador inmodificable
      }
    ).addTo(mapInstance);
    $(`#${locationStatusElementId}`).text(
      `Ubicación seleccionada: (${initialCoordinates.latitude.toFixed(
        5
      )}, ${initialCoordinates.longitude.toFixed(5)})`
    );
  }

  // Para el talachero, desactivar la modificación de la ubicación
  if (userTypeGlobal === "talachero") {
    mapInstance.dragging.disable();
    mapInstance.touchZoom.disable();
    mapInstance.doubleClickZoom.disable();
    mapInstance.scrollWheelZoom.disable();
    mapInstance.boxZoom.disable();
    mapInstance.keyboard.disable();
    if (mapInstance.tap) mapInstance.tap.disable();
  } else {
    // Permitir seleccionar ubicación al usuario
    mapInstance.on("click", function (e) {
      const { lat, lng } = e.latlng;
      if (marker) {
        mapInstance.removeLayer(marker);
      }
      marker = L.marker([lat, lng], { draggable: false }).addTo(mapInstance);
      window[windowCoordinatesVariableName] = { latitude: lat, longitude: lng };
      $(`#${locationStatusElementId}`).text(
        `Ubicación seleccionada: (${lat.toFixed(5)}, ${lng.toFixed(5)})`
      );
    });
  }
}

/**
 * Enviar el primer mensaje y crear el chat en Firebase (usuario).
 */
async function sendInitialMessage() {
  const serviceName = $("#service-selection").val();
  const description = $("#problem-description").val().trim();
  const coordinates = window.userCoordinates;
  const file = $("#problem-photo")[0].files[0];
  const talacheroId = localStorage.getItem("currentTalacheroId");

  if (!serviceName || !description || !coordinates || !talacheroId) {
    alert("Por favor, completa todos los campos.");
    return;
  }

  const messageData = {
    sender: activeSession.uid,
    serviceName,
    description,
    coordinates,
    timestamp: Date.now(),
    type: "user_initial", // Agregar tipo para identificar el mensaje inicial
  };

  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "unsigned_upload"); // Asegúrate de que este preset exista en tu cuenta de Cloudinary

    try {
      const uploadResponse = await fetch(
        "https://api.cloudinary.com/v1_1/dpydmw8qo/image/upload",
        { method: "POST", body: formData }
      );
      const result = await uploadResponse.json();
      if (result.secure_url) {
        messageData.photo = result.secure_url;
      }
    } catch (error) {
      console.error("Error al subir la imagen:", error);
      alert("Hubo un problema al subir la imagen.");
      return;
    }
  }

  try {
    const newChatRef = push(ref(database, `chats`));
    chatIdGlobal = newChatRef.key;

    await set(newChatRef, {
      sender: activeSession.uid,
      talacheroId,
      status: "waiting",
      timestamp: Date.now(),
    });

    const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
    await push(messagesRef, messageData);

    // Establecer el flag inChat para el usuario
    await set(ref(database, `users/${activeSession.uid}/inChat`), chatIdGlobal);

    // Establecer el flag inChat para el talachero
    await set(ref(database, `users/${talacheroId}/inChat`), chatIdGlobal);

    localStorage.setItem("activeChat", chatIdGlobal);
    chatRefGlobal = ref(database, `chats/${chatIdGlobal}`);

    alert("Solicitud enviada. Esperando respuesta.");
    renderChat("waiting");
    listenForChanges();
    listenForMessages();
  } catch (error) {
    console.error("Error al enviar mensaje inicial:", error);
    alert("Hubo un problema al enviar tu solicitud.");
  }
}

/**
 * Cargar los servicios disponibles del talachero seleccionado (usuario).
 */
async function loadServices() {
  const talacheroId = localStorage.getItem("currentTalacheroId");
  if (!talacheroId) return;

  try {
    const servicesRef = ref(database, `users/${talacheroId}/services`);
    const snapshot = await get(servicesRef);
    if (snapshot.exists()) {
      const services = snapshot.val();
      console.log("Servicios del talachero:", services);
      const serviceSelect = $("#service-selection");
      Object.values(services).forEach((service) => {
        serviceSelect.append(
          `<option value="${service.name}" data-price="${service.price}">${service.name} - $${service.price}</option>`
        );
      });
    } else {
      console.log("No se encontraron servicios para el talachero.");
    }
  } catch (error) {
    console.error("Error al cargar servicios:", error);
  }
}

/**
 * Renderiza los inputs iniciales para el talachero.
 */
function renderTalacheroInitialInputs() {
  $("#chat-inputs").html(`
    <div id="talachero-inputs">
      <button class="btn btn-primary" id="get-talachero-location">Obtener Mi Ubicación</button>
      <div id="talachero-map-container" style="display:none;">
        <p>Tu ubicación actual:</p>
        <div id="talachero-map" style="height: 300px;"></div>
        <p id="talachero-location-status" class="mt-2 text-muted"></p>
      </div>
      <div class="mt-3">
        <label for="available-services" class="form-label">Selecciona un servicio:</label>
        <select id="available-services" class="form-select">
          <!-- Opciones cargadas dinámicamente -->
        </select>
      </div>
      <div class="mt-2">
        <label for="service-price" class="form-label">Precio del servicio:</label>
        <input type="number" id="service-price" class="form-control" min="0" step="0.01" readonly>
      </div>
      <div class="mt-2">
        <label for="optional-note" class="form-label">Nota (opcional):</label>
        <textarea id="optional-note" class="form-control" rows="2"></textarea>
      </div>
      <button class="btn btn-primary mt-3" id="send-initial-response">Enviar Propuesta</button>
      <button class="btn btn-danger mt-3" id="reject-request">Rechazar Solicitud</button>
    </div>
  `);

  $("#get-talachero-location").on("click", () => {
    initializeTalacheroMap();
  });

  // Cargar los servicios disponibles y preseleccionar si es necesario
  loadTalacheroServices();

  // Listener para actualizar el precio cuando se selecciona un servicio diferente
  $("#available-services").on("change", function () {
    const selectedOption = $(this).find("option:selected");
    const price = selectedOption.data("price");
    $("#service-price").val(price ? parseFloat(price).toFixed(2) : "0.00");
  });

  $("#send-initial-response").on("click", sendInitialResponse);
  $("#reject-request").on("click", () => handleRequestAction("rejected"));
}

/**
 * Cargar los servicios disponibles del talachero y preseleccionar si es necesario.
 */
async function loadTalacheroServices() {
  const session = JSON.parse(localStorage.getItem("activeSession"));
  const talacheroId = session.uid;
  if (!talacheroId) {
    console.error("No se encontró el talachero seleccionado.");
    return;
  }

  try {
    const servicesRef = ref(database, `users/${talacheroId}/services`);
    const snapshot = await get(servicesRef);
    const availableServicesSelect = $("#available-services");
    availableServicesSelect.empty(); // Limpiar opciones anteriores

    if (snapshot.exists()) {
      const services = snapshot.val();
      // Filtrar servicios válidos (evitar null y asegurar que tengan name y price)
      const validServices = Object.values(services).filter(
        (service) => service && service.name && service.price
      );

      if (validServices.length > 0) {
        validServices.forEach((service) => {
          availableServicesSelect.append(
            `<option value="${service.name}" data-price="${service.price}">${service.name} - $${service.price}</option>`
          );
        });

        // Preseleccionar el servicio basado en el mensaje inicial del chat
        const userMessage = await getUserInitialMessage();
        if (userMessage && userMessage.serviceName) {
          // Verificar si el servicio del usuario está en la lista
          const serviceExists = validServices.some(
            (service) => service.name === userMessage.serviceName
          );

          if (serviceExists) {
            availableServicesSelect.val(userMessage.serviceName).trigger("change");
          } else {
            // Si el servicio no existe, añadir una opción personalizada
            availableServicesSelect.append(
              `<option value="${userMessage.serviceName}" data-price="0" selected>${userMessage.serviceName} - Precio Base</option>`
            );
            $("#service-price").val("0.00");
          }
        } else {
          // Seleccionar el primer servicio por defecto
          const firstService = validServices[0];
          availableServicesSelect.val(firstService.name).trigger("change");
        }
      } else {
        availableServicesSelect.append(
          `<option value="" disabled>No tienes servicios registrados</option>`
        );
      }
    } else {
      availableServicesSelect.append(
        `<option value="" disabled>No tienes servicios registrados</option>`
      );
    }
  } catch (error) {
    console.error("Error al cargar servicios disponibles:", error);
  }
}

/**
 * Enviar la respuesta inicial del talachero.
 */
async function sendInitialResponse() {
  const selectedService = $("#available-services").val();
  const servicePrice = parseFloat($("#service-price").val());
  const optionalNote = $("#optional-note").val().trim();
  const coordinates = window.talacheroCoordinates;

  if (!selectedService || isNaN(servicePrice) || servicePrice <= 0) {
    alert("Por favor, selecciona un servicio válido y asegúrate de que el precio sea correcto.");
    return;
  }

  if (!coordinates) {
    alert("Por favor, selecciona tu ubicación en el mapa.");
    return;
  }

  // Obtener información del mensaje inicial del usuario
  const userMessage = await getUserInitialMessage();
  if (!userMessage) {
    alert("No se pudo obtener la información del usuario.");
    return;
  }

  const userCoordinates = userMessage.coordinates;

  // Calcular la distancia
  const distanceKm = await getRouteDistance(coordinates, userCoordinates);
  if (distanceKm === null) {
    alert("No se pudo calcular la distancia de ruta.");
    return;
  }

  // Calcular el precio total
  const pricePerKm = activeSession.tarifaKm ? parseFloat(activeSession.tarifaKm) : 0;
  const distancePrice = pricePerKm * distanceKm;
  const totalPrice = servicePrice + distancePrice;

  // Descripción detallada del cálculo
  const description = `Servicio: ${selectedService}\nPrecio Base: $${servicePrice.toFixed(
    2
  )}\nDistancia: ${distanceKm.toFixed(
    2
  )} km\nPrecio por Distancia: $${distancePrice.toFixed(
    2
  )}\nSubtotal: $${(servicePrice + distancePrice).toFixed(
    2
  )}\nPrecio Final: $${totalPrice.toFixed(
    2
  )}\n${optionalNote ? "Nota: " + optionalNote : ""}`;

  const messageData = {
    sender: activeSession.uid,
    serviceName: selectedService,
    servicePrice: servicePrice.toFixed(2),
    optionalNote,
    coordinates,
    description,
    timestamp: Date.now(),
    type: "calculo", // Agregar tipo para identificar el mensaje de cálculo
    talacheroCoordinates: coordinates, // Incluir la ubicación del talachero
  };

  try {
    const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
    await push(messagesRef, messageData);

    // Crear un mensaje especial para la ruta solo si no se ha enviado previamente
    if (!routeMessageSent) {
      const routeMessage = {
        sender: "system",
        type: "route",
        description: "Ver Ruta en Tiempo Real",
        timestamp: Date.now(),
      };
      await push(messagesRef, routeMessage);
      routeMessageSent = true; // Marcar que ya se envió el mensaje
    }

    // Actualizar el estado del chat a "active"
    await update(chatRefGlobal, { status: "active" });

    // Establecer el chatUid del talachero
    await set(ref(database, `users/${activeSession.uid}/chatUid`), chatIdGlobal);

    // Mostrar mensaje de espera
    $("#chat-inputs").html(`
      <p class="text-center text-muted">Esperando confirmación del usuario...</p>
    `);
  } catch (error) {
    console.error("Error al enviar la respuesta inicial:", error);
    alert("Hubo un problema al enviar tu respuesta.");
  }
}

/**
 * Obtener el mensaje inicial del usuario.
 * @returns {object|null} Mensaje inicial del usuario o null si no existe.
 */
async function getUserInitialMessage() {
  const chatSnapshot = await get(chatRefGlobal);
  if (chatSnapshot.exists()) {
    const chatData = chatSnapshot.val();
    const senderUid = chatData.sender;

    const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
    const messagesSnapshot = await get(messagesRef);
    if (messagesSnapshot.exists()) {
      const messages = messagesSnapshot.val();
      for (const messageId in messages) {
        const message = messages[messageId];
        if (message.sender === senderUid && message.coordinates) {
          return message;
        }
      }
    }
  }
  return null;
}

/**
 * Calcular la distancia de ruta utilizando OSRM.
 * @param {object} startCoords - Coordenadas de inicio { latitude, longitude }.
 * @param {object} endCoords - Coordenadas de fin { latitude, longitude }.
 * @returns {number|null} Distancia en kilómetros o null si falla.
 */
async function getRouteDistance(startCoords, endCoords) {
  const start = `${startCoords.longitude},${startCoords.latitude}`;
  const end = `${endCoords.longitude},${endCoords.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=false`;
  console.log("Calculando distancia con OSRM:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error en la API: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const distanceMeters = data.routes[0].distance;
      const distanceKm = distanceMeters / 1000;
      console.log(`Distancia calculada: ${distanceKm.toFixed(2)} km`);
      return distanceKm;
    } else {
      console.error("No se pudo obtener la distancia de ruta:", data);
      return null;
    }
  } catch (error) {
    console.error("Error al obtener la distancia de ruta:", error);
    return null;
  }
}

/**
 * Obtener las coordenadas de la ruta utilizando OSRM.
 * @param {object} startCoords - Coordenadas de inicio { latitude, longitude }.
 * @param {object} endCoords - Coordenadas de fin { latitude, longitude }.
 * @returns {Array|null} Coordenadas de la ruta en formato [lat, lng] o null si falla.
 */
async function getRouteCoordinates(startCoords, endCoords) {
  const start = `${startCoords.longitude},${startCoords.latitude}`;
  const end = `${endCoords.longitude},${endCoords.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error en la API: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      // Extraer coordenadas de la ruta
      const coordinates = data.routes[0].geometry.coordinates;

      // Convertir las coordenadas a formato [lat, lng] para Leaflet
      const routeCoords = coordinates.map((coord) => [coord[1], coord[0]]);
      return routeCoords;
    } else {
      console.error("No se pudo obtener la ruta:", data);
      return null;
    }
  } catch (error) {
    console.error("Error al obtener la ruta:", error);
    return null;
  }
}

/**
 * Manejar la acción de rechazo (talachero).
 * @param {string} action - Acción a realizar ("rejected").
 */
async function handleRequestAction(action) {
  const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);

  try {
    if (action === "rejected") {
      const chatSnapshot = await get(chatRefGlobal);
      if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.val();

        // Limpiar el inChat del usuario
        await set(ref(database, `users/${chatData.sender}/inChat`), null);

        // Limpiar el inChat del talachero
        await set(ref(database, `users/${activeSession.uid}/inChat`), null);

        // Limpiar el chatUid del usuario
        await set(ref(database, `users/${chatData.sender}/chatUid`), null);

        await update(chatRefGlobal, { status: "rejected" });

        const rejectionMessage = {
          sender: "system",
          description: "El talachero ha rechazado la solicitud.",
          timestamp: Date.now(),
        };

        await push(messagesRef, rejectionMessage);

        alert("Solicitud rechazada y mensaje enviado al usuario.");
        loadPage("index.html");
      }
    }
  } catch (error) {
    console.error("Error al rechazar la solicitud:", error);
    alert("Hubo un error al procesar la solicitud.");
  }
}

/**
 * Configurar botones para aceptar o rechazar la propuesta (usuario).
 */
function setupProposalResponse() {
  $("#accept-proposal").on("click", async () => {
    try {
      const paymentMethod = $("#payment-method").val();
      if (!paymentMethod) {
        alert("Por favor, selecciona un método de pago.");
        return;
      }

      // Actualizar el estado del chat a "confirmed"
      await update(chatRefGlobal, { status: "confirmed" });

      // Enviar mensaje al talachero
      const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
      const confirmationMessage = {
        sender: "system",
        description: "El usuario ha aceptado la propuesta.",
        type:"route",
        timestamp: Date.now(),
        paymentMethod, // Agregar método de pago al mensaje
      };
      await push(messagesRef, confirmationMessage);

      // Establecer el flag inChat para el usuario
      await set(ref(database, `users/${activeSession.uid}/inChat`), chatIdGlobal)
        .then(() => {
          console.log("Flag inChat establecido para el usuario.");
        })
        .catch((error) => {
          console.error("Error al establecer el flag inChat:", error);
        });

      // Establecer el flag inChat para el talachero si aún no está establecido
      const chatSnapshot = await get(chatRefGlobal);
      if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.val();
        const talacheroId = chatData.talacheroId;
        const talacheroRef = ref(database, `users/${talacheroId}/inChat`);
        const talacheroSnapshot = await get(talacheroRef);
        if (!talacheroSnapshot.exists()) {
          await set(talacheroRef, chatIdGlobal);
        }
      }

      // Mostrar inputs de chat y el mapa
      renderChat("confirmed");
    } catch (error) {
      console.error("Error al aceptar la propuesta:", error);
      alert("Hubo un error al aceptar la propuesta.");
    }
  });

  $("#reject-proposal").on("click", async () => {
    try {
      // Actualizar el estado del chat a "rejected_by_user"
      await update(chatRefGlobal, { status: "rejected_by_user" });

      // Enviar mensaje al talachero
      const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
      const rejectionMessage = {
        sender: "system",
        description: "El usuario ha rechazado la propuesta.",
        timestamp: Date.now(),
      };
      await push(messagesRef, rejectionMessage);

      alert("Has rechazado la propuesta.");

      // Limpiar el inChat del usuario
      await set(ref(database, `users/${activeSession.uid}/inChat`), null)
        .then(() => {
          console.log("Flag inChat eliminado para el usuario.");
        })
        .catch((error) => {
          console.error("Error al eliminar el flag inChat:", error);
        });

      // Limpiar el chatUid del usuario
      await set(ref(database, `users/${activeSession.uid}/chatUid`), null);

      await clearChatState();
      loadPage("index.html");
    } catch (error) {
      console.error("Error al rechazar la propuesta:", error);
      alert("Hubo un error al rechazar la propuesta.");
    }
  });
}

/**
 * Enviar un mensaje especial para la ruta.
 */
async function sendRouteMessage() {
  if (routeMessageSent) return; // Evitar enviar múltiples mensajes

  const userMessage = await getUserInitialMessage();
  if (!userMessage) {
    console.error(
      "No se encontró el mensaje inicial del usuario para la ruta."
    );
    return;
  }

  const userCoordinates = userMessage.coordinates;
  const talacheroCoordinates =
    userTypeGlobal === "talachero"
      ? window.talacheroCoordinates
      : await getTalacheroCoordinatesFromChat(chatIdGlobal);

  if (!userCoordinates || !talacheroCoordinates) {
    console.error("No se pudieron obtener las coordenadas para la ruta.");
    return;
  }

  const routeMessage = {
    sender: "system",
    type: "route",
    description: "Ver Ruta en Tiempo Real",
    timestamp: Date.now(),
  };

  try {
    const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
    await push(messagesRef, routeMessage);
    routeMessageSent = true; // Marcar que ya se envió el mensaje
  } catch (error) {
    console.error("Error al enviar el mensaje de ruta:", error);
  }
}

/**
 * Obtener las coordenadas del usuario desde el chat.
 * @param {string} chatId - ID del chat.
 * @returns {object|null} Coordenadas del usuario o null si no existen.
 */
async function getUserCoordinatesFromChat(chatId) {
  const messagesRef = ref(database, `chats/${chatId}/messages`);
  const messagesSnapshot = await get(messagesRef);
  if (messagesSnapshot.exists()) {
    const messages = messagesSnapshot.val();
    for (const messageId in messages) {
      const message = messages[messageId];
      if (message.sender !== "system" && message.coordinates) {
        return message.coordinates;
      }
    }
  }
  return null;
}

/**
 * Obtener las coordenadas del talachero desde el chat.
 * @param {string} chatId - ID del chat.
 * @returns {object|null} Coordenadas del talachero o null si no existen.
 */
async function getTalacheroCoordinatesFromChat(chatId) {
  const chatSnapshot = await get(ref(database, `chats/${chatId}`));
  if (chatSnapshot.exists()) {
    const chatData = chatSnapshot.val();
    const talacheroId = chatData.talacheroId;

    // Verificar si existe la ubicación en tiempo real
    const locationRef = ref(database, `chats/${chatId}/talacheroLocation`);
    const locationSnapshot = await get(locationRef);
    if (locationSnapshot.exists()) {
      return locationSnapshot.val();
    }

    // Si no existe, obtener desde los mensajes
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const messagesSnapshot = await get(messagesRef);
    if (messagesSnapshot.exists()) {
      const messages = messagesSnapshot.val();
      for (const messageId in messages) {
        const message = messages[messageId];
        if (message.sender === talacheroId && message.coordinates) {
          return message.coordinates;
        }
      }
    }
  }
  return null;
}

/**
 * Función para iniciar el trayecto (talachero).
 */
async function startJourney() {
  if (simulationRunning) {
    alert("La simulación ya está en ejecución.");
    return;
  }

  try {
    // Actualizar el estado del chat a "journey_started"
    await update(chatRefGlobal, { status: "journey_started" });

    // Enviar mensaje especial para la ruta
    await sendRouteMessage();

    // Enviar mensaje al usuario
    const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
    const startMessage = {
      sender: "system",
      description: "El talachero ha iniciado el trayecto.",
      timestamp: Date.now(),
    };
    await push(messagesRef, startMessage);

    // Mostrar el modal automáticamente si eres el talachero
    if (userTypeGlobal === "talachero") {
      $("#routeModal").modal("show");
      $("#modal-complete-journey").hide(); // Inicialmente oculto
    }

    renderChat("journey_started");
  } catch (error) {
    console.error("Error al iniciar el trayecto:", error);
    alert("Hubo un error al iniciar el trayecto.");
  }
}

/**
 * Función para completar el servicio (talachero).
 */
/**
 * Función para completar el servicio (talachero).
 */
async function completeService() {
  try {
    // Actualizar el estado del chat a "completed"
    await update(chatRefGlobal, { status: "completed" });

    // Enviar mensaje al usuario
    const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
    const completeMessage = {
      sender: "system",
      description: "El talachero ha completado el servicio.",
      timestamp: Date.now(),
    };
    await push(messagesRef, completeMessage);

    // Cerrar el modal de ruta
    $("#routeModal").modal("hide");

    // Detener la simulación
    stopSimulation();

    // Mostrar el modal de calificación
    $("#ratingModal").modal("show");

    // Configurar el botón de envío de calificación
    $("#submit-rating").off("click").on("click", async () => {
      const rating = $("#chat-rating").val();
      if (!rating) {
        alert("Por favor, selecciona una calificación.");
        return;
      }

      try {
        // Guardar la calificación en el chat
        await update(chatRefGlobal, { rating: parseInt(rating, 10) });

        // Enviar mensaje de calificación (opcional)
        const ratingMessage = {
          sender: activeSession.uid,
          type: "rating",
          rating: parseInt(rating, 10),
          description: `Calificación recibida: ${rating}/5`,
          timestamp: Date.now(),
        };
        await push(messagesRef, ratingMessage);

        // Cerrar el modal de calificación
        $("#ratingModal").modal("hide");

        // Remover el chat de ambos perfiles
        await clearChatState();

        alert("Servicio completado y calificación enviada exitosamente.");
        loadPage("index.html");
      } catch (error) {
        console.error("Error al enviar la calificación:", error);
        alert("Hubo un problema al enviar la calificación.");
      }
    });

  } catch (error) {
    console.error("Error al completar el servicio:", error);
    alert("Hubo un error al completar el servicio.");
  }
}


/**
 * Manejar el botón de completar viaje en el modal (solo para el talachero).
 */
$("#modal-complete-journey").on("click", async () => {
  await completeService();
});

/**
 * Calcular la distancia entre dos coordenadas (en metros).
 * @param {object} coord1 - Primera coordenada { latitude, longitude }.
 * @param {object} coord2 - Segunda coordenada { latitude, longitude }.
 * @returns {number} Distancia en metros.
 */
function calculateDistance(coord1, coord2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance; // Retorna la distancia en metros
}

/**
 * Renderiza los inputs para enviar mensajes cuando el chat está activo.
 */
function renderMessageInputs() {
  $("#chat-inputs").html(`
    <div class="input-group">
      <input type="text" id="message-input" class="form-control" placeholder="Escribe un mensaje...">
      <button class="btn btn-primary" id="send-message">Enviar</button>
      <button class="btn btn-danger" id="close-chat">Cancelar Chat</button>
    </div>
  `);

  $("#send-message").on("click", sendMessage);
  $("#close-chat").on("click", () => setupCloseChat("cancelled"));
}

/**
 * Enviar un mensaje en el chat activo.
 */
async function sendMessage() {
  const messageText = $("#message-input").val().trim();

  if (!messageText) {
    alert("No puedes enviar un mensaje vacío.");
    return;
  }

  const messageData = {
    sender: activeSession.uid,
    description: messageText,
    timestamp: Date.now(),
  };

  try {
    const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
    await push(messagesRef, messageData);

    $("#message-input").val("");
  } catch (error) {
    console.error("Error al enviar el mensaje:", error);
    alert("Hubo un problema al enviar tu mensaje.");
  }
}

/**
 * Configurar el botón para cerrar el chat.
 * @param {string} cancellationStatus - Estado de cancelación.
 */
function setupCloseChat(cancellationStatus) {
  $("#close-chat, #close-rejected-chat").off("click").on("click", async () => {
    const confirmClose = confirm("¿Estás seguro de que deseas cerrar el chat?");
    if (!confirmClose) return;

    try {
      if (chatRefGlobal) {
        await update(chatRefGlobal, { status: cancellationStatus });
      }

      // Obtener datos del chat para identificar al otro participante
      const chatSnapshot = await get(chatRefGlobal);
      if (!chatSnapshot.exists()) {
        alert("El chat no existe o ya fue cerrado.");
        loadPage("index.html");
        return;
      }

      const chatData = chatSnapshot.val();
      const otherUserId =
        userTypeGlobal === "usuario" ? chatData.talacheroId : chatData.sender;

      // Limpiar el inChat del usuario que cierra el chat
      await set(ref(database, `users/${activeSession.uid}/inChat`), null);

      // Limpiar el inChat del otro participante
      if (otherUserId) {
        await set(ref(database, `users/${otherUserId}/inChat`), null);
      }

      // Limpiar el chatUid si el usuario es "usuario"
      if (userTypeGlobal === "usuario") {
        await set(ref(database, `users/${activeSession.uid}/chatUid`), null);
      }

      await clearChatState();
      alert("Chat cerrado exitosamente.");
      loadPage("index.html");
    } catch (error) {
      console.error("Error al cerrar el chat:", error);
      alert("Hubo un problema al cerrar el chat.");
    }
  });
}

/**
 * Función para iniciar la simulación localmente en ambos clientes.
 */
function startLocalSimulation() {
  // Agregar listener para cuando se muestra el modal
  $("#routeModal").on("shown.bs.modal", async function (event) {
    // Inicializar el mapa si aún no lo está
    if (!mapInitialized) {
      map = L.map("route-map").setView([0, 0], 15); // Inicializar con [0,0], se ajustará después
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      // Obtener las coordenadas de inicio y fin
      const routeCoords = await getRouteCoordinatesForSimulation();
      if (!routeCoords || routeCoords.length === 0) {
        console.error("No se pudo obtener las coordenadas para la simulación.");
        return;
      }

      routeCoordinates = routeCoords;
      currentSimulationIndex = 0;

      // Dibujar la ruta en el mapa
      routeLine = L.polyline(routeCoordinates, {
        color: "blue",
        weight: 5,
      }).addTo(map);
      map.fitBounds(routeLine.getBounds());

      // Agregar marcador inicial
      simulationMarker = L.marker(routeCoordinates[0], { icon: talacheroIcon })
        .addTo(map)
        .bindPopup("Talachero en Trayecto")
        .openPopup();

      // Iniciar la simulación
      startSimulation();

      mapInitialized = true;
    } else {
      // Si el mapa ya está inicializado, simplemente ajustar la vista y marcar la posición actual
      if (simulationMarker && routeCoordinates.length > 0) {
        simulationMarker.setLatLng(routeCoordinates[currentSimulationIndex]);
        map.panTo(routeCoordinates[currentSimulationIndex]);
      }
      map.invalidateSize(); // Recalcular el tamaño del mapa
    }
  });

  // Mostrar el modal si eres el talachero
  if (userTypeGlobal === "talachero") {
    $("#routeModal").modal("show");
    $("#modal-complete-journey").hide(); // Inicialmente oculto
  }
}

/**
 * Obtener las coordenadas de la ruta para la simulación.
 * @returns {Array|null} Coordenadas de la ruta en formato [lat, lng] o null si falla.
 */
async function getRouteCoordinatesForSimulation() {
  const userMessage = await getUserInitialMessage();
  if (!userMessage) {
    console.error(
      "No se encontró el mensaje inicial del usuario para la ruta."
    );
    return null;
  }

  const userCoordinates = userMessage.coordinates;
  const talacheroCoordinates =
    userTypeGlobal === "talachero"
      ? window.talacheroCoordinates
      : await getTalacheroCoordinatesFromChat(chatIdGlobal);

  if (!userCoordinates || !talacheroCoordinates) {
    console.error("No se pudieron obtener las coordenadas para la ruta.");
    return null;
  }

  const newRouteCoordinates = await getRouteCoordinates(
    talacheroCoordinates,
    userCoordinates
  );
  return newRouteCoordinates;
}

/**
 * Función para iniciar la simulación del trayecto (simulada, no en tiempo real).
 */
function startSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
  }

  simulationInterval = setInterval(() => {
    if (currentSimulationIndex >= routeCoordinates.length - 1) {
      clearInterval(simulationInterval);
      simulationInterval = null;
      simulationRunning = false;
      return; // Eliminado alert("¡Llegaste al destino!");
    }

    currentSimulationIndex++;
    const newLatLng = routeCoordinates[currentSimulationIndex];

    // Mover el marcador
    simulationMarker.setLatLng(newLatLng);
    map.panTo(newLatLng);

    // Detectar si el talachero ha llegado al destino
    const remainingDistance = calculateDistance(
      { latitude: newLatLng[0], longitude: newLatLng[1] },
      {
        latitude: routeCoordinates[routeCoordinates.length - 1][0],
        longitude: routeCoordinates[routeCoordinates.length - 1][1],
      }
    );
    if (remainingDistance < 100) {
      // menos de 100 metros
      clearInterval(simulationInterval);
      simulationInterval = null;
      simulationRunning = false;

      // Evitar múltiples llamadas a setChatStatus
      if (!alertShown) {
        setChatStatus("en_servicio");
        alertShown = true;
        if(userTypeGlobal === "talachero"){
          alert("Has llegado al destino y estás atendiendo al usuario.");
        }
        
      }
    }
  }, 1000); // Actualiza cada 1 segundo
}

/**
 * Función para detener la simulación del trayecto.
 */
function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  simulationRunning = false;
}

/**
 * Función para establecer el estado del chat.
 * @param {string} newStatus - Nuevo estado del chat.
 */
async function setChatStatus(newStatus) {
  try {
    await update(chatRefGlobal, { status: newStatus });

    // Si el nuevo estado es "en_servicio", enviar un mensaje al usuario
    if (newStatus === "en_servicio") {
      const messagesRef = ref(database, `chats/${chatIdGlobal}/messages`);
      const enServicioMessage = {
        sender: "system",
        description:
          "El talachero ha llegado al lugar y está atendiendo tu solicitud.",
        timestamp: Date.now(),
        type: "en_servicio",
      };
      await push(messagesRef, enServicioMessage);
    }
  } catch (error) {
    console.error(
      `Error al actualizar el estado del chat a ${newStatus}:`,
      error
    );
    alert("Hubo un problema al actualizar el estado del chat.");
  }
}
