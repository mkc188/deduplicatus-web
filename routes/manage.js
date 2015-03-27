var express = require('express');

module.exports = function(pool) {
    var app  = express.Router();

    // expected: /manage
    app.get('/', function(req, res) {
        res.redirect(303, '/manage/clouds');
    });

    return app;
};
