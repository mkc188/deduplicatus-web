var express = require('express');

module.exports = function(pool) {
    var app  = express.Router();

    /*
     * middleware to validate the authentication token
     */
    app.use('/', function(req, res) {
        if( req.session && req.session.authenticated ) {
            req.next();
        } else {
            if( req.xhr ) {
                return res.status(401).send('Not Authenticated').end();
            } else {
                res.redirect(307, '/');
            }
        }
    });

    return app;
};
