const express = require('express');
const { Server: HttpServer } = require('http');
const { Server: SocketServer } = require('socket.io');

const SQLClient = require('./db/clients/sql.clients');
const dbConfig = require('./db/db.config');
const envConfig = require('./config');
const initialProducts = require('./db/assets/initialProducts');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const {
  createMessagesTable,
  createProductsTable,
} = require('./db/utils/createTables');

const app = express();
const httpServer = new HttpServer(app);
const io = new SocketServer(httpServer);
const PORT = 8080 || process.env.PORT;
const productsDB = new SQLClient(dbConfig.sqlite, 'products');
const messagesDB = new SQLClient(dbConfig.sqlite, 'messages');

(async () => {
  try {
    await createProductsTable(dbConfig.sqlite);
    await createMessagesTable(dbConfig.sqlite);
    const products = await productsDB.getAll();
    if (products.length === 0) {
      await productsDB.save(initialProducts);
    }
  } catch (error) {
    console.log(error);
  }
})();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));
app.use(
  session({
    name: 'user-session',
    secret: envConfig.SESSION_SECRET,
    maxAge: 1000,
    rolling: true,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: `mongodb+srv://maurocig:${envConfig.DB_PASSWORD}@coderxx.fm0gxl1.mongodb.net/?retryWrites=true&w=majority`,
      dbName: 'sessions',
    }),
  })
);

// Listen
httpServer.listen(PORT, () => {
  console.log('Server running on port', PORT);
});

// Socket events
io.on('connection', async (socket) => {
  console.log('nuevo cliente conectado');
  console.log(socket.id);

  const messages = await messagesDB.getAll();
  socket.emit('messages', messages);

  const products = await productsDB.getAll();
  socket.emit('products', products);

  socket.on('new-message', async (data) => {
    await messagesDB.save(data);
    const updatedMessages = await messagesDB.getAll();
    io.emit('messages', updatedMessages);
  });

  socket.on('new-product', async (data) => {
    await productsDB.save(data);
    const updatedProducts = await productsDB.getAll();
    io.emit('products', updatedProducts);
  });
});

// Routes
app.get('/home', async (req, res) => {
  res.render('index.html');
});

app.get('/login', async (req, res) => {
  res.sendFile('login.html', { root: 'public' });
});

app.post('/login', async (req, res) => {
  const { username } = req.body;
  res.send(`bienvenido ${username}`);
});
