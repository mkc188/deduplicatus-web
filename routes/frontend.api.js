var begin = require('any-db-transaction'),
    crypto = require('crypto'),
    bodyParser = require('body-parser'),
    express = require('express'),
    expressValidator = require('express-validator'),
    fs = require('fs-extra'),
    level = require('level'),
    LevelPromise = require('level-promise'),
    Promise = require('promise'),
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

    // expected: /api/clouds
    app.get('/clouds', function(req, res) {
        var userid = req.session.uid;
        var db; // user's leveldb
        var json = {
            'storageMode': null,
            'finalized': null,
            'locked': null,
            'clouds': {}
        };

        // obtain the current version of leveldb to get its path
        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    var verionid = result.rows[0].meta_version;
                    var leveldbPath = config.USER_DATA + "/" + userid + "/" + verionid;
                    json.locked = !( result.rows[0].meta_lock == null );

                    db = level(leveldbPath, function(err) {
                        if( err ) {
                            db.close();

                            res.status(500).send('LevelDB Error').end();
                        }
                    });
                    LevelPromise(db);
                },
                function(error) {
                    res.status(500).send('Database Error').end();
                }
            )
            // obtain storage mode
            .then(
                function() {
                    return db.get('clouds::storageMode');
                }
            )
            // obtain metafile is finalized or not
            .then(
                function(result) {
                    json.storageMode = result;
                    return db.get('metafile::finalized');
                },
                function(error) {
                    db.close();

                    res.status(500).send('LevelDB Error').end();
                }
            )
            // obtain list of registered clouds
            .then(
                function(result) {
                    json.finalized = ( parseInt(result) > 0 );

                    return new Promise(function(resolve, reject) {
                        var data = {};
                        db.createReadStream({ 'gte': 'clouds::account::', 'lte': 'clouds::account::' + '\xFF' })
                            .on('data', function(read) {
                                data[read.key] = read.value;
                            })
                            .on('error', function(error) {
                                res.status(500).send('LevelDB Error').end();
                                return reject(error);
                            })
                            .on('close', function() {
                                return resolve(data);
                            })
                            .on('end', function() {
                                return resolve(data);
                            });
                    });
                },
                function(error) {
                    res.status(500).send('LevelDB Error').end();
                }
            )
            // process results, and return as json to client
            .then(
                function(result) {
                    // close leveldb handler
                    db.close();

                    // only return cloud's identifier, type, account name to browser
                    var clouds = {};

                    var keyAllowed = ['type', 'accountName'];
                    var regex = /^clouds::account::([0-9a-z\-]+)::([a-zA-Z]+)$/;
                    for( var k in result ){
                        var match = k.match(regex);
                        var cloudid = match[1];
                        var attr = match[2];
                        var value = result[k];

                        if( typeof clouds[cloudid] == "undefined" ) {
                            clouds[cloudid] = {};
                        }
                        if( keyAllowed.indexOf(attr) >= 0 ) {
                            clouds[cloudid][attr] = value;
                        }
                    }

                    json.clouds = clouds;

                    res.status(200).json(json).end();
                },
                function(error) {
                    db.close();

                    res.status(500).send('LevelDB Error').end();
                }
            );
    });

    // expected: /api/metafile/(cloudid)/remove
    app.post('/metafile/:cloudid([0-9a-z\-]+)/remove', function(req, res) {
        var userid = req.session.uid;
        var cloudid = req.params.cloudid;
        var db; // user's leveldb
        var isFinalized;
        var cloudClount;

        // obtain the current version of leveldb to get its path
        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    var verionid = result.rows[0].meta_version;
                    var leveldbPath = config.USER_DATA + "/" + userid + "/" + verionid;
                    locked = !( result.rows[0].meta_lock == null );

                    if( locked ) {
                        res.status(400).send('Metafile currently locked').end();
                    }

                    db = level(leveldbPath, function(err) {
                        if( err ) {
                            db.close();

                            res.status(500).send('LevelDB Error').end();
                        }
                    });
                    LevelPromise(db);
                },
                function(error) {
                    res.status(500).send('Database Error').end();
                }
            )
            // obtain cloud count
            .then(
                function() {
                    return db.get('clouds::count');
                }
            )
            // obtain metafile is finalized or not
            .then(
                function(result) {
                    cloudClount = parseInt(result);
                    return db.get('metafile::finalized');
                }
            )
            .then(
                function(result) {
                    isFinalized = ( parseInt(result) > 0 );
                    if( isFinalized ) {
                        res.status(400).send('Metafile already finalized').end();
                    }

                    // find a list of keys to be removed
                    return new Promise(function(resolve, reject) {
                        var data = [];
                        db.createKeyStream({ 'gte': 'clouds::account::' + cloudid + '::', 'lte': 'clouds::account::' + cloudid + '::' + '\xFF' })
                            .on('data', function(value) {
                                data.push(value);
                            })
                            .on('error', function(error) {
                                res.status(500).send('LevelDB Error').end();
                                return reject(error);
                            })
                            .on('close', function() {
                                return resolve(data);
                            })
                            .on('end', function() {
                                return resolve(data);
                            });
                    });
                },
                function(error) {
                    db.close();

                    res.status(500).send('LevelDB Error').end();
                }
            )
            .then(
                function(result) {
                    var operations = [
                        { type: 'put', key: 'clouds::count', value: cloudClount - 1 }
                    ];
                    for( var i in result ) {
                        operations.push({ type: 'del', key: result[i] });
                    }

                    db.batch(operations, function(err) {
                        if( err ) {
                            db.close();
                            res.status(500).send('LevelDB Error').end();
                        }
                    });

                    db.close(function(err) {
                        if( err ) {
                            res.status(500).send('LevelDB Error').end();
                        }

                        res.status(200).end();
                    });
                },
                function(error) {
                    db.close();

                    res.status(500).send('LevelDB Error').end();
                }
            );
    });

    // expected: /api/metafile/finalize
    app.post('/metafile/finalize', function(req, res) {
        var userid = req.session.uid;
        var cloudid = req.params.cloudid;
        var db; // user's leveldb
        var isFinalized;
        var storageMode;

        // obtain the current version of leveldb to get its path
        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    var verionid = result.rows[0].meta_version;
                    var leveldbPath = config.USER_DATA + "/" + userid + "/" + verionid;
                    locked = !( result.rows[0].meta_lock == null );

                    if( locked ) {
                        res.status(400).send('Metafile currently locked').end();
                    }

                    db = level(leveldbPath, function(err) {
                        if( err ) {
                            db.close();

                            res.status(500).send('LevelDB Error').end();
                        }
                    });
                    LevelPromise(db);
                },
                function(error) {
                    res.status(500).send('Database Error').end();
                }
            )
            // obtain cloud count
            .then(
                function() {
                    console.log("frontend.api.js: finalize: get clouds::count");
                    return db.get('clouds::count');
                }
            )
            // obtain storage mode
            .then(
                function(result) {
                    if( parseInt(result) == 0 ) {
                        db.close();
                        res.status(400).send('Please add at least one cloud account').end();
                        return null;
                    }

                    console.log("frontend.api.js: finalize: get clouds::storageMode");
                    return db.get('clouds::storageMode');
                }
            )
            // obtain metafile is finalized or not
            .then(
                function(result) {
                    if( result === null ) return null;

                    storageMode = result;

                    if( storageMode != 'deduplication' ) {
                        db.close();
                        res.status(400).send('Not supported').end();
                        return null;
                    }

                    console.log("frontend.api.js: finalize: get metafile::finalized");
                    return db.get('metafile::finalized');
                },
                function(error) {
                    res.status(500).send('Database Error').end();
                }
            )
            .then(
                function(result) {
                    if( result === null ) return null;

                    isFinalized = ( parseInt(result) > 0 );
                    if( isFinalized ) {
                        db.close();
                        res.status(400).send('Metafile already finalized').end();
                        return null;
                    }

                    console.log("frontend.api.js: finalize: put metafile::finalized");
                    db.put('metafile::finalized', 1, function(err) {
                        if( err ) {
                            db.close();
                            res.status(500).send('LevelDB Error').end();
                        }
                    });

                    console.log("frontend.api.js: before close");
                    db.close(function(err) {
                        if( err ) {
                            res.status(500).send('LevelDB Error').end();
                        }

                        console.log("frontend.api.js: close leveldb");
                        res.status(200).end();
                    });
                },
                function(error) {
                    db.close();

                    res.status(500).send('LevelDB Error').end();
                }
            );
    });

    // expected: /api/locks
    app.get('/locks', function(req, res) {
        pool.query('SELECT lockid, start_time, end_time, INET_NTOA(ip_address) AS ip_address FROM metafile_locks WHERE userid = ? ORDER BY start_time DESC LIMIT 5',
            [req.session.uid],
            function(error, result) {
                if( error ) {
                    return res.status(500).send('Database Error').end();
                }

                res.json(result.rows);
            }
        );
    });

    // expected: /api/unlock/(lockid)
    app.post('/unlock/:lockid', function(req, res) {
        var userid = req.session.uid;
        var lockid = req.params.lockid;

        var tx = begin(pool);
        // confirm the current lockid is correct
        tx.query('SELECT meta_lock FROM users WHERE userid = ? LIMIT 1',
            [userid],
            function(error, result) {
                if( error ) {
                    return res.status(500).send('Database Error').end();
                }

                if( result.rows[0].meta_lock == lockid ) {
                    // remove lockid from users table
                    tx.query('UPDATE users SET meta_lock = NULL WHERE userid = ? LIMIT 1',
                        [userid],
                        function(error, result) {
                            if( error ) {
                                tx.rollback();
                                return res.status(500).send('Database Error').end();
                            }

                            // update the end time of lock in metafile_locks table
                            tx.query('UPDATE metafile_locks SET end_time = ? WHERE lockid = ? AND userid = ? LIMIT 1',
                                [Math.floor(new Date() / 1000), lockid, userid],
                                function(error, result) {
                                    if( error ) {
                                        tx.rollback();
                                        return res.status(500).send('Database Error').end();
                                    }

                                    tx.commit();
                                    return res.status(200).end();
                                }
                            );
                        }
                    );
                } else {
                    return res.status(400).send('Invalid Request').end();
                }
            }
        );
    });

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

            pool.query('UPDATE users SET salt = ?, password = ? WHERE userid = ? LIMIT 1',
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
