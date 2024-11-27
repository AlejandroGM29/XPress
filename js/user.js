$(document).ready(function () {
  let talacheros = [];
  let selectedType = "";

  // Cargar Talacheros/Mecánicos
  async function loadTalacheros() {
    try {
      const response = await fetch("helpers/talacheros.json");
      talacheros = await response.json();
    } catch (error) {
      console.error("Error al cargar los datos:", error);
    }
  }

  // Mostrar lista de Talacheros/Mecánicos con animación
  function renderTalacheros(type) {
    const filtered = talacheros.filter((t) => t.tipo === type).reverse(); // Orden inverso
    const container = $("#talacheros-list");

    // Actualizar el título dinámico
    const sectionTitle = type === "Talachero/Vulca" ? "Talacheros Disponibles" : "Mecánicos Disponibles";
    $("#section-title").text(sectionTitle);

    // Limpiar lista y mostrar el contenedor de la lista
    container.html("");
    $("#list-section").hide(); // Ocultar temporalmente para reiniciar la animación
    $("#user-choice").hide("slide", { direction: "left" }, 500, function () {
      $("#list-section").fadeIn(300); // Mostrar sección después de la animación
    });

    setTimeout(() => {
      // Generar todas las tarjetas ocultas
      filtered.forEach((talachero) => {
        const listItem = `
          <div class="list-item d-flex align-items-center" data-id="${talachero.id}" style="display: none;">
            <img src="${talachero.imagen || './img/team/person.png'}" class="list-img" alt="${talachero.nombre}">
            <div class="list-content ms-3">
              <h5>${talachero.nombre}</h5>
              <p><strong>Puntuación:</strong> ${talachero.puntuacion} ⭐ (${talachero.resenas} reseñas)</p>
              <p>${talachero.servicios.join(", ")}</p>
            </div>
          </div>`;
        container.append(listItem);
      });

      // Aplicar animación `slide` a cada tarjeta secuencialmente
      const items = container.find(".list-item");
      items.each((index, item) => {
        setTimeout(() => {
          $(item).show("slide", { direction: "right" }, 300);
        }, index * 150); // Retraso entre cada tarjeta
      });
    }, 300); // Retraso para asegurar que el contenedor está visible
  }

  // Mostrar detalles del Talachero/Mecánico
  function viewTalacheroDetails(id) {
    const talachero = talacheros.find((t) => t.id === id);
    if (!talachero) return;

    const profileContainer = $("#talachero-profile");
    const servicesContainer = $("#services-list");

    // Configurar botones de navegación y título del perfil
    $("#back-to-list").show(); // Mostrar botón para volver a lista
    $("#back-to-choice").hide(); // Ocultar botón para volver a elección
    $("#profile-title").text(`Perfil de ${talachero.nombre}`);

    $("#talacheros-list").hide("slide", { direction: "left" }, 500, function () {
      // Cargar perfil del talachero después de ocultar la lista
      profileContainer.html(`
        <div class="list-item d-flex align-items-center">
          <img src="${talachero.imagen || './img/team/person.png'}" class="list-img" alt="${talachero.nombre}">
          <div class="list-content ms-3">
            <h5>${talachero.nombre}</h5>
            <p><strong>Contacto:</strong> ${talachero.contacto.telefono} | ${talachero.contacto.correo}</p>
          </div>
        </div>
      `);

      // Servicios del Talachero
      servicesContainer.html(
        talachero.trabajos
          .map(
            (trabajo) => `
          <div class="list-item d-flex justify-content-between align-items-center">
            <div>
              <h6>${trabajo.nombre}</h6>
              <p>${trabajo.descripcion}</p>
            </div>
            <strong>$${trabajo.precio}</strong>
          </div>`
          )
          .join("")
      );

      $("#talachero-details").show("slide", { direction: "right" }, 500); // Mostrar perfil
    });
  }

  // Evento para seleccionar tipo de servicio (Talachero/Mecánico)
  $(document).on("click", ".select-type", function () {
    selectedType = $(this).data("type");
    renderTalacheros(selectedType);
  });

  // Evento para mostrar detalles del Talachero/Mecánico
  $(document).on("click", ".list-item", function () {
    const id = $(this).data("id");
    viewTalacheroDetails(id);
  });

  // Evento para regresar a la lista de Talacheros/Mecánicos
  $(document).on("click", "#back-to-list", function () {
    $("#talachero-details").hide("slide", { direction: "right" }, 500, function () {
      $("#talacheros-list").show("slide", { direction: "left" }, 500);
      $("#back-to-choice").show(); // Aseguramos que el botón de volver a elección reaparece
    });
  });

  // Evento para regresar a la selección de tipo de servicio
  $(document).on("click", "#back-to-choice", function () {
    $("#list-section").hide("slide", { direction: "right" }, 500, function () {
      $("#user-choice").show("slide", { direction: "left" }, 500);
      $("#talacheros-list").html(""); // Limpiar lista para evitar duplicados
    });
  });

  // Inicializar datos
  loadTalacheros();
});
