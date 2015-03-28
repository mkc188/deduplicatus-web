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
        password: /^.{8,}$/,
        storageMode: /^(file\-manager|deduplication)$/
    };

    // expected: /api/signup
    app.post('/signup', function(req, res) {
        // run input validations
        req.checkBody('email', 'Email')
            .isEmail();
        req.checkBody('password', 'Password')
            .notEmpty()
            .matches(inputPattern.password);
        req.checkBody('storageMode', 'Storage Mode')
            .notEmpty()
            .matches(inputPattern.storageMode);

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors ) {
            return res.status(400).send(errors).end();
        }

        var userid = uuid.v4();
        var email = req.body.email;
        var salt = crypto.randomBytes(32).toString('base64');
        var saltedPassword = crypto.createHmac('sha256', salt);
            saltedPassword.update(req.body.password);
        var metaSecret = uuid.v4();
        var metaInitVersion = uuid.v4();

        var tx = begin(pool);
        // create user record with the newly created leveldb
        tx.query('INSERT INTO users (userid, email, password, salt, meta_secret, meta_version) VALUES (?, ?, ?, ?, ?, ?)',
            [userid, email, saltedPassword.digest('base64'), salt, metaSecret, metaInitVersion],
            function(error, result) {
                if( error ) {
                    if( error.errno == 1062 ) {
                        // #1062 - Duplicate entry for key 'email'
                        var errors = 'Email Already Registered';
                    } else {
                        var errors = 'Database Error';
                    }

                    tx.rollback();
                    return res.status(400).send(errors).end();
                }

                // create empty leveldb in user's data directory
                var userPath = config.USER_DATA + "/" + userid;
                var leveldbPath = userPath + "/" + metaInitVersion;
                fs.mkdirSync(userPath);
                fs.mkdirSync(leveldbPath);

                var db = level(leveldbPath);

                // initial leveldb with user's information
                db.batch([
                    { type: 'put', key: 'metafile::userid', value: userid },
                    { type: 'put', key: 'metafile::secret', value: metaSecret },
                    { type: 'put', key: 'metafile::version', value: metaInitVersion },
                    { type: 'put', key: 'metafile::finalized', value: 0 },
                    { type: 'put', key: 'clouds::count', value: 0 },
                    { type: 'put', key: 'clouds::storageMode', value: req.body.storageMode }
                ], function(err) {
                    if( err ) {
                        tx.rollback();
                        return res.status(400).send("LevelDB Error").end();
                    }
                });

                // record file after leveldb handler is closed
                db.close(function(err) {
                    if( err ) {
                        tx.rollback();
                        return res.status(400).send("LevelDB Error").end();
                    }

                    // record the current version into database
                    tx.query('INSERT INTO metafile_versions (versionid, userid, time, completed) VALUES (?, ?, ?, ?)',
                        [metaInitVersion, userid, Math.floor(new Date() / 1000), 1],
                        function(error, result) {
                            if( error ) {
                                tx.rollback();
                                return res.status(400).send('Database Error').end();
                            }

                            // commit changes to database
                            tx.commit();

                            // user is now signed in to his/her new account
                            req.session.regenerate(function() {
                                // set authenticated information
                                req.session.authenticated = true;
                                req.session.uid = userid;
                                req.session.user = email;

                                // return success message to client
                                return res.status(200).json(true).end();
                            });
                        }
                    );
                });
            }
        );
    });

    // expected: /api/signin
    app.post('/signin', function(req, res) {
        // run input validations
        req.checkBody('email')
            .isEmail();
        req.checkBody('password')
            .notEmpty();

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors ) {
            return res.status(401).end();
        }

        pool.query('SELECT * FROM users WHERE email = ? LIMIT 1',
            [req.body.email],
            function(error, result) {
                if( error ) {
                    return res.status(500).end();
                }

                if( result.rowCount > 0 ) {
                    var salt = result.rows[0].salt;
                    var hmac = crypto.createHmac('sha256', salt);

                    hmac.update(req.body.password);
                    if( hmac.digest('base64') == result.rows[0].password ) {
                        // success
                        req.session.regenerate(function() {
                            // set authenticated information
                            req.session.authenticated = true;
                            req.session.uid = result.rows[0].userid;
                            req.session.user = result.rows[0].email;

                            return res.status(200).end();
                        });

                    } else {
                        // wrong credential
                        req.session.regenerate(function() {
                            // send new csrf token via response header
                            res.set('Access-Control-Expose-Headers', 'X-CSRF-Refresh');
                            res.set('X-CSRF-Refresh', req.csrfToken());

                            return res.status(401).end();
                        });
                    }

                } else {
                    // no user found
                    req.session.regenerate(function() {
                        // send new csrf token via response header
                        res.set('Access-Control-Expose-Headers', 'X-CSRF-Refresh');
                        res.set('X-CSRF-Refresh', req.csrfToken());

                        return res.status(401).end();
                    });
                }
            }
        );
    });

    // expected: /api/signout
    app.get('/signout', function(req, res) {
        if( req.session ) {
            req.session.destroy();
        }
        res.redirect(303, '/');
    });

    return app;
};
