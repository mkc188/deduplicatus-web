var express = require('express');

module.exports = function(pool, config) {
    var app  = express.Router();

    // expected: /manage
    app.get('/', function(req, res) {
        res.redirect(303, '/manage/clouds');
    });

    // expected: /manage/clouds
    app.get('/clouds', function(req, res) {
        res.render('clouds', {
            _csrf: req.csrfToken(),
            _user: req.session.user,
            title: 'Manage Clouds',
            uiScripts: ['ui.clouds.js']
        });
    });

    // expected: /manage/clouds/reload
    app.get('/clouds/reload', function(req, res) {
        res.redirect(302, '/manage/clouds');
    });

    // expected: /manage/account
    app.get('/account', function(req, res) {
        res.render('account', {
            _csrf: req.csrfToken(),
            _user: req.session.user,
            title: 'Manage Account',
            uiScripts: ['ui.account.js']
        });
    });

    return app;
};
