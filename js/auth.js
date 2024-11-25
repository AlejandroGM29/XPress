// Manejar el flip entre Login y Crear Cuenta
$(document).on("click", ".toggle-form", function () {
  $(".form-flip-container").toggleClass("flipped");
  adjustFormHeight(); // Ajustar la altura después del flip
});

// Ajustar la altura del contenedor dinámicamente
function adjustFormHeight() {
  const $activeForm = $(".form-flip-container .form-box:visible");
  $(".form-flip-container").css("height", $activeForm.outerHeight());
}

// Ajustar la altura al cargar la página
$(document).ready(function () {
  adjustFormHeight(); // Ajustar la altura inicial
});

// Manejar el cambio de Tipo de Usuario
$(document).on("change", "#user-type", function () {
  const userType = $(this).val();
  const $subtypeFields = $("#user-subtype-fields");
  const $ineField = $("#talachero-ine");

  // Limpiar subtipos y campos dinámicos
  $subtypeFields.hide();
  $("#user-subtype").html(`<option value="">Selecciona...</option>`);
  $ineField.val("").attr("readonly", true); // INE siempre readonly inicialmente

  if (userType === "usuario") {
    // Actualizar subtipo para Usuario
    $subtypeFields.show();
    $("#user-subtype").html(`
      <option value="">Selecciona...</option>
      <option value="camionero">Camionero</option>
      <option value="ordinario">Ordinario</option>
    `);
  } else if (userType === "talachero") {
    // Actualizar subtipo para Talachero
    $subtypeFields.show();
    $("#user-subtype").html(`
      <option value="">Selecciona...</option>
      <option value="talachero-vulca">Talachero/Vulca</option>
      <option value="mecanico">Mecánico</option>
    `);
    $ineField.attr("readonly", false); // Activar INE
  }

  adjustFormHeight(); // Ajustar la altura después de cambiar el tipo de usuario
});

// Manejar el envío del formulario de registro
$(document).on("submit", "#register-form", function (event) {
  event.preventDefault();

  const name = $("#register-name").val();
  const email = $("#register-email").val();
  const password = $("#register-password").val();
  const userType = $("#user-type").val();
  const userSubtype = $("#user-subtype").val();
  const ine = $("#talachero-ine").val();

  if (!userType || !userSubtype) {
    alert("Por favor selecciona un tipo y subtipo de usuario.");
    return;
  }

  const users = getUsers();

  if (users.some((user) => user.email === email)) {
    alert("Este correo ya está registrado.");
    return;
  }

  const newUser = { name, email, password, userType, userSubtype, ine };
  users.push(newUser);
  saveUsers(users);

  alert("Cuenta creada con éxito.");
  loginUser(newUser); // Inicia sesión automáticamente
});

// Manejar el envío del formulario de inicio de sesión
$(document).on("submit", "#login-form", function (event) {
  event.preventDefault();

  const email = $("#login-email").val();
  const password = $("#login-password").val();

  const users = getUsers();
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    alert("Usuario o contraseña incorrectos.");
    return;
  }

  loginUser(user); // Inicia sesión
});

// Función para iniciar sesión y redirigir
function loginUser(user) {
  localStorage.setItem("activeSession", JSON.stringify(user));
  alert(`Bienvenido, ${user.name}!`);
  location.href = "index.html"; // Redirigir al inicio
}

// Funciones auxiliares para localStorage
function getUsers() {
  const users = localStorage.getItem("users");
  return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}
