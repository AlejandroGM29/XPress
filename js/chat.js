import { database } from "./firebase-config.js";
import { ref, get, onValue, set, update, push } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

export function initChatPage() {
  console.log("Inicializando el chat...");

  const activeSession = JSON.parse(localStorage.getItem("activeSession"));
  let chatId = localStorage.getItem("activeChat");
  const chatContainer = $("#chat-messages");

  if (!activeSession) {
    alert("No se pudo cargar el chat. Por favor, intenta nuevamente.");
    window.location.href = "index.html";
    return;
  }

  let chatRef = chatId ? ref(database, `chats/${chatId}`) : null;
  const userRef = ref(database, `users/${activeSession.uid}`);
  let chatStatus = null;
  let autoCloseTimeout = null;

  /**
   * Renderizar el contenido del chat según el estado.
   */
  function renderChat(status) {
    $("#chat-inputs").empty();
    chatStatus = status;

    if (status === "waiting") {
      $("#chat-inputs").html(`
        <p class="text-center text-muted">Esperando respuesta del talachero...</p>
        <button class="btn btn-danger mt-3" id="close-chat">Cerrar Chat</button>
      `);
      setupCloseChat("cancelled_by_user");
    } else if (status === "rejected") {
      $("#chat-inputs").html(`
        <p class="text-center text-danger">El talachero rechazó la solicitud. Este chat se cerrará automáticamente en 5 minutos.</p>
        <button class="btn btn-danger mt-3" id="close-chat">Cerrar Chat Ahora</button>
      `);
      setupCloseChat("cancelled_by_talachero");
      setupAutoClose();
    } else if (!status || status === "open") {
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
          <label for="problem-photo">Sube una foto del problema:</label>
          <input type="file" id="problem-photo" class="form-control" accept="image/*">
          <img id="problem-photo-preview" src="" alt="Previsualización" style="display:none; max-width: 200px; margin-top:10px;">
          <div class="mt-3 d-flex justify-content-between">
            <button class="btn btn-secondary" id="prev-step-3">Regresar</button>
            <button class="btn btn-primary" id="send-problem">Enviar</button>
          </div>
        </div>
      `);

      setupInputsFlow();
      loadServices();
    }
  }

  /**
   * Configurar el flujo de inputs.
   */
  function setupInputsFlow() {
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

    $("#send-problem").on("click", sendProblem);
  }

  /**
   * Configurar cierre del chat.
   */
  function setupCloseChat(cancellationStatus) {
    $("#close-chat").on("click", async () => {
      const confirmClose = confirm("¿Estás seguro de que deseas cerrar el chat?");
      if (!confirmClose) return;

      try {
        if (chatRef) {
          await update(chatRef, { status: cancellationStatus });
        }
        await set(ref(database, `users/${activeSession.uid}/inChat`), null);
        localStorage.removeItem("activeChat");
        alert("Chat cerrado exitosamente.");
        window.location.href = "index.html";
      } catch (error) {
        console.error("Error al cerrar el chat:", error);
        alert("Hubo un problema al cerrar el chat.");
      }
    });
  }

  /**
   * Cargar servicios del talachero.
   */
  async function loadServices() {
    const talacheroId = localStorage.getItem("currentTalacheroId");
    if (!talacheroId) return;

    try {
      const talacheroSnapshot = await get(ref(database, `users/${talacheroId}`));
      if (talacheroSnapshot.exists()) {
        const services = talacheroSnapshot.val().services || [];
        const serviceSelect = $("#service-selection");
        services.forEach((service) => {
          serviceSelect.append(
            `<option value="${service.name}">${service.name} - $${service.price}</option>`
          );
        });
      }
    } catch (error) {
      console.error("Error al cargar servicios:", error);
    }
  }

  /**
   * Enviar problema.
   */
  async function sendProblem() {
    const serviceName = $("#service-selection").val();
    const description = $("#problem-description").val();
    const file = $("#problem-photo")[0].files[0];

    if (!file) {
      alert("Por favor, sube una foto del problema.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "unsigned_upload");

    try {
      const uploadResponse = await fetch(
        "https://api.cloudinary.com/v1_1/dpydmw8qo/image/upload",
        { method: "POST", body: formData }
      );

      const result = await uploadResponse.json();
      if (!result.secure_url) {
        throw new Error("No se pudo obtener la URL de la imagen.");
      }

      const photoUrl = result.secure_url;
      const talacheroId = localStorage.getItem("currentTalacheroId");

      // Crear un nuevo chat en la base de datos
      const newChatRef = push(ref(database, `chats`));
      chatId = newChatRef.key;

      const newChatData = {
        sender: activeSession.uid,
        talacheroId,
        serviceName,
        description,
        photo: photoUrl,
        status: "waiting",
        timestamp: Date.now(),
      };

      await set(newChatRef, newChatData);
      await set(ref(database, `users/${activeSession.uid}/inChat`), chatId);

      // Guardar el chatId en localStorage
      localStorage.setItem("activeChat", chatId);
      chatRef = chatId ? ref(database, `chats/${chatId}`) : null;
      listenForChanges();
      renderChat("waiting");
      alert("Solicitud enviada. Esperando respuesta.");
    } catch (error) {
      console.error("Error al enviar problema:", error);
      alert("Hubo un problema al enviar tu solicitud.");
    }
  }

  /**
   * Renderizar mensajes en el chat.
   */
  function renderMessages(messages) {
    chatContainer.html("");
    messages.forEach((message) => {
      const isUserMessage = message.sender === activeSession.uid;

      const messageHtml = `
        <div class="message ${isUserMessage ? "user-message" : "talachero-message"}">
          <h6>${message.serviceName || "Servicio"}</h6>
          <p>${message.description}</p>
          ${
            message.photo
              ? `<img src="${message.photo}" alt="Problema" style="max-width: 300px;">`
              : ""
          }
          <small>${new Date(message.timestamp).toLocaleString()}</small>
        </div>
      `;

      chatContainer.append(messageHtml);
    });
  }

  /**
   * Escuchar cambios en el chat.
   */
  function listenForChanges() {
    console.log("HOLA?");
    console.log(chatRef)
    console.log("TEST")
    if (!chatRef) {
        renderChat("open");
        return;
    }

    onValue(chatRef, (snapshot) => {
        console.log(snapshot)
      if (snapshot.exists()) {
        const chatData = snapshot.val();
        renderChat(chatData.status);

        const messages = [chatData];
        renderMessages(messages);
      } else {
        console.log("HOLA?")
        renderChat("open");
      }
    });
  }

  // Inicializar la página del chat
  listenForChanges();
}
