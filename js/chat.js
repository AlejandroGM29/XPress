// Importar las funciones necesarias de Firebase
import { database } from "./firebase-config.js";
import { ref, get, set, push, update, onValue } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Función principal para inicializar la página del chat
export function initChatPage() {
    const activeSession = JSON.parse(localStorage.getItem("activeSession"));
    const userType = activeSession ? activeSession.userType : null;
    let chatId = localStorage.getItem("activeChat");
    const chatContainer = $("#chat-messages");

    if (!activeSession) {
        alert("No se pudo cargar el chat. Por favor, inicia sesión nuevamente.");
        window.location.href = "login.html";
        return;
    }

    let chatRef = chatId ? ref(database, `chats/${chatId}`) : null;

    // Validar el estado actual del chat
    async function validateChatState() {
        try {
            if (!chatId) {
                const userChatRef = ref(database, `users/${activeSession.uid}/inChat`);
                const userSnapshot = await get(userChatRef);
                chatId = userSnapshot.val();

                if (!chatId) {
                    // No hay chat activo: mostrar inputs iniciales para crear uno nuevo (solo para usuarios)
                    if (userType === "usuario") {
                        renderInitialInputs();
                    } else {
                        alert("No tienes chats activos.");
                        window.location.href = "index.html";
                    }
                    return;
                }

                chatRef = ref(database, `chats/${chatId}`);
            }

            const chatSnapshot = await get(chatRef);
            if (!chatSnapshot.exists()) {
                alert("El chat no existe o fue eliminado.");
                await clearChatState();
                window.location.href = "index.html";
                return;
            }

            const chatData = chatSnapshot.val();

            // Si el chat está cerrado, limpiar el estado y redirigir
            if (chatData.status === "cancelled" || chatData.status === "completed") {
                await clearChatState();
                alert("El chat ha sido cerrado.");
                window.location.href = "index.html";
                return;
            }

            // Renderizar la interfaz según el estado del chat
            renderChat(chatData.status);
            listenForChanges();
            listenForMessages();
        } catch (error) {
            console.error("Error al validar el estado del chat:", error);
            alert("Ocurrió un error al cargar el chat. Intenta nuevamente.");
            window.location.href = "index.html";
        }
    }

    // Limpiar el estado local del chat
    async function clearChatState() {
        try {
            await set(ref(database, `users/${activeSession.uid}/inChat`), null);
            localStorage.removeItem("activeChat");
        } catch (error) {
            console.error("Error al limpiar el estado del chat:", error);
        }
    }

    // Escuchar cambios en el chat y actualizar la interfaz en tiempo real
    function listenForChanges() {
        if (!chatRef) return;

        onValue(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const chatData = snapshot.val();
                renderChat(chatData.status);
            }
        });
    }

    // Escuchar mensajes nuevos y renderizarlos en el chat
    function listenForMessages() {
        const messagesRef = ref(database, `chats/${chatId}/messages`);

        onValue(messagesRef, (snapshot) => {
            if (snapshot.exists()) {
                const messages = Object.entries(snapshot.val()).map(([id, data]) => ({
                    id,
                    ...data,
                }));
                renderMessages(messages);
            } else {
                chatContainer.html("<p class='text-muted'>No hay mensajes aún.</p>");
            }
        });
    }

    // Renderizar mensajes en la interfaz
    function renderMessages(messages) {
        chatContainer.empty();

        messages.forEach((message) => {
            const isUserMessage = message.sender === activeSession.uid;
            const isSystemMessage = message.sender === "system";
            const isTalacheroMessage = !isUserMessage && !isSystemMessage;

            const messageHtml = `
                <div class="message ${
                    isSystemMessage
                        ? "system-message"
                        : isUserMessage
                        ? "user-message"
                        : "talachero-message"
                }">
                    ${
                        isSystemMessage
                            ? `<p><em>${message.description}</em></p>`
                            : `<p>${message.description}</p>`
                    }
                    ${
                        message.photo
                            ? `<img src="${message.photo}" alt="Imagen" style="max-width: 300px;">`
                            : ""
                    }
                    <small>${new Date(message.timestamp).toLocaleString()}</small>
                </div>
            `;
            chatContainer.append(messageHtml);
        });

        chatContainer.scrollTop(chatContainer[0].scrollHeight);
    }

    // Renderizar la interfaz según el estado del chat
    function renderChat(status) {
        $("#chat-inputs").empty();

        if (userType === "usuario") {
            renderUserChat(status);
        } else if (userType === "talachero") {
            renderTalacheroChat(status);
        }
    }

    // Renderizar la interfaz del usuario
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
            renderMessageInputs();
        } else if (status === "completed") {
            $("#chat-inputs").html(`
                <p class="text-center text-success">El chat se ha completado.</p>
            `);
        }
    }

    // Renderizar la interfaz del talachero
    function renderTalacheroChat(status) {
        if (status === "waiting") {
            renderTalacheroInitialInputs();
        } else if (status === "active") {
            $("#chat-inputs").html(`
                <p class="text-center text-muted">Esperando confirmación del usuario...</p>
            `);
        } else if (status === "confirmed") {
            renderMessageInputs();
        } else if (status === "rejected_by_user") {
            $("#chat-inputs").html(`
                <p class="text-center text-muted">El usuario rechazó tu propuesta.</p>
                <button class="btn btn-danger mt-3" id="close-chat">Cerrar Chat</button>
            `);
            setupCloseChat("cancelled_by_talachero");
        } else if (status === "completed") {
            $("#chat-inputs").html(`
                <p class="text-center text-success">El chat se ha completado.</p>
            `);
        }
    }

    // Renderizar inputs iniciales para crear un nuevo chat (solo usuario)
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
                <label for="problem-photo">Sube una foto del problema (opcional):</label>
                <input type="file" id="problem-photo" class="form-control" accept="image/*">
                <img id="problem-photo-preview" src="" alt="Previsualización" style="display:none; max-width: 200px; margin-top:10px;">
                <div class="mt-3 d-flex justify-content-between">
                    <button class="btn btn-secondary" id="prev-step-3">Regresar</button>
                    <button class="btn btn-primary" id="send-initial-message">Enviar</button>
                </div>
            </div>
        `);

        setupInitialInputs();
        loadServices();
    }

    // Configurar eventos de los inputs iniciales (usuario)
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
    }

    // Enviar el primer mensaje y crear el chat en Firebase (usuario)
    async function sendInitialMessage() {
        const serviceName = $("#service-selection").val();
        const description = $("#problem-description").val().trim();
        const file = $("#problem-photo")[0].files[0];
        const talacheroId = localStorage.getItem("currentTalacheroId");

        if (!serviceName || !description || !talacheroId) {
            alert("Por favor, completa todos los campos.");
            return;
        }

        const messageData = {
            sender: activeSession.uid,
            serviceName,
            description,
            timestamp: Date.now(),
        };

        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "unsigned_upload");

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
            chatId = newChatRef.key;

            await set(newChatRef, {
                sender: activeSession.uid,
                talacheroId,
                status: "waiting",
                timestamp: Date.now(),
            });

            const messagesRef = ref(database, `chats/${chatId}/messages`);
            await push(messagesRef, messageData);

            const userRef = ref(database, `users/${activeSession.uid}/inChat`);
            await set(userRef, chatId);

            localStorage.setItem("activeChat", chatId);
            chatRef = ref(database, `chats/${chatId}`);

            alert("Solicitud enviada. Esperando respuesta.");
            renderChat("waiting");
            listenForChanges();
            listenForMessages();
        } catch (error) {
            console.error("Error al enviar mensaje inicial:", error);
            alert("Hubo un problema al enviar tu solicitud.");
        }
    }

    // Cargar los servicios disponibles del talachero seleccionado (usuario)
    async function loadServices() {
        const talacheroId = localStorage.getItem("currentTalacheroId");
        if (!talacheroId) return;

        try {
            const servicesRef = ref(database, `users/${talacheroId}/services`);
            const snapshot = await get(servicesRef);
            if (snapshot.exists()) {
                const services = snapshot.val();
                const serviceSelect = $("#service-selection");
                Object.values(services).forEach((service) => {
                    serviceSelect.append(
                        `<option value="${service.name}">${service.name} - $${service.price}</option>`
                    );
                });
            }
        } catch (error) {
            console.error("Error al cargar servicios:", error);
        }
    }

    // Renderizar inputs iniciales para el talachero
    function renderTalacheroInitialInputs() {
        $("#chat-inputs").html(`
            <div id="talachero-inputs">
                <label for="service-selection">Selecciona el servicio a realizar:</label>
                <select id="service-selection" class="form-select"></select>
                <label for="service-price" class="mt-2">Precio del servicio:</label>
                <input type="number" id="service-price" class="form-control" min="0">
                <label for="optional-note" class="mt-2">Nota (opcional):</label>
                <textarea id="optional-note" class="form-control" rows="2"></textarea>
                <button class="btn btn-primary mt-3" id="send-initial-response">Enviar</button>
                <button class="btn btn-danger mt-3" id="reject-request">Rechazar Solicitud</button>
            </div>
        `);

        loadTalacheroServices();

        $("#send-initial-response").on("click", sendInitialResponse);
        $("#reject-request").on("click", () => handleRequestAction("rejected"));
    }

    // Cargar los servicios del talachero
    async function loadTalacheroServices() {
        const serviceSelect = $("#service-selection");
        const servicesRef = ref(database, `users/${activeSession.uid}/services`);

        try {
            const snapshot = await get(servicesRef);
            if (snapshot.exists()) {
                const services = snapshot.val();
                Object.values(services).forEach((service) => {
                    serviceSelect.append(
                        `<option value="${service.name}">${service.name}</option>`
                    );
                });
            } else {
                serviceSelect.append(
                    `<option value="">No tienes servicios registrados</option>`
                );
            }
        } catch (error) {
            console.error("Error al cargar servicios:", error);
        }
    }

    // Enviar la respuesta inicial del talachero
    async function sendInitialResponse() {
        const serviceName = $("#service-selection").val();
        const servicePrice = $("#service-price").val();
        const optionalNote = $("#optional-note").val().trim();

        if (!serviceName || !servicePrice) {
            alert("Por favor, completa el servicio y el precio.");
            return;
        }

        const messageData = {
            sender: activeSession.uid,
            serviceName,
            servicePrice,
            optionalNote,
            description: `Servicio: ${serviceName}\nPrecio: $${servicePrice}\n${optionalNote ? 'Nota: ' + optionalNote : ''}`,
            timestamp: Date.now(),
        };

        try {
            const messagesRef = ref(database, `chats/${chatId}/messages`);
            await push(messagesRef, messageData);

            // Actualizar el estado del chat a "active"
            const chatRef = ref(database, `chats/${chatId}`);
            await update(chatRef, { status: "active" });

            // Mostrar mensaje de espera
            $("#chat-inputs").html(`
                <p class="text-center text-muted">Esperando confirmación del usuario...</p>
            `);
        } catch (error) {
            console.error("Error al enviar la respuesta inicial:", error);
            alert("Hubo un problema al enviar tu respuesta.");
        }
    }

    // Manejar la acción de rechazo (talachero)
    async function handleRequestAction(action) {
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
                    window.location.href = "index.html";
                }
            }
        } catch (error) {
            console.error("Error al rechazar la solicitud:", error);
            alert("Hubo un error al procesar la solicitud.");
        }
    }

    // Configurar botones para aceptar o rechazar la propuesta (usuario)
    function setupProposalResponse() {
        $("#accept-proposal").on("click", async () => {
            try {
                // Actualizar el estado del chat a "confirmed"
                const chatRef = ref(database, `chats/${chatId}`);
                await update(chatRef, { status: "confirmed" });

                // Enviar mensaje al talachero
                const messagesRef = ref(database, `chats/${chatId}/messages`);
                const confirmationMessage = {
                    sender: "system",
                    description: "El usuario ha aceptado la propuesta.",
                    timestamp: Date.now(),
                };
                await push(messagesRef, confirmationMessage);

                // Mostrar inputs de chat
                renderChat("confirmed");
            } catch (error) {
                console.error("Error al aceptar la propuesta:", error);
                alert("Hubo un error al aceptar la propuesta.");
            }
        });

        $("#reject-proposal").on("click", async () => {
            try {
                // Actualizar el estado del chat a "rejected_by_user"
                const chatRef = ref(database, `chats/${chatId}`);
                await update(chatRef, { status: "rejected_by_user" });

                // Enviar mensaje al talachero
                const messagesRef = ref(database, `chats/${chatId}/messages`);
                const rejectionMessage = {
                    sender: "system",
                    description: "El usuario ha rechazado la propuesta.",
                    timestamp: Date.now(),
                };
                await push(messagesRef, rejectionMessage);

                alert("Has rechazado la propuesta.");
                await clearChatState();
                window.location.href = "index.html";
            } catch (error) {
                console.error("Error al rechazar la propuesta:", error);
                alert("Hubo un error al rechazar la propuesta.");
            }
        });
    }

    // Renderizar inputs para enviar mensajes cuando el chat está activo
    function renderMessageInputs() {
        $("#chat-inputs").html(`
            <div class="input-group">
                <input type="text" id="message-input" class="form-control" placeholder="Escribe un mensaje...">
                <button class="btn btn-primary" id="send-message">Enviar</button>
            </div>
        `);

        $("#send-message").on("click", sendMessage);
    }

    // Enviar un mensaje en el chat activo
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
            const messagesRef = ref(database, `chats/${chatId}/messages`);
            await push(messagesRef, messageData);

            $("#message-input").val("");
        } catch (error) {
            console.error("Error al enviar el mensaje:", error);
            alert("Hubo un problema al enviar tu mensaje.");
        }
    }

    // Configurar el botón para cerrar el chat
    function setupCloseChat(cancellationStatus) {
        $("#close-chat, #close-rejected-chat").on("click", async () => {
            const confirmClose = confirm("¿Estás seguro de que deseas cerrar el chat?");
            if (!confirmClose) return;

            try {
                if (chatRef) {
                    await update(chatRef, { status: cancellationStatus });
                }
                await clearChatState();
                alert("Chat cerrado exitosamente.");
                window.location.href = "index.html";
            } catch (error) {
                console.error("Error al cerrar el chat:", error);
                alert("Hubo un problema al cerrar el chat.");
            }
        });
    }

    // Inicializar el chat
    (async () => {
        await validateChatState();
    })();
}
