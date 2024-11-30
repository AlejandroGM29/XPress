import { database } from "./firebase-config.js";
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { handleLogout } from "./auth.js"; // Importar la función de logout centralizada

// Inicializar la página del talachero/mecánico
export function initMecanicoPage() {
  const activeSession = JSON.parse(localStorage.getItem("activeSession"));

  if (!activeSession || activeSession.userType !== "talachero") {
    alert("Debes iniciar sesión como talachero.");
    window.location.href = "login.html";
    return;
  }
  console.log("HOLA?")
  // Configurar datos del talachero
  document.getElementById("talachero-name").textContent =
    activeSession.name || "Talachero";

  // Cargar servicios y solicitudes
  loadServices(activeSession.uid);
  loadRequests(activeSession.uid);

  setupAddService(activeSession.uid); // Configurar botón de agregar servicio
  setupToggleActive(activeSession.uid); // Configurar botón de estado activo/inactivo
}

// Cargar solicitudes en la pestaña de solicitudes
function loadRequests(talacheroId) {
  const requestsRef = ref(database, `chats`);
  const requestList = document.getElementById("request-list");

  onValue(requestsRef, async (snapshot) => {
    requestList.innerHTML = "";

    if (snapshot.exists()) {
      const chats = snapshot.val();

      const pendingRequests = Object.entries(chats).filter(
        ([chatId, chatData]) =>
          chatData.talacheroId === talacheroId && chatData.status === "waiting"
      );

      if (pendingRequests.length === 0) {
        requestList.innerHTML = "<p>No tienes solicitudes pendientes.</p>";
        return;
      }

      for (const [chatId, chatData] of pendingRequests) {
        // Obtener información del sender
        const senderSnapshot = await get(ref(database, `users/${chatData.sender}`));
        if (senderSnapshot.exists()) {
          const senderData = senderSnapshot.val();
          chatData.userName = senderData.name || "Usuario desconocido";
          chatData.userPhoto = senderData.photo || "./img/team/person.png";
        } else {
          chatData.userName = "Usuario desconocido";
          chatData.userPhoto = "./img/team/person.png";
        }

        // Renderizar tarjeta de solicitud
        renderRequestCard(chatId, chatData);
      }
    } else {
      requestList.innerHTML = "<p>No tienes solicitudes pendientes.</p>";
    }
  });
}

// Renderizar una tarjeta de solicitud
// Renderizar una tarjeta de solicitud
function renderRequestCard(chatId, chatData) {
  const requestList = document.getElementById("request-list");

  const cardHtml = `
    <div class="card mb-3" data-chat-id="${chatId}">
      <div class="row g-0">
        <!-- Sección izquierda: Información del cliente -->
        <div class="col-md-9 d-flex align-items-center card-left" style="cursor: pointer;">
          <img src="${chatData.userPhoto}" class="img-fluid rounded-start me-3" alt="${chatData.userName}" style="width: 100px; height: 100px; object-fit: cover;">
          <div>
            <h5 class="card-title">${chatData.serviceName}</h5>
            <p class="card-text">${chatData.description}</p>
            <p class="card-text"><small class="text-muted">De: ${chatData.userName}</small></p>
          </div>
        </div>

        <!-- Sección derecha: Botón de rechazar -->
        <div class="col-md-3 d-flex align-items-center justify-content-center">
          <button class="btn btn-danger btn-lg reject-request w-75">Rechazar</button>
        </div>
      </div>
    </div>
  `;

  requestList.insertAdjacentHTML("beforeend", cardHtml);

  // Configurar eventos para las acciones
  setupRejectButton(chatId);
  setupCardLeftClick(chatId);
}

// Configurar evento para clic en la parte izquierda
function setupCardLeftClick(chatId) {
  const requestCardLeft = document.querySelector(`[data-chat-id="${chatId}"] .card-left`);

  requestCardLeft.addEventListener("click", () => {
    console.log(`Clicked on the left section of the card with chatId: ${chatId}`);
  });
}

// Configurar botón de rechazar
function setupRejectButton(chatId) {
  const requestCard = document.querySelector(`[data-chat-id="${chatId}"]`);
  const rejectButton = requestCard.querySelector(".reject-request");

  rejectButton.addEventListener("click", () => handleRequestAction(chatId, "rejected"));
}

// Manejar acciones sobre la solicitud
async function handleRequestAction(chatId, action) {
  const chatRef = ref(database, `chats/${chatId}`);
  const userRef = ref(database, `users`);

  try {
    if (action === "rejected") {
      const chatSnapshot = await get(chatRef);
      if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.val();

        // Liberar al usuario del `inChat`
        await update(ref(database, `users/${chatData.sender}`), { inChat: null });

        // Cambiar estado del chat
        await update(chatRef, { status: "rejected" });
        alert("Solicitud rechazada.");
      }
    }
  } catch (error) {
    console.error("Error al rechazar la solicitud:", error);
    alert("Hubo un error al procesar la solicitud.");
  }
}


