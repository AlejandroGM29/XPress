$(document).ready(function () {
  // Verificar si hay una sesión activa
  const activeSession = localStorage.getItem("activeSession");
  loadPage('home.html')
  if (activeSession) {
    // Si hay una sesión activa, mostrar "Mi Cuenta" y "Cerrar Sesión"
    $("#session-options").html(`
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle btn btn-info" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          Mi Cuenta
        </a>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
          <li><a class="dropdown-item" href="#">Mi Perfil</a></li>
          <li><a class="dropdown-item" href="#" id="logout">Cerrar Sesión</a></li>
        </ul>
      </li>
    `);
  } else {
    // Si no hay sesión activa, mostrar "Iniciar Sesión" y "Crear Cuenta"
    $("#session-options").html(`
      <li class="nav-item">
        <a class="btn btn-primary nav-link" href="#" data-page="login.html">Iniciar sesión</a>
      </li>
      <li class="nav-item">
        <a class="btn btn-secondary nav-link" href="#" data-page="register.html">Crear cuenta</a>
      </li>
    `);
  }

  // Evento para cerrar sesión
  $(document).on("click", "#logout", function () {
    localStorage.removeItem("activeSession"); // Eliminar la sesión activa
    alert("Has cerrado sesión.");
    location.reload(); // Recargar la página para actualizar el estado del navbar
  });

  // Manejar la carga dinámica de páginas
  $("a[data-page]").on("click", function (e) {
    e.preventDefault();
    const page = $(this).data("page");
    loadPage(page);
  });
});

// Función para cargar dinámicamente el contenido de las páginas
function loadPage(page) {
  fetch(`pages/${page}`)
    .then((response) => response.text())
    .then((html) => {
      $("#main-content").html(html);
    })
    .catch((error) => console.error("Error al cargar la página:", error));
}
