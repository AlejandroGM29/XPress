import { auth, database } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { ref, get, onValue, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { handleLogout } from "./auth.js";

$(document).ready(function () {
  const activeSession = JSON.parse(localStorage.getItem("activeSession"));

  if (activeSession) {
    // Monitorear cambios en inChat desde Firebase
    monitorActiveChat(activeSession.uid);

    // Redirigir según el tipo de usuario
    if (activeSession.userType === "usuario") {
      loadPage("user.html");
    } else if (activeSession.userType === "talachero") {
      loadPage("mecanico.html");
    }
  } else {
    // Si no hay sesión activa, cargar la página de inicio
    loadPage("home.html");
    updateNavbarForNoSession();
  }

  // Evento para cerrar sesión
  $(document).on("click", "#logout", async function () {
    await handleLogout();
  });

  // Navegación dinámica desde el navbar
  $(document).on("click", "a[data-page]", function (e) {
    e.preventDefault();
    const page = $(this).data("page");
    if (page) {
      loadPage(page);
    }
  });

  // Ir al chat desde la navbar
  $(document).on("click", "#go-to-chat", function () {
    const activeChat = localStorage.getItem("activeChat");
    if (activeChat) {
      localStorage.setItem("currentChatId", activeChat); // Establecer chat actual
      loadPage("chat.html");
    } else {
      alert("No tienes un chat activo.");
    }
  });
});

// Monitorear la propiedad inChat desde Firebase
function monitorActiveChat(userId) {
  const userRef = ref(database, `users/${userId}/inChat`);
  console.log()
  onValue(userRef, (snapshot) => {
    const activeChat = snapshot.val();
    console.log(activeChat)
    console.log("HOLA PERRO?")
    localStorage.setItem("activeChat", activeChat || ""); // Guardar en localStorage

    const activeSession = JSON.parse(localStorage.getItem("activeSession"));
    if (activeSession) {
      updateNavbar(activeSession.userType, activeSession.name, !!activeChat);
    }
  });
}

// Actualizar el navbar según el tipo de usuario
function updateNavbar(userType, name, hasActiveChat) {
  const chatOption = hasActiveChat
    ? `
      <li class="nav-item">
        <a class="nav-link text-warning" href="#" id="go-to-chat">Ir al Chat</a>
      </li>
    `
    : "";

  const mainLink =
    userType === "usuario"
      ? `<a class="nav-link" href="#" data-page="user.html">Pide un servicio</a>`
      : `<a class="nav-link" href="#" data-page="mecanico.html">Panel de Talachero</a>`;

  $("#session-options").html(`
    <li class="nav-item">
      ${mainLink}
    </li>
    ${chatOption}
    <li class="nav-item dropdown">
      <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
        Mi Cuenta (${name})
      </a>
      <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
        <li><a class="dropdown-item" href="#" id="logout">Cerrar Sesión</a></li>
      </ul>
    </li>
  `);
}

// Actualizar el navbar cuando no hay sesión activa
function updateNavbarForNoSession() {
  $("#session-options").html(`
    <li class="nav-item">
      <a class="nav-link" href="#" data-page="login.html">Iniciar sesión</a>
    </li>
  `);
}

// Cargar dinámicamente las páginas
function loadPage(page) {
  fetch(`pages/${page}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error al cargar la página: ${response.statusText}`);
      }
      return response.text();
    })
    .then((html) => {
      document.getElementById("main-content").innerHTML = html;

      // Ejecutar scripts específicos
      if (page === "user.html") {
        loadUserScript();
      } else if (page === "mecanico.html") {
        loadMecanicoScript();
      } else if (page === "chat.html") {
        loadChatScript();
      }
    })
    .catch((error) => console.error(error));
}

// Cargar el script de usuario dinámicamente
function loadUserScript() {
  import("./user.js")
    .then((module) => {
      if (module.initUserPage) {
        module.initUserPage();
      } else {
        console.error("La función initUserPage no está definida en el módulo user.js");
      }
    })
    .catch((error) => {
      console.error("Error al cargar el módulo user.js:", error);
    });
}

// Cargar el script del talachero/mecánico dinámicamente
function loadMecanicoScript() {
  import("./mecanico.js")
    .then((module) => {
      module.initMecanicoPage();
    })
    .catch((error) => console.error("Error al cargar el módulo mecanico.js:", error));
}

// Cargar el script del chat dinámicamente
function loadChatScript() {
  import("./chat.js")
    .then((module) => {
      if (module.initChatPage) {
        module.initChatPage();
      } else {
        console.error("La función initChatPage no está definida en el módulo chat.js");
      }
    })
    .catch((error) => {
      console.error("Error al cargar el módulo chat.js:", error);
    });
}

// Manejar sesión activa con Firebase
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snapshot = await get(ref(database, `users/${user.uid}`));
    if (snapshot.exists()) {
      const userData = snapshot.val();
      if (!localStorage.getItem("activeSession")) {
        loginUser(userData);
      }
    }
  } else {
    console.log("No hay usuario autenticado.");
    localStorage.removeItem("activeSession");
    updateNavbarForNoSession();
    loadPage("home.html");
  }
});

// Manejar la sesión del usuario
function loginUser(user) {
  const activeChat = localStorage.getItem("activeChat");
  if (!localStorage.getItem("activeSession")) {
    localStorage.setItem("activeSession", JSON.stringify(user));
    alert(`Bienvenido, ${user.name}!`);
  }

  updateNavbar(user.userType, user.name, !!activeChat);
}

// Exponer loadPage globalmente
window.loadPage = loadPage;
