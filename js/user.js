// Firebase imports
import { database } from "./firebase-config.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

export function initUserPage() {
  console.log("Inicializando la página del usuario...");

  // Variables globales
  let talacheros = [];
  let selectedType = "";
  const activeSession = JSON.parse(localStorage.getItem("activeSession")); // Obtener la sesión activa

  if (!activeSession) {
    console.error("No hay sesión activa. Redirigiendo...");
    return;
  }

  // Cargar Talacheros/Mecánicos desde Firebase
  async function loadTalacheros() {
    try {
      const talacherosRef = ref(database, "users");
      const snapshot = await get(talacherosRef);

      if (snapshot.exists()) {
        talacheros = Object.values(snapshot.val()).filter(
          (user) => user.userType === "talachero" && user.isActive !== false // Solo activos
        );

        // Calcular las calificaciones basadas en los chats del usuario
        await calculateRatingsForTalacheros();

        renderTalacheros(selectedType);
        console.log("Talacheros cargados:", talacheros);
      } else {
        console.log("No se encontraron talacheros en Firebase.");
        renderTalacheros([]);
      }
    } catch (error) {
      console.error("Error al cargar talacheros:", error);
    }
  }

  /**
   * Calcular el promedio de calificaciones y el número de reseñas para cada Talachero/Mecánico
   */
  async function calculateRatingsForTalacheros() {
    try {
      // Referencia a todos los chats
      const chatsRef = ref(database, "chats");
      const chatsSnapshot = await get(chatsRef);

      if (chatsSnapshot.exists()) {
        const allChats = Object.values(chatsSnapshot.val());

        // Para cada Talachero, encontrar los chats donde participó y calcular el promedio de calificaciones
        talacheros = talacheros.map((talachero) => {
          // Filtrar chats donde el talachero actual es el proveedor de servicios
          const talacheroChats = allChats.filter(
            (chat) =>
              chat.talacheroId === talachero.uid &&
              typeof chat.rating === "number"
          );

          const reviewCount = talacheroChats.length;
          const totalRating = talacheroChats.reduce(
            (sum, chat) => sum + chat.rating,
            0
          );
          const averageRating =
            reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : "N/A";

          return {
            ...talachero,
            averageRating, // Promedio de calificaciones
            reviewCount,   // Número de reseñas
          };
        });
      } else {
        // No hay chats
        talacheros = talacheros.map((talachero) => ({
          ...talachero,
          averageRating: "N/A",
          reviewCount: 0,
        }));
      }
    } catch (error) {
      console.error("Error al calcular calificaciones:", error);
      // En caso de error, asignar valores por defecto
      talacheros = talacheros.map((talachero) => ({
        ...talachero,
        averageRating: "N/A",
        reviewCount: 0,
      }));
    }
  }

  // Mostrar lista de Talacheros/Mecánicos
  function renderTalacheros(type) {
    const filtered = talacheros.filter((t) => t.userSubtype === type);
    const container = $("#talacheros-list");

    const sectionTitle =
      type === "talachero" ? "Talacheros Disponibles" : "Mecánicos Disponibles";
    $("#section-title").text(sectionTitle);

    container.html("");
    $("#list-section").hide();
    $("#user-choice").hide("slide", { direction: "left" }, 500, function () {
      $("#list-section").fadeIn(300);
    });

    setTimeout(() => {
      filtered.forEach((talachero, index) => {
        const servicesHtml = (talachero.services || [])
          .map((service) => `<li>${service.name}</li>`)
          .join("");

        // **MODIFICACIÓN**: Añadir el precio por kilómetro
        const tarifaKm = talachero.tarifaKm
          ? `$${parseFloat(talachero.tarifaKm).toFixed(2)}/km`
          : "N/A";

        // **MODIFICACIÓN**: Mostrar averageRating y reviewCount
        const averageRating = talachero.averageRating || "N/A";
        const reviewCount = talachero.reviewCount || 0;

        const listItem = `
        <div class="list-item d-flex align-items-center" data-id="${
          talachero.uid
        }" style="display: none;">
          <img src="${
            talachero.photo || "./img/team/person.png"
          }" class="list-img me-3" alt="${talachero.name}">
          <div class="list-content">
            <p><strong>${talachero.name}</strong> ${averageRating} ⭐ (${reviewCount} reseñas)</p>
            <p><strong>Precio por Kilómetro:</strong> ${tarifaKm}</p> <!-- Precio por km añadido -->
            <ul class="services-list mb-2">
              ${servicesHtml}
            </ul>
          </div>
        </div>`;
        container.append(listItem);
      });

      const items = container.find(".list-item");
      items.each((index, item) => {
        setTimeout(() => {
          $(item).show("slide", { direction: "right" }, 300);
        }, index * 150);
      });
    }, 300);
  }

  // Mostrar detalles del Talachero/Mecánico
  async function viewTalacheroDetails(uid) {
    const talachero = talacheros.find((t) => t.uid === uid);
    if (!talachero) return;

    const profileContainer = $("#talachero-profile");
    const servicesContainer = $("#services-list");

    $("#back-to-list").show();
    $("#back-to-choice").hide();
    $("#profile-title").text(`Perfil de ${talachero.name}`);

    try {
      const servicesRef = ref(database, `users/${uid}/services`);
      const snapshot = await get(servicesRef);

      if (snapshot.exists()) {
        talachero.services = Object.values(snapshot.val());
      } else {
        talachero.services = [];
      }
    } catch (error) {
      console.error("Error al cargar servicios del talachero:", error);
      talachero.services = [];
    }

    $("#talacheros-list").hide(
      "slide",
      { direction: "left" },
      500,
      function () {
        profileContainer.html(`
        <div class="list-item d-flex align-items-center">
          <img src="${
            talachero.photo || "./img/team/person.png"
          }" class="list-img" alt="${talachero.name}">
          <div class="list-content ms-3">
            <h5>${talachero.name}</h5>
            <p><strong>Contacto:</strong> ${talachero.phone} | ${
          talachero.email
        }</p>
            <p><strong>Precio por Kilómetro:</strong> ${
              talachero.tarifaKm
                ? `$${parseFloat(talachero.tarifaKm).toFixed(2)}/km`
                : "N/A"
            }</p> <!-- Precio por km añadido -->
            <p><strong>Calificación:</strong> ${talachero.averageRating} ⭐ (${talachero.reviewCount} reseñas)</p> <!-- Calificación añadida -->
          </div>
        </div>
      `);

        servicesContainer.html(
          (talachero.services || [])
            .map(
              (service, index) => `
          <div class="list-item d-flex justify-content-between align-items-center service-item" data-id="${index}">
            <div>
              <h6>${service.name}</h6>
              <p>${service.description}</p>
            </div>
            <strong>$${service.price}</strong>
          </div>`
            )
            .join("")
        );

        $("#talachero-details").show("slide", { direction: "right" }, 500);
      }
    );

    localStorage.setItem("currentTalacheroId", uid);
  }

  // Evento: Selección de servicio
  $(document).on("click", ".service-item", function () {
    const serviceId = $(this).data("id");
    const talacheroId = localStorage.getItem("currentTalacheroId");

    if (!talacheroId) {
      alert("Ocurrió un error. Por favor, intenta de nuevo.");
      return;
    }

    showConfirmModal(serviceId, talacheroId);
  });

  // Mostrar modal de confirmación
  function showConfirmModal(serviceId, talacheroId) {
    const modalHtml = `
      <div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmModalLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="confirmModalLabel">Confirmar</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              ¿Estás seguro de que deseas iniciar un chat para este servicio?
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="confirmChat">Confirmar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    $("body").append(modalHtml);
    $("#confirmModal").modal("show");

    $("#confirmChat").on("click", async function () {
      localStorage.setItem("selectedServiceId", serviceId);
      console.log(talacheroId);
      /* localStorage.setItem("activeChat", talacheroId); */

      /* const userRef = ref(database, `users/${activeSession.uid}/inChat`);
      await set(userRef, talacheroId); */

      $("#confirmModal").modal("hide");
      $("#confirmModal").remove();

      loadPage("chat.html");
    });
  }

  $("#reload-talacheros").on("click", () => {
    loadTalacheros();
  });

  $(document).on("click", ".select-type", function () {
    selectedType = $(this).data("type");
    loadTalacheros();
  });

  $(document).on("click", ".list-item", function () {
    const uid = $(this).data("id");
    viewTalacheroDetails(uid);
  });

  $(document).on("click", "#back-to-list", function () {
    $("#talachero-details").hide(
      "slide",
      { direction: "right" },
      500,
      function () {
        $("#talacheros-list").show("slide", { direction: "left" }, 500);
        $("#back-to-choice").show();
      }
    );
  });

  $(document).on("click", "#back-to-choice", function () {
    $("#list-section").hide("slide", { direction: "right" }, 500, function () {
      $("#user-choice").show("slide", { direction: "left" }, 500);
      $("#talacheros-list").html("");
    });
  });

  /**
   * Verificar el estado del chat activo del usuario
   */
  async function checkChatStatus() {
    const userRef = ref(database, `users/${activeSession.uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const userData = snapshot.val();
      console.log(userData);
      console.log(userData.inChat);
      if (userData.inChat) {
        console.log("carga aqui?");
        // Si hay un chat activo, redirigir al usuario al chat
        alert("Tienes un chat activo. Redirigiéndote...");
        localStorage.setItem("activeChat", userData.inChat);
        loadPage("chat.html");
      } else {
        // Si no hay un chat activo, limpiar la información residual
        localStorage.removeItem("activeChat");
        localStorage.removeItem("currentTalacheroId");
        localStorage.removeItem("selectedServiceId");

        // Si hay elementos de la interfaz que dependían del chat, limpiarlos
        $("#chat-related-section").hide(); // Oculta cualquier sección relacionada con el chat
        $("#talacheros-list").html(""); // Limpia la lista de talacheros
      }
    }
  }

  // Verificar antes de iniciar un nuevo chat
  checkChatStatus();
  /* loadTalacheros(); */ // Cargar talacheros iniciales
}
