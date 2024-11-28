$(document).ready(function () {
  const activeSession = JSON.parse(localStorage.getItem("activeSession"));

  if (!activeSession || activeSession.userType !== "talachero") {
    alert("Acceso no autorizado.");
    window.location.href = "index.html"; // Redirigir al inicio si no es talachero
    return;
  }

  // Mostrar el nombre del talachero
  $("#talachero-name").text(activeSession.name);

  // Servicios del talachero
  let services = activeSession.services || [];
  const serviceList = $("#service-list");

  // Sincronizar servicios con LocalStorage
  function syncServicesToLocalStorage() {
    const users = JSON.parse(localStorage.getItem("users")) || [];
    const currentUser = users.find((user) => user.email === activeSession.email);

    if (currentUser) {
      currentUser.services = services;
      localStorage.setItem("users", JSON.stringify(users));
    }
  }

  // Renderizar lista de servicios
  function renderServices() {
    serviceList.html("");
    if (services.length === 0) {
      serviceList.html("<p>No tienes servicios registrados.</p>");
      return;
    }
    services.forEach((service, index) => {
      const serviceItem = `
        <div class="card mb-2">
          <div class="card-body">
            <h5>${service.name}</h5>
            <p>${service.description}</p>
            <p><strong>Precio:</strong> $${service.price}</p>
            <button class="btn btn-danger btn-sm remove-service" data-index="${index}">Eliminar</button>
          </div>
        </div>`;
      serviceList.append(serviceItem);
    });
  }

  // Agregar servicio
  $("#add-service").on("click", function () {
    const name = prompt("Nombre del servicio:");
    const description = prompt("Descripción del servicio:");
    const price = prompt("Precio del servicio:");

    if (name && description && price) {
      services.push({ name, description, price });
      activeSession.services = services;
      localStorage.setItem("activeSession", JSON.stringify(activeSession));
      syncServicesToLocalStorage(); // Sincronizar servicios
      renderServices();
    }
  });

  // Eliminar servicio
  $(document).on("click", ".remove-service", function () {
    const index = $(this).data("index");
    services.splice(index, 1);
    activeSession.services = services;
    localStorage.setItem("activeSession", JSON.stringify(activeSession));
    syncServicesToLocalStorage(); // Sincronizar servicios
    renderServices();
  });

  // Manejar solicitudes
  const requests = activeSession.requests || [];
  const requestList = $("#request-list");

  function renderRequests() {
    requestList.html("");
    if (requests.length === 0) {
      requestList.html("<p>No tienes solicitudes pendientes.</p>");
      return;
    }
    requests.forEach((request) => {
      const requestItem = `
        <div class="card mb-2">
          <div class="card-body">
            <h5>${request.user}</h5>
            <p>${request.description}</p>
            <p><strong>Estado:</strong> ${request.status}</p>
          </div>
        </div>`;
      requestList.append(requestItem);
    });
  }

  // Activar/Inactivar estado
  let isActive = true;
  $("#toggle-active").on("click", function () {
    isActive = !isActive;
    $(this).text(isActive ? "Estar Inactivo" : "Estar Activo");
  });

  // Cerrar sesión
  $("#logout").on("click", function () {
    localStorage.removeItem("activeSession");
    window.location.href = "index.html";
  });

  // Inicializar
  renderServices();
  renderRequests();
});
