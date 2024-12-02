import { database } from "./firebase-config.js";
import { ref, get, set, update, onValue, push } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Mover la variable requestsUnsubscribe al nivel del módulo
let requestsUnsubscribe = null;

export function initMecanicoPage() {
    console.log("initMecanicoPage called");

    const activeSession = JSON.parse(localStorage.getItem("activeSession"));

    if (!activeSession || activeSession.userType !== "talachero") {
        alert("Debes iniciar sesión como talachero.");
        loadPage("login.html");
        return;
    }

    $("#talachero-name").text(activeSession.name || "Talachero");

    loadServices(activeSession.uid);
    loadRequests(activeSession.uid);

    setupAddService(activeSession.uid);
    setupToggleActive(activeSession.uid);

    // Mostrar tarifa actual
    const tarifaKmDisplay = $("#tarifa-km-display");
    tarifaKmDisplay.text(activeSession.tarifaKm || "No establecida");

    // Configurar tarifa por kilómetro
    const setTarifaKmButton = $("#set-tarifa-km");
    setTarifaKmButton.on("click", async () => {
        const tarifaKm = prompt("Introduce tu tarifa por kilómetro:");
        if (tarifaKm) {
            try {
                await update(ref(database, `users/${activeSession.uid}`), { tarifaKm });
                activeSession.tarifaKm = tarifaKm;
                localStorage.setItem("activeSession", JSON.stringify(activeSession));
                tarifaKmDisplay.text(tarifaKm);
                alert("Tarifa actualizada exitosamente.");
            } catch (error) {
                console.error("Error al actualizar tarifa:", error);
            }
        }
    });

    // Limpiamos eventos previos antes de adjuntar nuevos
    $(document).off('.mecanicoEvents');

    // Usamos delegación de eventos con espacio de nombres
    $(document).on('click.mecanicoEvents', '.reject-request', function() {
        const chatId = $(this).closest('[data-chat-id]').data('chat-id');
        handleRequestAction(chatId, 'rejected');
    });

    $(document).on('click.mecanicoEvents', '.card-left', function() {
        const chatId = $(this).closest('[data-chat-id]').data('chat-id');
        localStorage.setItem('activeChat', chatId);
        loadPage('chat.html');
    });

    // Verificar si hay un chat activo y redirigir
    checkChatStatus();
}

export function destroyMecanicoPage() {
    console.log("destroyMecanicoPage called");
    if (requestsUnsubscribe) {
        requestsUnsubscribe();
        requestsUnsubscribe = null;
    }
    $(document).off('.mecanicoEvents');
}

