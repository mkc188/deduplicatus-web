var anyDB   = require('any-db'),
    express = require('express'),
    exphbs  = require('express-handlebars'),
    config  = require('./config.js'),
    csrf    = require('csurf'),
    session = require('express-session'),

    authAPIRouter     = require(__dirname + '/routes/auth.api.js'),
    authMiddleware    = require(__dirname + '/routes/auth.middleware.js'),
    manageRouter      = require(__dirname + '/routes/manage.js'),
    frontEndRouter    = require(__dirname + '/routes/frontend.js'),
    frontEndAPIRouter = require(__dirname + '/routes/frontend.api.js'),
    clientAPIRouter   = require(__dirname + '/routes/client.api.js');

var app = express();
var pool = anyDB.createPool(config.DBURI, {
    min: 2, max: 20
});

// set express-handlebars
app.engine('handlebars', exphbs({
    defaultLayout: 'main'
}));
app.set('view engine', 'handlebars');

// session middleware
app.use(session({
    name: 'session',
    cookie: {
        path: '/',
        httpOnly: true,
        maxAge: 3 * 24 * 60 * 60 * 1000, // in milliseconds
    },
    secret: config.SESSION_SECRET,
    rolling: true,
    resave: false,
    saveUninitialized: false,
}));

// csrf middleware, using express-session
app.use(csrf({ cookie: false }));
app.use(function(err, req, res, next) {
    if(err.code !== 'EBADCSRFTOKEN') return next(err)

    // handle CSRF token errors
    res.status(403).send('Invalid CSRF token').end();
});

// serve static files
app.use('/images', express.static(__dirname + '/public/images'));
app.use('/lib', express.static(__dirname + '/public/javascripts'));
app.use('/css', express.static(__dirname + '/public/stylesheets'));

// serve desktop client requests
app.use('/client', clientAPIRouter(pool));

// serve browser access
app.use('/', frontEndRouter(pool));
app.use('/api', authAPIRouter(pool));  // handle signup, signin and signout requests
app.use('/', authMiddleware(pool));    // the below routes require authorization
app.use('/api', frontEndAPIRouter(pool));
app.use('/manage', manageRouter(pool));

// start listening at specific port
app.listen(config.PORT, function () {
    console.log('listening on: ' + config.PORT);
});
