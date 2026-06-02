// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from "firebase/firestore";

// Твой конфиг из Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDbWUnP1jjdVGenDJq3MKL9767x5VyQqeA",
  authDomain: "fit-6b3a7.firebaseapp.com",
  projectId: "fit-6b3a7",
  storageBucket: "fit-6b3a7.firebasestorage.app",
  messagingSenderId: "193549143717",
  appId: "1:193549143717:web:84b37c62223b19fe8b074c"
};

// Инициализация
const app = initializeApp(firebaseConfig);

// Экспортируем нужные сервисы, чтобы использовать их в других файлах
export const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn('Persistent cache failed, falling back to memory cache:', e);
  db = initializeFirestore(app, {
    localCache: memoryLocalCache()
  });
}
export { db };