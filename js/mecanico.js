import { database } from "./firebase-config.js";
import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { handleLogout } from "./auth.js"; // Importar la función de logout centralizada

// Inicializar la página del talachero/mecánico
export function initMecanicoPage() {
  const activeSession = JSON.parse(localStorage.getItem("activeSession"));

  if (!activeSession || activeSession.userType !== "talachero") {
    alert("Debes iniciar sesión como talachero.");
    window.location.href = "login.html";
    return;
  }

  // Configurar datos del talachero
  document.getElementById("talachero-name").textContent =
    activeSession.name || "Talachero";

  // Cargar servicios del talachero
  loadServices(activeSession.uid);
  setupAddService(activeSession.uid); // Configurar botón de agregar servicio
  setupToggleActive(activeSession.uid); // Configurar botón de estado activo/inactivo
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

// Configurar el botón de cierre de sesión
function setupLogout() {
  const logoutButton = document.getElementById("logout");

  // Eliminar cualquier evento previo antes de registrar uno nuevo
  const newButton = logoutButton.cloneNode(true);
  logoutButton.replaceWith(newButton);

  newButton.addEventListener("click", async () => {
    await handleLogout(); // Usar la función centralizada de logout
  });
}
