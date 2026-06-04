import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDbWUnP1jjdVGenDJq3MKL9767x5VyQqeA",
  authDomain: "fit-6b3a7.firebaseapp.com",
  projectId: "fit-6b3a7",
  storageBucket: "fit-6b3a7.firebasestorage.app",
  messagingSenderId: "193549143717",
  appId: "1:193549143717:web:84b37c62223b19fe8b074c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    console.log("Fetching admins...");
    const adminsSnap = await getDocs(collection(db, 'admins'));
    console.log("Admins:");
    adminsSnap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });

    console.log("\nFetching employees...");
    const employeesSnap = await getDocs(collection(db, 'employees'));
    console.log("Employees:");
    employeesSnap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
  process.exit(0);
}
run();
