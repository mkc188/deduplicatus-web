var begin = require('any-db-transaction'),
    crypto = require('crypto'),
    bodyParser = require('body-parser'),
    express = require('express'),
    expressValidator = require('express-validator'),
    fs = require('fs-extra'),
    level = require('level'),
    uuid = require('node-uuid');

module.exports = function(pool, config) {
    var app  = express.Router();

    app.use(bodyParser.urlencoded({extended:true}));
    // this line must be immediately after express.bodyParser()!
    app.use(expressValidator({
        errorFormatter: function(param, msg, value) {
            var namespace = param.split('.')
              , root      = namespace.shift()
              , formParam = root;

            while(namespace.length) {
                formParam += '[' + namespace.shift() + ']';
            }
            return msg;
        }
    }));

    var inputPattern = {
        password: /^.{8,}$/
    };

    // --------------------------------------------------
    //                    Manage Clouds
    //
    //

    // --------------------------------------------------
    //                    Manage Account
    //
    //

    // expected: /api/edit_password
    app.post('/edit_password', function(req, res) {
        // run input validations
        req.checkBody('password', 'Current Password')
            .notEmpty()
            .matches(inputPattern.password);
        req.checkBody('newPassword', 'New Password')
            .notEmpty()
            .matches(inputPattern.password);

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors ) {
            return res.status(400).send(errors).end();
        }

        var userid = req.session.uid;

        var changePassword = function() {
            var salt = crypto.randomBytes(32).toString('base64');
            var saltedPassword = crypto.createHmac('sha256', salt);
                saltedPassword.update(req.body.newPassword);

            pool.query('UPDATE users SET salt = ?, password = ? WHERE userid = ?',
                [salt, saltedPassword.digest('base64'), userid],
                function(error, result) {
                    if( error || result.affectedRows === 0 ) {
                        return res.status(500).send('Database Error').end();
                    }

                    req.session.destroy();
                    return res.status(200).end();
                }
            );
        }

        // check is the password correct
        pool.query('SELECT * FROM users WHERE userid = ? LIMIT 1',
            [userid],
            function(error, result) {
                if( error ) {
                    return res.status(500).send('Database Error').end();
                }

                if( result.rowCount > 0 ) {
                    var salt = result.rows[0].salt;
                    var hmac = crypto.createHmac('sha256', salt);

                    hmac.update(req.body.password);
                    if( hmac.digest('base64') == result.rows[0].password ) {
                        // verified password, start changing password
                        changePassword();

                    } else {
                        // password is wrong
                        return res.status(401).send('Incorrect current password').end();
                    }

                } else {
                    // shouldn't reach here, no account found?
                    return res.status(500).send('Database Error').end();
                }
            }
        );
    });

    // expected: /api/delete_account
    app.post('/delete_account', function(req, res) {
        // run input validations
        req.checkBody('password', 'Current Password')
            .notEmpty()
            .matches(inputPattern.password);

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors ) {
            return res.status(400).send(errors).end();
        }

        var userid = req.session.uid;

        var deleteProcess = function() {
            var tx = begin(pool);
            // remove all user's data in server-side database
            // 1. table metafile_versions
            tx.query('DELETE FROM metafile_versions WHERE userid = ?',
                [userid],
                function(error, result) {
                    if( error ) {
                        tx.rollback();
                        return res.status(500).send('Database Error').end();
                    }

                    // 2. table metafile_locks
                    tx.query('DELETE FROM metafile_locks WHERE userid = ?',
                        [userid],
                        function(error, result) {
                            if( error ) {
                                tx.rollback();
                                return res.status(500).send('Database Error').end();
                            }

                            // 3. table users
                            tx.query('DELETE FROM users WHERE userid = ?',
                                [userid],
                                function(error, result) {
                                    if( error ) {
                                        tx.rollback();
                                        return res.status(500).send('Database Error').end();
                                    }

                                    // then, delete leveldb database in user's data directory
                                    var userPath = config.USER_DATA + "/" + userid;
                                    fs.removeSync(userPath);

                                    // commit changes to database
                                    tx.commit();

                                    // done, destroy current session and return HTTP 200
                                    req.session.destroy();
                                    return res.status(200).end();
                                }
                            );
                        }
                    );
                }
            );
        }

        // check is the password correct
        pool.query('SELECT * FROM users WHERE userid = ? LIMIT 1',
            [userid],
            function(error, result) {
                if( error ) {
                    return res.status(500).send('Database Error').end();
                }

                if( result.rowCount > 0 ) {
                    var salt = result.rows[0].salt;
                    var hmac = crypto.createHmac('sha256', salt);

                    hmac.update(req.body.password);
                    if( hmac.digest('base64') == result.rows[0].password ) {
                        // verified password, start delete process
                        deleteProcess();

                    } else {
                        // password is wrong, won't delete anything
                        return res.status(401).send('Incorrect current password').end();
                    }

                } else {
                    // shouldn't reach here, no account found?
                    return res.status(500).send('Database Error').end();
                }
            }
        );
    });
    
    return app;
};
