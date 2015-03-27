var express = require('express');

module.exports = function(pool) {
    var app  = express.Router();

    // expected: /
    app.get('/', function(req, res) {
        res.render('index', {
            _csrf: req.csrfToken(),
            _user: req.session.user,
            title: 'Home',
            uiScripts: []
        });
    });

    // expected: /signup
    app.get('/signup', function(req, res) {
        if( typeof req.session.authenticated != "undefined" && req.session.authenticated ) {
            res.redirect(307, '/');

        } else {
            res.render('signup', {
                _csrf: req.csrfToken(),
                title: 'Signup',
                uiScripts: ['ui.signup.js']
            });
        }
    });

    // expected: /signout
    app.get('/signout', function(req, res) {
        // redirect to auth.api.js
        res.redirect(303, '/api/signout');
    });

    // expected: /download-client-osx
    app.get('/download-client-osx', function(req, res) {
        res.send('Not yet ready. :(').end();
    });

    return app;
};
