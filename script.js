console.log('Parse está inicializando...');
Parse.initialize("ApzEnU76CQaGr7gu5JWKiW7o55lO1pgRA485bQ3sX", "QeHXfXzNi0uM1q719fFXtUbmFEUiK1uS71AoUDP5");
Parse.serverURL = 'https://parseapi.back4app.com/';
console.log('Parse inicializado!');

// Função para login
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();
    console.log('Formulário submetido!'); // Verifica se o submit está sendo capturado

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log('Usuário: ' + username); // Depuração
    console.log('Senha: ' + password); // Depuração

    // Função de login do Parse
    Parse.User.logIn(username, password).then(function(user) {
        console.log('Login bem-sucedido!'); // Depuração
        window.location.href = 'home.html'; // Redireciona para a página principal
    }).catch(function(error) {
        console.error('Erro no login: ', error.message); // Depuração
        document.getElementById('error-message').style.display = 'block';
    });
});
