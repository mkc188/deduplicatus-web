var express = require('express'),
    expressValidator = require('express-validator'),
    bodyParser = require('body-parser'),
    crypto = require('crypto'),
    fs = require('fs'),
    level = require('level'),
    LevelPromise = require('level-promise'),
    Promise = require('promise'),
    path = require('path'),
    uuid = require('node-uuid');

module.exports = function(pool, config) {
    var app  = express.Router();

    var regex = {
        uuid: /^([0-9a-z\-]+)$/,
        password: /^.{8,}$/,
        hiddenFile: /^\../
    };

    app.use(bodyParser.urlencoded({extended:true}));
    // this line must be immediately after express.bodyParser()!
    app.use(expressValidator());

    // expected: /client/status
    app.post('/status', function(req, res) {
        var response = {
            auth: (req.session && req.session.authenticated && req.session.local_client) ? true : false,
            lock: false,
            account: ((req.session && typeof req.session.user != "undefined") ? req.session.user : "")
        };

        if( response.auth &&
            typeof req.body.lock != "undefined" &&
            regex.uuid.test(req.body.lock) ) {
            
            pool.query('SELECT meta_lock FROM users WHERE userid = ? LIMIT 1',
                [req.session.uid],
                function(error, result) {
                    if( !error && result.rows[0].meta_lock == req.body.lock ) {
                        response.lock = true;
                    }
                    res.status(200).json(response).end();
                }
            );
        } else {
            res.status(200).json(response).end();
        }
    });

    // expected: /client/signin
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
                            req.session.local_client = true;
                            req.session.uid = result.rows[0].userid;
                            req.session.user = result.rows[0].email;

                            return res.status(200).end();
                        });

                    } else {
                        // wrong credential
                        req.session.regenerate(function() {
                            return res.status(401).end();
                        });
                    }

                } else {
                    // no user found
                    req.session.regenerate(function() {
                        return res.status(401).end();
                    });
                }
            }
        );
    });

    // expected: /client/signout
    app.post('/signout', function(req, res) {
        if( req.session ) {
            req.session.destroy();
        }
        return res.status(200).end();
    });

    /*
     * middleware to validate the authentication token and client status
     */
    app.use('/', function(req, res) {
        if( req.session && req.session.authenticated && req.session.local_client ) {
            req.next();
        } else {
            return res.status(401).end();
        }
    });

    // expected: /client/lock
    app.post('/lock', function(req, res) {
        var userid = req.session.uid;
        var versionid;
        var leveldbPath;
        var lockid;
        var leveldbHashes;
        var ip = req.headers['x-forwarded-for'] || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress ||
             req.connection.socket.remoteAddress;

        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    versionid = result.rows[0].meta_version;
                    leveldbPath = config.USER_DATA + "/" + userid + "/" + versionid;
                    var locked = !( result.rows[0].meta_lock == null );

                    if( locked ) {
                        res.status(400).end();
                        throw new Error();
                    }

                    lockid = uuid.v4();
                    return pool.query('INSERT INTO metafile_locks (lockid, userid, start_time, end_time, ip_address) VALUES (?, ?, ?, ?, INET_ATON(?))',
                        [lockid, userid, Math.floor(new Date() / 1000), 0, ip]);
                },
                function(error) {
                    return res.status(500).end();
                }
            )
            .then(
                function() { return pool.query('UPDATE users SET meta_lock = ? WHERE userid = ? LIMIT 1', [lockid, userid]) },
                function(error) {
                    return res.status(500).end();
                })
            .then(
                function() {
                    var promiseAll = []
                    var response = {
                        'userid': userid,
                        'versionid': versionid,
                        'lockid': lockid,
                        'files': {}
                    };

                    var levelfiles = fs.readdirSync(leveldbPath);
                    for (var i = 0, len = levelfiles.length; i < len; i++) {
                        // ignore hidden file in file system
                        if( regex.hiddenFile.test(levelfiles[i]) ) {
                            continue;
                        }

                        promiseAll.push(new Promise(function(resolve, reject) {
                            var filename = levelfiles[i];
                            var filepath = leveldbPath + "/" + filename;

                            var shasum = crypto.createHash('sha1');
                            var s = fs.ReadStream(filepath);

                            s.on('data', function(d) {
                                shasum.update(d);
                            });

                            s.on('end', function() {
                                var d = shasum.digest('hex');
                                resolve([filename, d]);
                            });
                        }).then(function(arr) {
                            response.files[arr[0]] = arr[1];
                        }));
                    }

                    Promise.all(promiseAll).then(function() {
                        return res.status(200).json(response).end();
                    });
                },
                function(error) {
                    return res.status(500).end();
                }
            )
    });

    // expected: /client/lock
    app.get('/download/:versionid/:filename', function(req, res) {
        // run input validations
        req.checkParams('versionid')
            .notEmpty()
            .matches(regex.uuid);

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors ) {
            return res.status(400).end();
        }

        var userid = req.session.uid;
        var versionid = req.params.versionid;
        var filename = req.params.filename;

        pool.query('SELECT versionid, completed FROM metafile_versions WHERE userid = ? AND versionid = ? LIMIT 1',
            [userid, versionid],
            function(error, result) {
                if( error ) {
                    return res.status(500).end();
                }

                if( result.rowCount > 0 ) {
                    var filepath = config.USER_DATA + "/" + userid + "/" + versionid + "/" + path.basename(filename);
                    fs.stat(filepath, function(err, stats) {
                        if( err ) {
                            return res.status(400).end();
                        }

                        res.download(filepath, path.basename(filename));
                    });

                } else {
                    // no version found
                    return res.status(400).end();
                }
            }
        );
    });

    return app;
};
