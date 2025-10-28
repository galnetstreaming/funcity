// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDRzaSRtHJB6pQPxqWFoymGtcv0m4T9aqg",
  authDomain: "funcitycafekids.firebaseapp.com",
  projectId: "funcitycafekids",
  storageBucket: "funcitycafekids.firebasestorage.app",
  messagingSenderId: "116468941447",
  appId: "1:116468941447:web:0842ac7c32bf92ef3aae22"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Inicializar el servicio de autenticación


export { auth }; // Exportar el servicio de autenticación