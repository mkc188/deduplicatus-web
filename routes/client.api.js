var express = require('express'),
    expressValidator = require('express-validator'),
    begin = require('any-db-transaction'),
    bodyParser = require('body-parser'),
    crypto = require('crypto'),
    fs = require('fs-extra'),
    level = require('level'),
    LevelPromise = require('level-promise'),
    Promise = require('promise'),
    path = require('path'),
    uuid = require('node-uuid'),
    util = require('util'),
    multer = require('multer');

module.exports = function(pool, config) {
    var app  = express.Router();

    var regex = {
        uuid: /^([0-9a-z\-]+)$/,
        password: /^.{8,}$/,
        hiddenFile: /^\../,
        leveldbFilename: /^[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9]+){0,1}$/
    };

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }));
    // parse application/json
    app.use(bodyParser.json());
    // this line must be immediately after express.bodyParser()!
    app.use(expressValidator());
    app.use(multer()); // for parsing multipart/form-data

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
            return res.status(400).end();
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
        var db;
        var versionid;
        var leveldbPath;
        var lockid;
        var leveldbHashes;
        var ip = req.headers['x-forwarded-for'] || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress ||
             req.connection.socket.remoteAddress;

        var isFinalized;
        var storageMode;

        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    versionid = result.rows[0].meta_version;
                    leveldbPath = config.USER_DATA + "/" + userid + "/" + versionid;
                    var locked = !( result.rows[0].meta_lock == null );

                    if( locked ) {
                        res.status(400).end();
                        return false;
                    }

                    db = level(leveldbPath, function(err) {
                        if( err ) {
                            db.close();

                            res.status(500).send('LevelDB Error').end();
                        }
                    });
                    LevelPromise(db);
                    return db.get('metafile::finalized');
                },
                function(error) {
                    res.status(500).end();
                    return false;
                }
            )
            // obtain storage mode
            .then(
                function(result) {
                    if( result === false ) return false;

                    isFinalized = ( parseInt(result) > 0 );
                    return db.get('clouds::storageMode');
                },
                function(error) {
                    res.status(500).end();
                    return false;
                }
            )
            .then(
                function(result) {
                    // close leveldb handler
                    db.close();

                    if( result === false ) return false;

                    if( !isFinalized && result == 'deduplication' ) {
                        res.status(412).end();
                        return false;
                    }

                    lockid = uuid.v4();
                    return pool.query('INSERT INTO metafile_locks (lockid, userid, start_time, end_time, ip_address) VALUES (?, ?, ?, ?, INET_ATON(?))',
                        [lockid, userid, Math.floor(new Date() / 1000), 0, ip]);
                },
                function(error) {
                    res.status(500).end();
                    return false;
                }
            )
            .then(
                function(result) {
                    if( result === false ) return false;

                    return pool.query('UPDATE users SET meta_lock = ? WHERE userid = ? LIMIT 1', [lockid, userid]);
                },
                function(error) {
                    res.status(500).end();
                    return false;
                })
            .then(
                function(result) {
                    if( result === false ) return false;

                    var promiseAll = [];
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

    // expected: /client/download
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

    // expected: /client/newVersion
    app.post('/newVersion', function(req, res) {
        // run input validations
        req.checkBody('lock')
            .notEmpty()
            .matches(regex.uuid);
        var containFileList = ( typeof req.body.files == 'object' && !util.isArray(req.body.files) );

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors || !containFileList ) {
            return res.status(400).end();
        }

        var userid = req.session.uid;
        var lockid = req.body.lock;
        var files = req.body.files;
        var currentVersionId;
        var currentPath;
        var nextVersionId;
        var nextPath;

        pool.query('SELECT meta_version FROM users WHERE userid = ? AND meta_lock = ? LIMIT 1', [userid, lockid])
            .then(
                function(result) {
                    if( result.rowCount == 0 ) {
                        res.status(400).end();
                        return false;
                    }

                    currentVersionId = result.rows[0].meta_version;
                    nextVersionId = uuid.v4();
                    currentPath = config.USER_DATA + "/" + userid + "/" + currentVersionId;
                    nextPath = config.USER_DATA + "/" + userid + "/" + nextVersionId;

                    var promiseAll = [];
                    var response = {
                        'nextVersion': nextVersionId,
                        'files': []
                    };
                    var currentHashes = {};

                    // create new version folder
                    fs.mkdirSync(nextPath);

                    // hash all files in current leveldb folder for later comparison
                    var levelfiles = fs.readdirSync(currentPath);
                    for (var i = 0, len = levelfiles.length; i < len; i++) {
                        // ignore hidden file in file system
                        if( regex.hiddenFile.test(levelfiles[i]) ) {
                            continue;
                        }

                        promiseAll.push(new Promise(function(resolve, reject) {
                            var filename = levelfiles[i];
                            var filepath = currentPath + "/" + filename;

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
                            currentHashes[arr[1]] = arr[0]; // sha1 hashes as keys
                        }));
                    }

                    Promise.all(promiseAll).then(function() {
                        // compare the hashes of files on server and the hashes provided from client
                        Object.keys(files).forEach(function(key) {
                            var val = files[key];

                            if( typeof currentHashes[val] != "undefined" ) {
                                // there is a file with same hash on server, copy it
                                try {
                                    fs.copySync(currentPath + "/" + currentHashes[val], nextPath + "/" + key);
                                } catch(e) {
                                    // error thrown, assume file not copied
                                    response.files.push(key);
                                }
                            } else {
                                response.files.push(key);
                            }
                        });

                        // insert the version record into database
                        pool.query('INSERT INTO metafile_versions (versionid, userid, time, completed) VALUES (?, ?, ?, ?)',
                            [nextVersionId, userid, Math.floor(new Date() / 1000), 0],
                            function(error, result) {
                                if( error ) {
                                    return res.status(500).end();
                                }

                                return res.status(200).json(response).end();
                            }
                        );
                    });
                },
                function(error) {
                    return res.status(500).end();
                }
            )
    });

    // expected: /client/upload
    app.post('/upload/:versionid/:filename', function(req, res) {
        // run input validations
        req.checkParams('versionid')
            .notEmpty()
            .matches(regex.uuid);
        req.checkParams('filename')
            .notEmpty()
            .matches(regex.leveldbFilename);
        var containUpload = ( typeof req.files.upload != 'undefined' );

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors || !containUpload ) {
            return res.status(400).end();
        }

        var userid = req.session.uid;
        var versionid = req.params.versionid;

        // check the versionid is owned by user and not completed
        pool.query('SELECT time FROM metafile_versions WHERE userid = ? AND versionid = ? AND completed = ? LIMIT 1', [userid, versionid, 0])
            .then(
                function(result) {
                    if( result.rowCount == 0 ) {
                        res.status(400).end();
                        return false;
                    }

                    var targetPath = config.USER_DATA + "/" + userid + "/" + versionid + "/" + path.basename(req.params.filename);
                    try {
                        fs.renameSync(req.files.upload.path, targetPath);
                        return res.status(200).end();
                    } catch(e) {
                        return res.status(500).end();
                    }
                },
                function(error) {
                    return res.status(500).end();
                }
            );
    });

    // expected: /client/commit
    app.post('/commit', function(req, res) {
        // run input validations
        req.checkBody('lock')
            .notEmpty()
            .matches(regex.uuid);
        req.checkBody('versionid')
            .notEmpty()
            .matches(regex.uuid);
        var containFileList = ( typeof req.body.files == 'object' && !util.isArray(req.body.files) );

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors || !containFileList ) {
            return res.status(400).end();
        }

        var userid = req.session.uid;
        var lockid = req.body.lock;
        var versionid = req.body.versionid;
        var files = req.body.files;
        var meta_secret;

        // check the versionid is owned by user and not completed
        pool.query('SELECT time FROM metafile_versions WHERE userid = ? AND versionid = ? AND completed = 0 LIMIT 1', [userid, versionid])
            .then(
                function(result) {
                    if( result.rowCount == 0 ) {
                        res.status(403).end();
                        return false;
                    }

                    // check the meta lock is locked
                    return pool.query('SELECT meta_secret, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
                },
                function(error) {
                    return res.status(500).end();
                }
            )
            .then(
                function(result) {
                    if( result == false ) return false;

                    if( result.rowCount == 0 || result.rows[0].meta_lock != lockid ) {
                        res.status(403).end();
                        return false;
                    }

                    meta_secret = result.rows[0].meta_secret;

                    var promiseAll = [];
                    var leveldbHashes = {};
                    var leveldbPath = config.USER_DATA + "/" + userid + "/" + versionid;

                    // gerenate sha1 checksum for all files in new version directory
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
                            leveldbHashes[arr[0]] = arr[1]; // sha1 hashes as keys
                        }));
                    }

                    Promise.all(promiseAll).then(function() {
                        // for each req.body.files and compare with leveldbHashes
                        Object.keys(files).forEach(function(key) {
                            var val = files[key];

                            // conflict cases:
                            // - file not found on server side
                            // - hash of the file on server incorrect
                            if( !(key in leveldbHashes) || leveldbHashes[key] != val ) {
                                // HTTP Status 409 Conflict
                                res.status(409).end();
                                return false;
                            }

                             // remove entry in leveldbHashes if found and its hash matched
                            delete leveldbHashes[key];
                        });

                        // remove other file not stated in req.body.files
                        Object.keys(leveldbHashes).forEach(function(key) {
                            try {
                                fs.unlinkSync(leveldbPath + "/" + key);
                            } catch(e) {};
                        });

                        // open leveldb
                        var db = level(leveldbPath, {'createIfMissing': false}, function(err) {
                            if( err ) {
                                db.close();
                                // HTTP Status 415 Unsupported Media Type
                                res.status(415).end();
                                return false;
                            }
                        });

                        // check metafile::userid and metafile::secret is the same as it in database
                        db.get('metafile::userid', function(err, value) {
                            if( err || value != userid ) {
                                db.close();
                                // HTTP Status 415 Unsupported Media Type
                                res.status(415).end();
                                return false;
                            }

                            db.get('metafile::secret', function(err, value) {
                                if( err || value != meta_secret ) {
                                    db.close();
                                    // HTTP Status 415 Unsupported Media Type
                                    res.status(415).end();
                                    return false;
                                }

                                // update versionid in local leveldb
                                db.put('metafile::version', versionid, function(err) {
                                    if( err ) {
                                        db.close();
                                        res.status(400).end();
                                        return false;
                                    }

                                    db.close(function(err) {
                                        // update database
                                        pool.query('UPDATE metafile_versions SET completed = 1 WHERE userid = ? AND versionid = ? LIMIT 1',
                                            [userid, versionid],
                                            function(error, result) {
                                                if( error ) {
                                                    return res.status(500).end();
                                                }

                                                pool.query('UPDATE users SET meta_version = ? WHERE userid = ? LIMIT 1',
                                                    [versionid, userid],
                                                    function(error, result) {
                                                        if( error ) {
                                                            return res.status(500).end();
                                                        }
                                                        return res.status(200).end();
                                                    }
                                                );
                                            }
                                        );
                                    });
                                });
                            });
                        });
                    });
                },
                function(error) {
                    return res.status(500).end();
                }
            );
    });

    // expected: /client/unlock
    app.post('/unlock', function(req, res) {
        // run input validations
        req.checkBody('lock')
            .notEmpty()
            .matches(regex.uuid);

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors ) {
            return res.status(400).end();
        }

        var userid = req.session.uid;
        var lockid = req.body.lock;
        var tx = begin(pool);

        // confirm the current lockid is correct
        tx.query('SELECT meta_lock FROM users WHERE userid = ? LIMIT 1',
            [userid],
            function(error, result) {
                if( error ) {
                    return res.status(500).end();
                }

                if( result.rows[0].meta_lock == lockid ) {
                    // remove lockid from users table
                    tx.query('UPDATE users SET meta_lock = NULL WHERE userid = ? LIMIT 1',
                        [userid],
                        function(error, result) {
                            if( error ) {
                                tx.rollback();
                                return res.status(500).end();
                            }

                            // update the end time of lock in metafile_locks table
                            tx.query('UPDATE metafile_locks SET end_time = ? WHERE lockid = ? AND userid = ? LIMIT 1',
                                [Math.floor(new Date() / 1000), lockid, userid],
                                function(error, result) {
                                    if( error ) {
                                        tx.rollback();
                                        return res.status(500).end();
                                    }

                                    tx.commit();
                                    return res.status(200).end();
                                }
                            );
                        }
                    );
                } else {
                    return res.status(400).end();
                }
            }
        );
    });

    // expected: /client/refreshToken
    app.post('/refreshToken', function(req, res) {
        // run input validations
        req.checkBody('lock')
            .notEmpty()
            .matches(regex.uuid);
        req.checkBody('cloud')
            .notEmpty()
            .matches(regex.uuid);

        // reject when any validation error occurs
        var errors = req.validationErrors();
        if( errors ) {
            return res.status(400).end();
        }

        var userid = req.session.uid;
        var lockid = req.body.lock;
        var cloud = req.body.cloud;

        var db;
        var versionid;
        var leveldbPath;
        var isFinalized;
        var storageMode;
        var targetCloud;

        var onedrive = require('./clouds.onedrive.js')(config),
            dropbox = require('./clouds.dropbox.js')(config),
            boxdotnet = require('./clouds.boxdotnet.js')(config);

        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    versionid = result.rows[0].meta_version;
                    leveldbPath = config.USER_DATA + "/" + userid + "/" + versionid;
                    var locked = !( result.rows[0].meta_lock == null );

                    if( !locked ) {
                        // required locked leveldb
                        res.status(412).end();
                        return false;
                    }

                    db = level(leveldbPath, function(err) {
                        if( err ) {
                            db.close();

                            res.status(500).send('LevelDB Error').end();
                        }
                    });
                    LevelPromise(db);
                    return db.get('metafile::finalized');
                },
                function(error) {
                    res.status(500).end();
                    return false;
                }
            )
            // obtain storage mode
            .then(
                function(result) {
                    if( result === false ) return false;

                    isFinalized = ( parseInt(result) > 0 );
                    return db.get('clouds::storageMode');
                },
                function(error) {
                    db.close();

                    res.status(500).end();
                    return false;
                }
            )
            .then(
                function(result) {
                    if( result === false ) return false;

                    if( !isFinalized && result == 'deduplication' ) {
                        // deduplication-mode required finalized leveldb
                        res.status(412).end();
                        return false;
                    }

                    // if key not exists in leveldb, it will return 500 server error
                    return db.get('clouds::account::' + cloud + '::type');
                },
                function(error) {
                    db.close();

                    res.status(500).end();
                    return false;
                }
            )
            .then(
                function(result) {
                    if( result === false ) return false;

                    targetCloud = result;
                    return db.get('clouds::account::' + cloud + '::refreshToken');
                },
                function(error) {
                    db.close();

                    res.status(500).end();
                    return false;
                }
            )
            .then(
                function(result) {
                    if( result === false ) return false;

                    var refresh;
                    switch( targetCloud ) {
                        case onedrive.type:
                            refresh = onedrive.refreshToken(result);
                            break;
                        case dropbox.type:
                            refresh = dropbox.refreshToken(result);
                            break;
                        case boxdotnet.type:
                            refresh = boxdotnet.refreshToken(result);
                            break;
                    }

                    return refresh;
                },
                function(error) {
                    db.close();

                    res.status(500).end();
                    return false;
                }
            )
            .then(
                function(newTokens) {
                    if( newTokens === false ) return false;

                    if( newTokens != null ) {
                        // save new tokens (access token and refresh token pair) into leveldb
                        db.batch([
                            { type: 'put', key: 'clouds::account::' + cloud + '::accessToken', value: newTokens.accessToken },
                            { type: 'put', key: 'clouds::account::' + cloud + '::refreshToken', value: newTokens.refreshToken }
                        ], function(err) {
                            if( err ) {
                                return res.status(400).end();
                            }
                        });

                        // close leveldb handler
                        db.close(function(error) {
                            res.status(200).json(newTokens).end();
                        });

                    } else {
                        // no new access token returned
                        db.close();

                        res.status(403).end();
                        return false;
                    }
                },
                function(error) {
                    db.close();

                    res.status(500).end();
                    return false;
                }
            );
    });

    return app;
};
