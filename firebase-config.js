// Firebase 설정
// Firebase Console에서 프로젝트 생성 후 아래 값들을 교체하세요
// https://console.firebase.google.com/

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 설정이 완료되었는지 확인
const isFirebaseConfigured = FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";
