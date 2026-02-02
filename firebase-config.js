// CONFIGURAÇÃO DO FIREBASE PARA OITIVASPRO
// Substitua pelos seus dados do Firebase
const firebaseConfig = {

  apiKey: "AIzaSyAvtBvVv3iLh_UodLYkIcCdjm8X0FKtFz8",

  authDomain: "witnesses-oitivas.firebaseapp.com",

  projectId: "witnesses-oitivas",

  storageBucket: "witnesses-oitivas.firebasestorage.app",

  messagingSenderId: "976838399282",

  appId: "1:976838399282:web:aa648e9e250c27c64a332b"

};


// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais
const db = firebase.database();
const auth = firebase.auth();

// Configuração multi-tenant
let currentTenant = null;
let tenants = [];

// Função para obter referência do tenant atual
function getTenantRef(path = '') {
    if (!currentTenant && currentTenant !== 'admin') {
        console.error('Nenhum tenant selecionado');
        return null;
    }
    return db.ref(`tenants/${currentTenant}${path ? '/' + path : ''}`);
}