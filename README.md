# Braina Backend 2025

Serveur Node.js avec MongoDB et WebSocket utilisant une architecture MVC modulaire.

## 🏗️ Structure du Projet

```
braina_backend_2025/
├── src/
│   ├── config/
│   │   ├── db.js              # Configuration MongoDB
│   │   └── websocket.js       # Configuration WebSocket
│   ├── controllers/
│   │   └── user.controller.js # Contrôleur utilisateurs
│   ├── models/
│   │   └── User.model.js      # Modèle utilisateur Mongoose
│   ├── routes/
│   │   ├── index.js           # Routes principales
│   │   └── user.routes.js     # Routes utilisateurs
│   └── server.js              # Point d'entrée de l'application
├── .env.example               # Exemple de configuration
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Installation

1. **Installer les dépendances:**
```bash
npm install
```

2. **Configurer l'environnement:**
```bash
# Copier le fichier .env.example vers .env
copy .env.example .env

# Modifier les valeurs dans .env selon vos besoins
```

3. **Démarrer MongoDB:**
Assurez-vous que MongoDB est installé et en cours d'exécution sur votre machine.

## 📝 Configuration

Créez un fichier `.env` à la racine du projet:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/braina_db
NODE_ENV=development
```

## 🎮 Utilisation

### Mode développement (avec rechargement automatique):
```bash
npm run dev
```

### Mode production:
```bash
npm start
```

## 📡 API Endpoints

### Users (Utilisateurs)

- **GET** `/api/users` - Récupérer tous les utilisateurs
- **GET** `/api/users/:id` - Récupérer un utilisateur par ID
- **POST** `/api/users` - Créer un nouvel utilisateur
- **PUT** `/api/users/:id` - Mettre à jour un utilisateur
- **DELETE** `/api/users/:id` - Supprimer un utilisateur

### Health Check

- **GET** `/api/health` - Vérifier l'état du serveur

### Exemple de requête POST:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 25
}
```

## 🔌 WebSocket

Le serveur WebSocket écoute sur le même port que le serveur HTTP.

**Connexion:**
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Envoyer un message
ws.send(JSON.stringify({ message: 'Hello Server' }));
```

## 🛠️ Technologies Utilisées

- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **MongoDB** - Base de données NoSQL
- **Mongoose** - ODM pour MongoDB
- **ws** - WebSocket library
- **dotenv** - Gestion des variables d'environnement
- **cors** - Cross-Origin Resource Sharing

## 📦 Dépendances

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ws": "^8.16.0",
  "dotenv": "^16.3.1",
  "cors": "^2.8.5"
}
```

## 🔧 Scripts NPM

- `npm start` - Démarrer le serveur en mode production
- `npm run dev` - Démarrer le serveur en mode développement avec nodemon

## 📚 Architecture

Le projet utilise une architecture MVC modulaire avec imports ES6:

- **Models** - Schémas Mongoose et logique métier
- **Controllers** - Logique de traitement des requêtes
- **Routes** - Définition des endpoints API
- **Config** - Configuration de la base de données et WebSocket

## ✨ Fonctionnalités

- ✅ API RESTful
- ✅ WebSocket en temps réel
- ✅ Broadcasting WebSocket lors des opérations CRUD
- ✅ Validation des données avec Mongoose
- ✅ Gestion des erreurs centralisée
- ✅ Imports ES6 modules
- ✅ CORS activé
- ✅ Logging des requêtes

## 🔐 Sécurité

Pour une utilisation en production, pensez à ajouter:

- Authentication/Authorization (JWT)
- Rate limiting
- Helmet.js pour la sécurité HTTP
- Validation des entrées utilisateur
- HTTPS

## 📄 Licence

ISC
