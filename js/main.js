
// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8fB1guZMUlsBji1jyjNip_PZDleCSfOw",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto.firebaseio.com",
  projectId: "rxpress-68971",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "tu-messaging-sender-id",
  appId: "tu-app-id"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();


$(document).ready(function () {
  // Verificar si hay una sesión activa
  const activeSession = JSON.parse(localStorage.getItem("activeSession"));

  if (activeSession) {
    // Redirigir según el tipo de usuario
    if (activeSession.userType === "usuario") {
      loadPage("user.html");
      updateNavbarForUser();
    } else if (activeSession.userType === "talachero") {
      loadPage("mecanico.html");
      updateNavbarForTalachero();
    }
  } else {
    // Si no hay sesión activa, cargar el inicio
    loadPage("home.html");
    updateNavbarForNoSession();
  }

  // Evento para cerrar sesión desde el navbar
  $(document).on("click", "#logout", function () {
    localStorage.removeItem("activeSession"); // Eliminar sesión
    alert("Has cerrado sesión.");
    location.reload(); // Recargar para reiniciar estado
  });

  // Manejar navegación dinámica desde el navbar
  $(document).on("click", "a[data-page]", function (e) {
    e.preventDefault();
    const page = $(this).data("page");
    loadPage(page);
  });
});

// Actualizar el navbar para usuarios
function updateNavbarForUser() {
  $("#session-options").html(`
    <li class="nav-item">
      <a class="nav-link" href="#" data-page="user.html">Pide un servicio</a>
    </li>
    <li class="nav-item dropdown">
      <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
        Mi Cuenta
      </a>
      <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
        <li><a class="dropdown-item" href="#" id="logout">Cerrar Sesión</a></li>
      </ul>
    </li>
  `);
}

// Actualizar el navbar para talacheros/mecánicos
function updateNavbarForTalachero() {
  $("#session-options").html(`
    <li class="nav-item">
      <a class="nav-link" href="#" data-page="mecanico.html">Panel de Talachero</a>
    </li>
    <li class="nav-item dropdown">
      <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
        Mi Cuenta
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
      <a class="btn btn-primary nav-link" href="#" data-page="login.html">Iniciar sesión</a>
    </li>
  `);
}

// Función para cargar dinámicamente el contenido de las páginas
function loadPage(page) {
  fetch(`pages/${page}`)
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("main-content").innerHTML = html;

      // Ejecutar scripts específicos si son necesarios
      if (page === "user.html") {
        loadUserScript();
      } else if (page === "mecanico.html") {
        loadMecanicoScript();
      }
    })
    .catch((error) => console.error("Error al cargar la página:", error));
}

// Cargar el script de usuario dinámicamente
function loadUserScript() {
  const script = document.createElement("script");
  script.src = "js/user.js";
  document.body.appendChild(script);
}

// Cargar el script de talachero/mecánico dinámicamente
function loadMecanicoScript() {
  const script = document.createElement("script");
  script.src = "js/mecanico.js";
  document.body.appendChild(script);
}
