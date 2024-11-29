import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC8fB1guZMUlsBji1jyjNip_PZDleCSfOw",
  authDomain: "rxpress-68971.firebaseapp.com",
  databaseURL: "https://rxpress-68971-default-rtdb.firebaseio.com",
  projectId: "rxpress-68971",
  storageBucket: "rxpress-68971.appspot.com",
  messagingSenderId: "909643513444",
  appId: "1:909643513444:web:4c32c66cdb52abf2f1e971",
  measurementId: "G-F4XXC69DJV"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

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

  if (!userType || !userSubtype) {
    alert("Por favor selecciona un tipo y subtipo de usuario.");
    return;
  }

  try {
    // Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Guardar datos adicionales en Firebase Realtime Database
    await set(ref(database, `users/${userId}`), {
      name,
      phone,
      email,
      userType,
      userSubtype,
      ine,
      photo: "",
      services: [],
      rating: 0,
      reviews: 0
    });

    alert("Cuenta creada con éxito.");
    loginUser(userCredential.user); // Inicia sesión automáticamente
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
    // Iniciar sesión en Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Obtener datos del usuario desde Firebase Realtime Database
    const snapshot = await get(ref(database, `users/${userId}`));
    if (snapshot.exists()) {
      const userData = snapshot.val();
      loginUser(userData); // Manejar sesión del usuario
    } else {
      throw new Error("No se encontraron datos del usuario.");
    }
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    alert("Error al iniciar sesión: " + error.message);
  }
});

// Función para manejar la sesión del usuario
function loginUser(user) {
  localStorage.setItem("activeSession", JSON.stringify(user));
  alert(`Bienvenido, ${user.name}!`);

  // Redirigir según el tipo de usuario
  if (user.userType === "usuario") {
    updateNavbarForUser();
    window.location.href = "user.html"; // Redirigir a la página del usuario
  } else if (user.userType === "talachero") {
    updateNavbarForTalachero();
    window.location.href = "mecanico.html"; // Redirigir a la página del talachero
  }
}

// Manejar sesión activa
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Usuario autenticado, cargar datos
    const snapshot = await get(ref(database, `users/${user.uid}`));
    if (snapshot.exists()) {
      const userData = snapshot.val();
      loginUser(userData);
    }
  } else {
    console.log("No hay usuario autenticado.");
  }
});
