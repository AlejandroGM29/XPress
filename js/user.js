// Firebase imports
import { database } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

export function initUserPage() {
  console.log("Inicializando la página del usuario...");

  // Variables globales
  let talacheros = [];
  let selectedType = ""; // Inicializado vacío para evitar problemas

  // Cargar Talacheros/Mecánicos desde Firebase
  async function loadTalacheros() {
    try {
      if (!selectedType) {
        console.log("No se ha seleccionado un tipo de usuario.");
        return; // No cargar nada si no se selecciona un tipo
      }

      // Reiniciar el arreglo global para evitar duplicados
      talacheros = [];

      const talacherosRef = ref(database, "users");
      const snapshot = await get(talacherosRef);

      if (snapshot.exists()) {
        talacheros = Object.values(snapshot.val()).filter(
          (user) => user.userType === "talachero" && user.isActive !== false
        );

        renderTalacheros(selectedType);
        console.log("Talacheros cargados:", talacheros);
      } else {
        console.log("No se encontraron talacheros en Firebase.");
        renderTalacheros([]); // Renderizar una lista vacía
      }
    } catch (error) {
      console.error("Error al cargar talacheros:", error);
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

        const listItem = `
        <div class="list-item d-flex align-items-center" data-id="${talachero.uid}" style="display: none;">
          <img src="${
            talachero.photo || "./img/team/person.png"
          }" class="list-img me-3" alt="${talachero.name}">
          <div class="list-content">
            <p><strong>${talachero.name}</strong> ${talachero.rating || "N/A"} ⭐ (${
          talachero.reviews || 0
        } reseñas)</p>
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

    // Ocultar el botón de recargar talacheros
    $("#reload-talacheros").hide();

    $("#back-to-list").show();
    $("#back-to-choice").hide();
    $("#profile-title").text(`Perfil de ${talachero.name}`);

    try {
      // Recargar los servicios más recientes desde Firebase
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
            <p><strong>Contacto:</strong> ${talachero.phone} | ${talachero.email}</p>
          </div>
        </div>
      `);

        servicesContainer.html(
          (talachero.services || [])
            .map(
              (service) => `
          <div class="list-item d-flex justify-content-between align-items-center">
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
  }

  $(document).on("click", "#back-to-list", async function () {
    // Ocultar el perfil y recargar talacheros al volver a la lista
    $("#talachero-details").hide(
      "slide",
      { direction: "right" },
      500,
      async function () {
        $("#reload-talacheros").show(); // Mostrar botón de recarga
        $("#talacheros-list").show("slide", { direction: "left" }, 500);
        $("#back-to-choice").show();
        await loadTalacheros(); // Recargar la lista de talacheros
      }
    );
  });

  // Configurar botón para recargar talacheros
  $("#reload-talacheros").on("click", () => {
    loadTalacheros();
  });

  // Eventos de interacción
  $(document).on("click", ".select-type", function () {
    selectedType = $(this).data("type"); // Asignar el tipo seleccionado
    loadTalacheros(); // Cargar y renderizar al seleccionar tipo
  });

  $(document).on("click", ".list-item", function () {
    const uid = $(this).data("id");
    viewTalacheroDetails(uid);
  });

  $(document).on("click", "#back-to-choice", function () {
    $("#list-section").hide("slide", { direction: "right" }, 500, function () {
      $("#user-choice").show("slide", { direction: "left" }, 500);
      $("#talacheros-list").html("");
    });
    selectedType = ""; // Restablecer el tipo al volver al menú principal
  });

  // Inicializar sin cargar talacheros automáticamente
  console.log("Esperando selección de tipo...");
}
