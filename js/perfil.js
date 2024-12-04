// scripts/perfil.js

import { auth, database } from "./firebase-config.js";
import {
  get,
  ref,
  set,
  update,
  push,
  remove,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

/**
 * Inicializar la página de perfil
 */
export function initPerfilPage() {
  console.log("Inicializando la página de perfil...");

  const activeSession = JSON.parse(localStorage.getItem("activeSession"));

  if (!activeSession) {
    console.error("No hay sesión activa. Redirigiendo...");
    loadPage("login.html");
    return;
  }

  // Cargar la información del perfil
  loadProfileInfo(activeSession.uid);

  // Manejar el envío del formulario de actualización de perfil
  $(document).on("submit", "#update-profile-form", function (event) {
    event.preventDefault();
    updateProfile(activeSession.uid);
  });

  // Manejar el envío del formulario para añadir una tarjeta
  $(document).on("submit", "#add-card-form", function (event) {
    event.preventDefault();
    addBankCard(activeSession.uid);
  });

  // Cargar las tarjetas existentes
  loadBankCards(activeSession.uid);
}

/**
 * Cargar la información del perfil desde Firebase
 * @param {string} uid - UID del usuario
 */
async function loadProfileInfo(uid) {
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const userData = snapshot.val();

      // Rellenar los campos del formulario
      $("#profile-name").val(userData.name || "");
      $("#profile-phone").val(userData.phone || "");
      $("#profile-email").val(userData.email || "");
      // La contraseña y la foto no se rellenan por seguridad y facilidad

      // Mostrar la foto actual si existe
      if (userData.photo) {
        const photoHtml = `
          <div class="mb-3">
            <img src="${userData.photo}" alt="Foto de Perfil" class="img-thumbnail" style="max-width: 200px;">
          </div>
        `;
        $("#profile-photo").before(photoHtml);
      }
    } else {
      console.error("No se encontraron datos del usuario.");
    }
  } catch (error) {
    console.error("Error al cargar la información del perfil:", error);
    alert("Hubo un problema al cargar tu perfil.");
  }
}

/**
 * Actualizar la información del perfil en Firebase
 * @param {string} uid - UID del usuario
 */
async function updateProfile(uid) {
  const name = $("#profile-name").val().trim();
  const phone = $("#profile-phone").val().trim();
  const email = $("#profile-email").val().trim(); // Aunque está en readonly, lo incluimos por si hay cambios
  const password = $("#profile-password").val().trim();
  const photoInput = document.getElementById("profile-photo").files[0];

  let photoUrl = ""; // Enlace de la foto subida

  try {
    // Validaciones básicas
    if (!name || !phone || !email) {
      alert("Por favor, completa todos los campos obligatorios.");
      return;
    }

    // Si hay una foto, subirla a Cloudinary
    if (photoInput) {
      const formData = new FormData();
      formData.append("file", photoInput);
      formData.append("upload_preset", "unsigned_upload"); // Reemplaza con tu upload preset
      formData.append("cloud_name", "dpydmw8qo"); // Reemplaza con tu cloud name

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dpydmw8qo/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (result.secure_url) {
        photoUrl = result.secure_url; // Guardar el enlace de la foto
      } else {
        throw new Error("Error al subir la imagen.");
      }
    }

    // Actualizar los datos en Firebase Realtime Database
    const updates = {
      name,
      phone,
      email, // Si decides permitir cambiar el email, necesitarás también actualizar en Firebase Auth
    };

    if (photoUrl) {
      updates.photo = photoUrl;
    }

    await update(ref(database, `users/${uid}`), updates);

    // Actualizar la contraseña si se proporcionó
    if (password) {
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      if (user) {
        await updatePassword(user, password);
      }
    }

    // Actualizar el objeto en localStorage
    const updatedSession = JSON.parse(localStorage.getItem("activeSession"));
    localStorage.setItem("activeSession", JSON.stringify({ ...updatedSession, ...updates }));

    alert("Perfil actualizado con éxito.");

    // Recargar la página para reflejar los cambios
    location.reload();
  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    alert("Hubo un problema al actualizar tu perfil: " + error.message);
  }
}

/**
 * Añadir una nueva tarjeta bancaria a Firebase
 * @param {string} uid - UID del usuario
 */
