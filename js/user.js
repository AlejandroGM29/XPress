$(document).ready(function () {
    let talacheros = []; // Almacén de talacheros
  
    // Obtener imágenes desde una API o usar una predeterminada
    async function fetchImage() {
      try {
        const response = await fetch("https://randomuser.me/api/");
        const data = await response.json();
        return data.results[0].picture.large;
      } catch (error) {
        console.error("Error al obtener la imagen:", error);
        return "img/default.jpg"; // Imagen predeterminada
      }
    }
  
    // Cargar talacheros desde el archivo JSON
    async function loadTalacheros() {
      try {
        const response = await fetch("helpers/talacheros.json");
        talacheros = await response.json();
  
        // Asignar imágenes dinámicas si no tienen una asignada
        for (let talachero of talacheros) {
          talachero.imagen = talachero.imagen || (await fetchImage());
        }
  
        renderTalacheros(talacheros);
      } catch (error) {
        console.error("Error al cargar talacheros:", error);
      }
    }
  
    // Renderizar el listado de talacheros
    function renderTalacheros(talacherosList) {
      const container = $("#talacheros-list");
      const detailsContainer = $("#talachero-details");
  
      container.html("").show(); // Limpiar y mostrar el contenedor
      detailsContainer.hide(); // Ocultar los detalles
  
      talacherosList.forEach((talachero, index) => {
        const card = $(`
          <div class="talachero-card" style="display: none;">
            <div class="card-talachero card-wide" data-id="${talachero.id}">
              <img src="${talachero.imagen}" alt="${talachero.nombre}" class="talachero-img">
              <div class="card-talachero-body">
                <h5>${talachero.nombre}</h5>
                <p><strong>Puntuación:</strong> ${talachero.puntuacion} ⭐ (${talachero.resenas} reseñas)</p>
                <p><strong>Contacto:</strong> ${talachero.contacto.telefono} | ${talachero.contacto.correo}</p>
              </div>
            </div>
          </div>
        `);
  
        container.append(card);
  
        // Animación de slide para cada tarjeta, una por una
        setTimeout(() => {
          card.show("slide", { direction: "right" }, 300);
        }, index * 150); // Tiempo entre cada tarjeta
      });
    }
  
    // Mostrar detalles del talachero seleccionado
    function viewTalacheroDetails(talacheroId) {
      const talachero = talacheros.find((t) => t.id === talacheroId);
      if (!talachero) return;
  
      const detailsContainer = $("#talachero-details");
      const talacherosContainer = $("#talacheros-list");
  
      talacherosContainer.hide("slide", { direction: "left" }, 500); // Ocultar listado con animación
  
      detailsContainer.html(`
        <button id="back-to-list" class="btn btn-secondary mb-3">Volver</button>
        <div class="card-talachero-detail card-wide">
          <img src="${talachero.imagen}" alt="${talachero.nombre}" class="talachero-detail-img">
          <div class="talachero-detail-body">
            <h5>${talachero.nombre}</h5>
            <p><strong>Puntuación:</strong> ${talachero.puntuacion} ⭐ (${talachero.resenas} reseñas)</p>
            <p><strong>Contacto:</strong> ${talachero.contacto.telefono} | ${talachero.contacto.correo}</p>
          </div>
        </div>
        <div id="services-list" class="mt-3">
          <h6>Servicios:</h6>
          ${talachero.trabajos
            .map(
              (trabajo, index) => `
            <div class="card-servicio" style="display: none;" data-index="${index}">
              <div class="servicio-info">
                <h6>${trabajo.nombre}</h6>
                <p>${trabajo.descripcion}</p>
              </div>
              <div class="servicio-precio">$${trabajo.precio}</div>
            </div>
          `
            )
            .join("")}
        </div>
      `);
  
      detailsContainer.show("slide", { direction: "right" }, 500); // Mostrar detalles con animación
  
      // Animación para servicios uno por uno
      talachero.trabajos.forEach((_, index) => {
        setTimeout(() => {
          $(`.card-servicio[data-index="${index}"]`).slideDown("slow");
        }, index * 150); // Tiempo entre cada tarjeta
      });
    }
  
    // Evento para manejar el clic en un talachero
    $(document).on("click", ".card-talachero", function () {
      const talacheroId = $(this).data("id");
      viewTalacheroDetails(talacheroId);
    });
  
    // Evento para volver al listado
    $(document).on("click", "#back-to-list", function () {
      const detailsContainer = $("#talachero-details");
      const talacherosContainer = $("#talacheros-list");
  
      detailsContainer.hide("slide", { direction: "right" }, 500); // Ocultar detalles con animación
      talacherosContainer.show("slide", { direction: "left" }, 500); // Mostrar listado con animación
    });
  
    // Cargar los talacheros al iniciar
    loadTalacheros();
  });
  