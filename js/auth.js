import { auth, database } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { get, ref, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Bandera para evitar alertas repetidas en onAuthStateChanged
let sessionInitialized = false;

// Manejar el flip entre Login y Crear Cuenta
$(document).on("click", ".toggle-form", function () {
  $(".form-flip-container").toggleClass("flipped");
  adjustFormHeight();
});

// Ajustar la altura del contenedor dinámicamente
function adjustFormHeight() {
  const $activeForm = $(".form-flip-container .form-box:visible");
  if ($activeForm.length) {
    $(".form-flip-container").css("height", $activeForm.outerHeight());
  }
}

// Ajustar la altura al cargar la página
$(document).ready(function () {
  $(".form-flip-container").removeClass("flipped");
  adjustFormHeight();
});

// Manejar el cambio de Tipo de Usuario
$(document).on("change", "#user-type", function () {
  const userType = $(this).val();
  const $subtypeFields = $("#user-subtype-fields");
  const $ineField = $("#talachero-ine");

  $subtypeFields.hide();
  $("#user-subtype").html(`<option value="">Selecciona...</option>`);
  $ineField.val("").attr("readonly", true);

  if (userType === "usuario") {
    $subtypeFields.show();
    $("#user-subtype").html(`
      <option value="">Selecciona...</option>
      <option value="camionero">Camionero</option>
      <option value="ordinario">Ordinario</option>
    `);
  } else if (userType === "talachero") {
    $subtypeFields.show();
    $("#user-subtype").html(`
      <option value="">Selecciona...</option>
      <option value="talachero">Talachero/Vulca</option>
      <option value="mecanico">Mecánico</option>
    `);
    $ineField.attr("readonly", false);
  }

  adjustFormHeight();
});

// Manejar el envío del formulario de registro
$(document).on("submit", "#register-form", async function (event) {
  event.preventDefault();

  const name = $("#register-name").val();
  const phone = $("#register-phone").val();
  const email = $("#register-email").val();
  const password = $("#register-password").val();
  const userType = $("#user-type").val();
  const userSubtype = $("#user-subtype").val();
  const ine = userType === "talachero" ? $("#talachero-ine").val() : null;
  const photoInput = document.getElementById("register-photo").files[0];

  if (!userType || !userSubtype) {
    alert("Por favor selecciona un tipo y subtipo de usuario.");
    return;
  }

  let photoUrl = ""; // Enlace de la foto subida

  try {
    // Si hay una foto, subirla a Cloudinary
    if (photoInput) {
      const formData = new FormData();
      formData.append("file", photoInput);
      formData.append("upload_preset", "unsigned_upload"); // Reemplaza con tu upload preset
      formData.append("cloud_name", "dpydmw8qo"); // Reemplaza con tu cloud name

      const response = await fetch("https://api.cloudinary.com/v1_1/dpydmw8qo/image/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.secure_url) {
        photoUrl = result.secure_url; // Guardar el enlace de la foto
      } else {
        throw new Error("Error al subir la imagen.");
      }
    }

    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid; // Obtener el UID

    // Crear el objeto del usuario con UID y URL de la foto
    const userData = {
      name,
      phone,
      email,
      userType,
      userSubtype,
      ine,
      photo: photoUrl || "", // Si no hay foto, queda vacío
      services: [],
      rating: 0,
      reviews: 0,
      uid: userId, // Guardar UID como campo en la base de datos
    };

    // Guardar el usuario en Firebase Realtime Database
    await set(ref(database, `users/${userId}`), userData);

    alert("Cuenta creada con éxito.");
    loginUser(userData); // Pasar el objeto completo con UID para localStorage
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    alert("Error al registrar usuario: " + error.message);
  }
});

// Manejar el envío del formulario de inicio de sesión
$(document).on("submit", "#login-form", async function (event) {
  event.preventDefault();

  const email = $("#login-email").val();
  const password = $("#login-password").val();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid; // Obtener el UID

    // Consultar los datos del usuario desde la base de datos
    const snapshot = await get(ref(database, `users/${userId}`));
    if (snapshot.exists()) {
      const userData = snapshot.val();
      loginUser(userData); // Pasar el objeto completo con UID incluido
    } else {
      throw new Error("No se encontraron datos del usuario.");
    }
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    alert("Error al iniciar sesión: " + error.message);
  }
});

// Manejar sesión activa desde Firebase
onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!sessionInitialized) {
      sessionInitialized = true;
      const snapshot = await get(ref(database, `users/${user.uid}`));
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (!localStorage.getItem("activeSession")) {
          loginUser(userData);
        }
      }
    }
  } else {
    if (sessionInitialized) {
      sessionInitialized = false;
      console.log("No hay usuario autenticado.");
      localStorage.removeItem("activeSession");
    }
  }
});

// Función para manejar la sesión del usuario
function loginUser(user) {
  if (!localStorage.getItem("activeSession")) {
    localStorage.setItem("activeSession", JSON.stringify(user)); // Guardar el objeto con UID incluido
    alert(`Bienvenido, ${user.name}!`);
  }

  // Redirigir según el tipo de usuario
  if (user.userType === "usuario") {
    window.location.href = "index.html"; // Página principal para usuarios
  } else if (user.userType === "talachero") {
    window.location.href = "index.html"; // Página principal para talacheros
  }
}

// Exportar la función centralizada de logout
export async function handleLogout() {
  try {
    await signOut(auth);
    localStorage.removeItem("activeSession");
    alert("Has cerrado sesión.");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert("Error al cerrar sesión.");
  }
}
