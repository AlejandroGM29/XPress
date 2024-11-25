$(document).ready(function () {
  // Verificar si hay una sesión activa
  const activeSession = localStorage.getItem("activeSession");

  if (activeSession) {
    // Si hay sesión activa, cargar la página principal del usuario
    loadPage("user.html");
    updateNavbarForSession();
  } else {
    // Si no hay sesión activa, cargar el inicio
    loadPage("home.html");
    updateNavbarForNoSession();
  }

  // Evento para cerrar sesión
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

// Actualizar el navbar cuando hay sesión activa
function updateNavbarForSession() {
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
