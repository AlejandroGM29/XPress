$(document).ready(function () {
  let talacheros = [];
  let selectedType = "";

  // Cargar Talacheros/Mecánicos desde LocalStorage y helper
  async function loadTalacheros() {
    try {
      // Obtener usuarios de LocalStorage
      const users = getUsersFromLocalStorage();
      // Filtrar solo los talacheros y mecánicos
      const localTalacheros = users.filter(
        (user) => user.userType === "talachero"
      );
      // Obtener datos del helper
      const response = await fetch("helpers/talacheros.json");
      const helperTalacheros = await response.json();

      // Combinar ambas fuentes
      talacheros = [...localTalacheros, ...helperTalacheros];
    } catch (error) {
      console.error("Error al cargar los datos:", error);
    }
  }

  // Obtener usuarios de LocalStorage
  function getUsersFromLocalStorage() {
    const users = localStorage.getItem("users");
    return users ? JSON.parse(users) : [];
  }

  // Mostrar lista de Talacheros/Mecánicos
  function renderTalacheros(type) {
    const filtered = talacheros.filter(
      (t) => t.userSubtype === type && t.userType
    );
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
        <div class="list-item d-flex align-items-center" data-id="${talachero.email}" style="display: none;">
          <img src="${
            talachero.photo || "./img/team/person.png"
          }" class="list-img me-3" alt="${talachero.name}">
          <div class="list-content">
            <p><strong>${talachero.name}</strong> ${talachero.rating || "N/A"} ⭐ (${talachero.reviews || 0} reseñas)</p>
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
  function viewTalacheroDetails(email) {
    const talachero = talacheros.find((t) => t.email === email);
    if (!talachero) return;

    const profileContainer = $("#talachero-profile");
    const servicesContainer = $("#services-list");

    $("#back-to-list").show();
    $("#back-to-choice").hide();
    $("#profile-title").text(`Perfil de ${talachero.name}`);

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

  $(document).on("click", ".select-type", function () {
    selectedType = $(this).data("type");
    renderTalacheros(selectedType);
  });

  $(document).on("click", ".list-item", function () {
    const email = $(this).data("id");
    viewTalacheroDetails(email);
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

  loadTalacheros();
});