async function checkChatStatus() {
    const activeSession = JSON.parse(localStorage.getItem("activeSession"));
    const userRef = ref(database, `users/${activeSession.uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.inChat) {
            // Si hay un chat activo, redirigir al talachero al chat
            alert("Tienes un chat activo. Redirigiéndote...");
            localStorage.setItem("activeChat", userData.inChat);
            loadPage("chat.html");
        } else {
            // Limpiar información residual si es necesario
            localStorage.removeItem("activeChat");
        }
    }
}

let requestsCallback = null;
let isProcessing = false;

function loadRequests(talacheroId) {
    const requestsRef = ref(database, `chats`);
    const requestList = $("#request-list");

    // Si hay un listener anterior, lo desuscribimos
    if (requestsCallback) {
        console.log("Desuscribiendo listener anterior");
        off(requestsRef, 'value', requestsCallback);
        requestsCallback = null;
    }

    // Definimos el callback y lo almacenamos
    requestsCallback = async (snapshot) => {
        if (isProcessing) {
            console.log('Ya se está procesando, se omite esta llamada');
            return;
        }
        isProcessing = true;

        console.log("onValue triggered for requestsRef");
        requestList.empty();

        if (snapshot.exists()) {
            const chats = snapshot.val();
            console.log("Chats obtenidos:", chats);

            const pendingRequests = Object.entries(chats).filter(
                ([chatId, chatData]) =>
                    chatData.talacheroId === talacheroId && chatData.status === "waiting"
            );

            console.log("Solicitudes pendientes:", pendingRequests);

            if (pendingRequests.length === 0) {
                requestList.html("<p>No tienes solicitudes pendientes.</p>");
                isProcessing = false;
                return;
            }

            for (const [chatId, originalChatData] of pendingRequests) {
                console.log(`Procesando solicitud: ${chatId}`, originalChatData);

                // Crear una copia profunda de chatData
                const chatData = JSON.parse(JSON.stringify(originalChatData));

                // Obtener información del usuario
                const senderSnapshot = await get(ref(database, `users/${chatData.sender}`));
                if (senderSnapshot.exists()) {
                    const senderData = senderSnapshot.val();
                    chatData.userName = senderData.name || "Usuario desconocido";
                    chatData.userPhoto = senderData.photo || "./img/team/person.png";
                } else {
                    chatData.userName = "Usuario desconocido";
                    chatData.userPhoto = "./img/team/person.png";
                }

                // Obtener el primer mensaje para extraer serviceName y description
                const messagesRef = ref(database, `chats/${chatId}/messages`);
                const messagesSnapshot = await get(messagesRef);

                if (messagesSnapshot.exists()) {
                    const messages = messagesSnapshot.val();
                    const messageEntries = Object.entries(messages);
                    // Ordenar por timestamp
                    messageEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                    const initialMessage = messageEntries[0][1];

                    chatData.serviceName = initialMessage.serviceName || "Servicio desconocido";
                    chatData.description = initialMessage.description || "";
                } else {
                    chatData.serviceName = "Servicio desconocido";
                    chatData.description = "";
                }

                renderRequestCard(chatId, chatData);
            }
        } else {
            requestList.html("<p>No tienes solicitudes pendientes.</p>");
        }

        isProcessing = false;
    };

    // Registramos el listener
    onValue(requestsRef, requestsCallback);
}



function renderRequestCard(chatId, chatData) {
    console.log(`Renderizando tarjeta para solicitud: ${chatId}`, chatData);
    const requestList = $("#request-list");

    const cardHtml = `
        <div class="card mb-3" data-chat-id="${chatId}">
            <div class="row g-0">
                <div class="col-md-9 d-flex align-items-center card-left" style="cursor: pointer;">
                    <img src="${chatData.userPhoto}" class="img-fluid rounded-start me-3" alt="${chatData.userName}" style="width: 100px; height: 100px; object-fit: cover;">
                    <div>
                        <h5 class="card-title">${chatData.serviceName}</h5>
                        <p class="card-text">${chatData.description}</p>
                        <p class="card-text"><small class="text-muted">De: ${chatData.userName}</small></p>
                    </div>
                </div>
                <div class="col-md-3 d-flex align-items-center justify-content-center">
                    <button class="btn btn-danger btn-lg reject-request w-75">Rechazar</button>
                </div>
            </div>
        </div>
    `;

    requestList.append(cardHtml);
}

async function handleRequestAction(chatId, action) {
    const chatRef = ref(database, `chats/${chatId}`);
    const messagesRef = ref(database, `chats/${chatId}/messages`);

    try {
        if (action === "rejected") {
            const chatSnapshot = await get(chatRef);
            if (chatSnapshot.exists()) {
                const chatData = chatSnapshot.val();

                await update(ref(database, `users/${chatData.sender}`), { inChat: null });
                await update(chatRef, { status: "rejected" });

                const rejectionMessage = {
                    sender: "system",
                    description: "El talachero ha rechazado la solicitud.",
                    timestamp: Date.now(),
                };

                await push(messagesRef, rejectionMessage);

                alert("Solicitud rechazada y mensaje enviado al usuario.");
            }
        }
    } catch (error) {
        console.error("Error al rechazar la solicitud:", error);
        alert("Hubo un error al procesar la solicitud.");
    }
}

async function loadServices(uid) {
    console.log("Cargando servicios para UID:", uid);
    try {
        const servicesRef = ref(database, `users/${uid}/services`);
        const snapshot = await get(servicesRef);

        if (snapshot.exists()) {
            const services = snapshot.val();
            console.log("Servicios obtenidos:", services);
            renderServices(services);
        } else {
            console.log("No se encontraron servicios.");
            renderServices([]);
        }
    } catch (error) {
        console.error("Error al cargar servicios:", error);
    }
}

function renderServices(services) {
    const serviceList = $("#service-list");
    serviceList.empty();

    if (Object.keys(services).length === 0) {
        serviceList.html("<p>No tienes servicios registrados.</p>");
        return;
    }

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
        serviceList.append(serviceItem);
    });

    setupRemoveServiceButtons();
}

function setupAddService(uid) {
    const addServiceButton = $("#add-service");
    addServiceButton.on("click", async () => {
        const name = prompt("Nombre del servicio:");
        const description = prompt("Descripción del servicio:");
        const price = prompt("Precio del servicio:");

        if (name && description && price) {
            try {
                const servicesRef = ref(database, `users/${uid}/services`);
                const snapshot = await get(servicesRef);
                const services = snapshot.exists() ? snapshot.val() : {};

                const nextId = Object.keys(services).length
                    ? Math.max(...Object.keys(services).map(Number)) + 1
                    : 1;

                services[nextId] = { name, description, price };
                await set(servicesRef, services);

                alert("Servicio agregado con éxito.");
                loadServices(uid);
            } catch (error) {
                console.error("Error al agregar el servicio:", error);
                alert("Error al agregar el servicio.");
            }
        }
    });
}

function setupToggleActive(uid) {
    const toggleActiveButton = $("#toggle-active");

    get(ref(database, `users/${uid}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            toggleActiveButton.text(userData.isActive ? "Estar Inactivo" : "Estar Activo");
        }
    });

    toggleActiveButton.on("click", async () => {
        try {
            const userRef = ref(database, `users/${uid}`);
            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                const userData = snapshot.val();
                const newState = !userData.isActive;

                await update(userRef, { isActive: newState });

                toggleActiveButton.text(newState ? "Estar Inactivo" : "Estar Activo");
                alert(`Tu estado ahora es: ${newState ? "Activo" : "Inactivo"}`);
            }
        } catch (error) {
            console.error("Error al cambiar el estado:", error);
            alert("Hubo un error al cambiar tu estado.");
        }
    });
}

function setupRemoveServiceButtons() {
    const removeButtons = $(".remove-service");
    removeButtons.on("click", async (event) => {
        const serviceId = $(event.target).data("id");
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
                delete services[serviceId];

                await set(servicesRef, services);
                alert("Servicio eliminado con éxito.");
                loadServices(activeSession.uid);
            }
        } catch (error) {
            console.error("Error al eliminar el servicio:", error);
            alert("Error al eliminar el servicio.");
        }
    });
}
