// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8fB1guZMUlsBji1jyjNip_PZDleCSfOw",
  authDomain: "rxpress-68971.firebaseapp.com",
  databaseURL: "https://rxpress-68971-default-rtdb.firebaseio.com",
  projectId: "rxpress-68971",
  storageBucket: "rxpress-68971.appspot.com",
  messagingSenderId: "909643513444",
  appId: "1:909643513444:web:4c32c66cdb52abf2f1e971",
  measurementId: "G-F4XXC69DJV",
};

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
