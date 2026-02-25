// CONFIGURAÇÃO DO FIREBASE PARA OITIVASPRO
const firebaseConfig = {

  apiKey: "AIzaSyB-Wd8wlddqJa22HCjGLL519OewMiyBeJw",

  authDomain: "controle-oitivas.firebaseapp.com",

  databaseURL: "https://controle-oitivas-default-rtdb.firebaseio.com",

  projectId: "controle-oitivas",

  storageBucket: "controle-oitivas.firebasestorage.app",

  messagingSenderId: "954316081856",

  appId: "1:954316081856:web:13397af9a093207d84fb25"

};



// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais
const db = firebase.database();
const auth = firebase.auth();

// Variável para armazenar o identificador da unidade (email)
let currentUnit = null;

// Função para gerar um ID seguro a partir do email
function getUnitIdFromEmail(email) {
    if (!email) return null;
    // Remove caracteres especiais e substitui . por _
    return email.toLowerCase()
                .replace(/[@.]/g, '_') // substitui @ e . por _
                .replace(/[^a-z0-9_]/g, ''); // remove caracteres especiais
}

// Função para obter referência dos dados da unidade atual
function getUnitRef(path = '') {
    if (!currentUnit) {
        console.error('Nenhuma unidade selecionada');
        // Retorna uma referência nula (não vai salvar em lugar nenhum)
        return { 
            once: () => Promise.resolve({ exists: () => false, val: () => null }),
            on: () => {},
            off: () => {},
            push: () => { console.warn('Tentativa de salvar sem unidade'); return null; },
            update: () => Promise.reject('Sem unidade'),
            remove: () => Promise.reject('Sem unidade')
        };
    }
    // Cada unidade tem seus dados separados por pasta com o nome do email (formatado)
    return db.ref(`unidades/${currentUnit}${path ? '/' + path : ''}`);
}