// Cargar servicios del talachero desde Firebase
async function loadServices(uid) {
  try {
    const servicesRef = ref(database, `users/${uid}/services`);
    const snapshot = await get(servicesRef);

    if (snapshot.exists()) {
      const services = snapshot.val();
      renderServices(services); // Renderizar servicios con IDs numéricos
    } else {
      console.log("No se encontraron servicios para este usuario.");
      renderServices([]); // Renderizar sin servicios
    }
  } catch (error) {
    console.error("Error al cargar servicios:", error);
  }
}

// Renderizar la lista de servicios en la interfaz
function renderServices(services) {
  const serviceList = document.getElementById("service-list");
  serviceList.innerHTML = "";

  if (Object.keys(services).length === 0) {
    serviceList.innerHTML = "<p>No tienes servicios registrados.</p>";
    return;
  }
  console.log(services)
  Object.entries(services).forEach(([id, service]) => {
    const serviceItem = `
      <div class="card mb-2">
        <div class="card-body">
          <h5>${service.name}</h5>
          <p>${service.description}</p>
          <p><strong>Precio:</strong> $${service.price}</p>
          <button class="btn btn-danger btn-sm remove-service" data-id="${id}">Eliminar</button>
        </div>
      </div>`;
    serviceList.insertAdjacentHTML("beforeend", serviceItem);
  });

  setupRemoveServiceButtons(); // Configurar botones para eliminar servicios
}

// Configurar el botón de agregar servicio
function setupAddService(uid) {
  const addServiceButton = document.getElementById("add-service");
  addServiceButton.addEventListener("click", async () => {
    const name = prompt("Nombre del servicio:");
    const description = prompt("Descripción del servicio:");
    const price = prompt("Precio del servicio:");

    if (name && description && price) {
      try {
        const servicesRef = ref(database, `users/${uid}/services`);
        const snapshot = await get(servicesRef);
        const services = snapshot.exists() ? snapshot.val() : {};

        // Generar el próximo ID numérico
        const nextId = Object.keys(services).length
          ? Math.max(...Object.keys(services).map(Number)) + 1
          : 1;

        // Agregar el servicio con ID numérico
        services[nextId] = { name, description, price };
        await set(servicesRef, services);

        alert("Servicio agregado con éxito.");
        loadServices(uid); // Recargar la lista de servicios
      } catch (error) {
        console.error("Error al agregar el servicio:", error);
        alert("Error al agregar el servicio.");
      }
    }
  });
}

// Configurar botón para cambiar estado activo/inactivo
function setupToggleActive(uid) {
  const toggleActiveButton = document.getElementById("toggle-active");

  // Obtener el estado inicial desde Firebase
  get(ref(database, `users/${uid}`)).then((snapshot) => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      toggleActiveButton.textContent = userData.isActive ? "Estar Inactivo" : "Estar Activo";
    }
  });

  // Cambiar estado al hacer clic
  toggleActiveButton.addEventListener("click", async () => {
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        const newState = !userData.isActive;

        // Actualizar el estado en Firebase
        await update(userRef, { isActive: newState });

        // Actualizar el botón en la interfaz
        toggleActiveButton.textContent = newState ? "Estar Inactivo" : "Estar Activo";
        alert(`Tu estado ahora es: ${newState ? "Activo" : "Inactivo"}`);
      }
    } catch (error) {
      console.error("Error al cambiar el estado:", error);
      alert("Hubo un error al cambiar tu estado.");
    }
  });
}

// Configurar botones para eliminar servicios
function setupRemoveServiceButtons() {
  const removeButtons = document.querySelectorAll(".remove-service");
  removeButtons.forEach((button) => {
    button.addEventListener("click", async (event) => {
      const serviceId = event.target.getAttribute("data-id");
      const activeSession = JSON.parse(localStorage.getItem("activeSession"));

      if (!activeSession || !activeSession.uid) {
        alert("Acceso no autorizado.");
        return;
      }

      try {
        const servicesRef = ref(database, `users/${activeSession.uid}/services`);
        const snapshot = await get(servicesRef);

        if (snapshot.exists()) {
          const services = snapshot.val();
          delete services[serviceId]; // Eliminar el servicio del objeto

          // Actualizar servicios en Firebase
          await set(servicesRef, services);
          alert("Servicio eliminado con éxito.");
          loadServices(activeSession.uid); // Recargar la lista de servicios
        }
      } catch (error) {
        console.error("Error al eliminar el servicio:", error);
        alert("Error al eliminar el servicio.");
      }
    });
  });
}
