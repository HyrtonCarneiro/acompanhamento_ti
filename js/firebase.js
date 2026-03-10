// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCCseCGga6bcujJS_kdsiD52mr3GUjP8lE",
    authDomain: "acompanhamento-ti.firebaseapp.com",
    projectId: "acompanhamento-ti",
    storageBucket: "acompanhamento-ti.firebasestorage.app",
    messagingSenderId: "791239998085",
    appId: "1:791239998085:web:308ba5164aea8102be47ec",
    measurementId: "G-W8L9PJDR1F"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot, query, where, orderBy };