async function addBankCard(uid) {
  const cardNumber = $("#card-number").val().trim();
  const cardExpiry = $("#card-expiry").val();
  const cardCvv = $("#card-cvv").val().trim();

  // Validaciones básicas
  if (!cardNumber || !cardExpiry || !cardCvv) {
    alert("Por favor, completa todos los campos de la tarjeta.");
    return;
  }

  // Validar formato de número de tarjeta (simplificado)
  const cardNumberPattern = /^\d{4} \d{4} \d{4} \d{4}$/;
  if (!cardNumberPattern.test(cardNumber)) {
    alert("Por favor, ingresa un número de tarjeta válido (formato: 1234 5678 9012 3456).");
    return;
  }

  // Validar CVV
  const cvvPattern = /^\d{3,4}$/;
  if (!cvvPattern.test(cardCvv)) {
    alert("Por favor, ingresa un CVV válido (3 o 4 dígitos).");
    return;
  }

  // Crear el objeto de la tarjeta
  const cardData = {
    number: cardNumber,
    expiry: cardExpiry,
    cvv: cardCvv,
    addedAt: Date.now(),
  };

  try {
    // Añadir la tarjeta a Firebase Realtime Database bajo `users/{uid}/cards`
    const cardsRef = ref(database, `users/${uid}/cards`);
    const newCardRef = push(cardsRef);
    await set(newCardRef, cardData);

    alert("Tarjeta añadida con éxito.");

    // Limpiar el formulario
    $("#add-card-form")[0].reset();

    // Recargar la lista de tarjetas
    loadBankCards(uid);
  } catch (error) {
    console.error("Error al añadir la tarjeta:", error);
    alert("Hubo un problema al añadir tu tarjeta: " + error.message);
  }
}

/**
 * Cargar y mostrar las tarjetas bancarias del usuario
 * @param {string} uid - UID del usuario
 */
async function loadBankCards(uid) {
  try {
    const cardsRef = ref(database, `users/${uid}/cards`);
    const snapshot = await get(cardsRef);

    const cardsList = $("#cards-list");
    cardsList.html(""); // Limpiar la lista

    if (snapshot.exists()) {
      const cards = snapshot.val();

      Object.keys(cards).forEach((cardId) => {
        const card = cards[cardId];
        const maskedNumber = maskCardNumber(card.number);

        const cardItem = `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <p class="mb-1"><strong>${getCardBrand(card.number)}</strong> **** **** **** ${maskedNumber}</p>
              <p class="mb-1"><strong>Expiración:</strong> ${card.expiry}</p>
            </div>
            <button class="btn btn-danger btn-sm remove-card-button" data-id="${cardId}">Eliminar</button>
          </li>
        `;
        cardsList.append(cardItem);
      });
    } else {
      cardsList.html("<li class='list-group-item'>No tienes tarjetas añadidas.</li>");
    }
  } catch (error) {
    console.error("Error al cargar las tarjetas:", error);
    alert("Hubo un problema al cargar tus tarjetas.");
  }
}

/**
 * Enmascarar el número de tarjeta dejando solo los últimos 4 dígitos
 * @param {string} number - Número de la tarjeta
 * @returns {string} Número enmascarado
 */
function maskCardNumber(number) {
  const parts = number.split(" ");
  if (parts.length !== 4) return number;
  return parts[3];
}

/**
 * Obtener la marca de la tarjeta basado en el número (simplificado)
 * @param {string} number - Número de la tarjeta
 * @returns {string} Marca de la tarjeta
 */
function getCardBrand(number) {
  const firstDigit = number[0];
  switch (firstDigit) {
    case "4":
      return "Visa";
    case "5":
      return "MasterCard";
    case "3":
      return "American Express";
    case "6":
      return "Discover";
    default:
      return "Desconocida";
  }
}

/**
 * Manejar la eliminación de una tarjeta bancaria
 */
$(document).on("click", ".remove-card-button", async function () {
  const cardId = $(this).data("id");
  const uid = JSON.parse(localStorage.getItem("activeSession")).uid;

  if (confirm("¿Estás seguro de que deseas eliminar esta tarjeta?")) {
    try {
      const cardRef = ref(database, `users/${uid}/cards/${cardId}`);
      await remove(cardRef);
      alert("Tarjeta eliminada con éxito.");
      loadBankCards(uid);
    } catch (error) {
      console.error("Error al eliminar la tarjeta:", error);
      alert("Hubo un problema al eliminar la tarjeta.");
    }
  }
});
