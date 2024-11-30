import { auth, database } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { handleLogout } from "./auth.js"; // Importar la función centralizada de logout

$(document).ready(function () {
  // Verificar si hay una sesión activa en LocalStorage
  const activeSession = JSON.parse(localStorage.getItem("activeSession"));

  if (activeSession) {
    // Redirigir según el tipo de usuario
    if (activeSession.userType === "usuario") {
      loadPage("user.html");
      updateNavbarForUser(activeSession.name);
    } else if (activeSession.userType === "talachero") {
      loadPage("mecanico.html");
      updateNavbarForTalachero(activeSession.name);
    }
  } else {
    // Si no hay sesión activa, cargar la página de inicio
    loadPage("home.html");
    updateNavbarForNoSession();
  }

  // Evento para cerrar sesión desde el navbar
  $(document).on("click", "#logout", async function () {
    await handleLogout(); // Usar la función centralizada de logout
  });

  // Manejar navegación dinámica desde el navbar
  $(document).on("click", "a[data-page]", function (e) {
    e.preventDefault();
    const page = $(this).data("page");
    if (page) {
      loadPage(page);
    }
  });
});

// Actualizar el navbar para usuarios
function updateNavbarForUser(name) {
  $("#session-options").html(`
    <li class="nav-item">
      <a class="nav-link" href="#" data-page="user.html">Pide un servicio</a>
    </li>
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

// Actualizar el navbar para talacheros/mecánicos
function updateNavbarForTalachero(name) {
  $("#session-options").html(`
    <li class="nav-item">
      <a class="nav-link" href="#" data-page="mecanico.html">Panel de Talachero</a>
    </li>
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

// Función para cargar dinámicamente el contenido de las páginas
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

      // Ejecutar scripts específicos si son necesarios
      if (page === "user.html") {
        loadUserScript();
      } else if (page === "mecanico.html") {
        loadMecanicoScript();
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

// Cargar el script de talachero/mecánico dinámicamente
function loadMecanicoScript() {
  import("./mecanico.js")
    .then((module) => {
      module.initMecanicoPage();
    })
    .catch((error) => console.error("Error al cargar el módulo mecanico.js:", error));
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

// Función para manejar la sesión del usuario
function loginUser(user) {
  if (!localStorage.getItem("activeSession")) {
    localStorage.setItem("activeSession", JSON.stringify(user));
    alert(`Bienvenido, ${user.name}!`);
  }

  if (user.userType === "usuario") {
    loadPage("user.html");
    updateNavbarForUser(user.name);
  } else if (user.userType === "talachero") {
    loadPage("mecanico.html");
    updateNavbarForTalachero(user.name);
  }
}
