var bodyParser = require('body-parser'),
    express = require('express'),
    expressValidator = require('express-validator'),
    level = require('level'),
    LevelPromise = require('level-promise'),
    Promise = require('promise'),
    uuid = require('node-uuid');

module.exports = function(pool, config) {
    var onedrive = require('./clouds.onedrive.js')(config),
        dropbox = require('./clouds.dropbox.js')(config),
        boxdotnet = require('./clouds.boxdotnet.js')(config);

    var app  = express.Router();

    app.use(bodyParser.urlencoded({extended:true}));
    // this line must be immediately after express.bodyParser()!
    app.use(expressValidator());

    var cloudtype = [];
        cloudtype.push(onedrive.type);
        cloudtype.push(dropbox.type);
        cloudtype.push(boxdotnet.type);

    // expected: /api/cloud/(cloudtype)/add
    app.get('/:cloudtype/add', function(req, res) {
        if( cloudtype.indexOf(req.params.cloudtype) == -1 ) {
            return res.status(400).send('Unknown cloud provider').end();
        }

        var userid = req.session.uid;
        var db; // user's leveldb
        var isFinalized;

        // check if user's metafile allow to add cloud or not
        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    var verionid = result.rows[0].meta_version;
                    var leveldbPath = config.USER_DATA + "/" + userid + "/" + verionid;
                    var locked = !( result.rows[0].meta_lock == null );

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
            // obtain metafile is finalized or not
            .then(
                function() {
                    return db.get('metafile::finalized');
                }
            )
            .then(
                function(result) {
                    // close leveldb handler
                    db.close();

                    isFinalized = ( parseInt(result) > 0 );
                    if( isFinalized ) {
                        res.status(400).send('Metafile already finalized').end();
                    }

                    // generate redirect url
                    var redirectUri =
                        ((config.HTTPS) ? 'https' : 'http') +
                        '://' + req.hostname + '/api/cloud/' +
                        req.params.cloudtype + '/callback';

                    var csrfToken = uuid.v4();
                    req.session.oauthCSRF = csrfToken;
                    req.session.redirectUri = redirectUri;

                    var redirection;
                    switch( req.params.cloudtype ) {
                        case onedrive.type:
                            redirection = onedrive.oauthAuthorizeUri(redirectUri, csrfToken);
                            break;
                        case dropbox.type:
                            redirection = dropbox.oauthAuthorizeUri(redirectUri, csrfToken);
                            break;
                        case boxdotnet.type:
                            redirection = boxdotnet.oauthAuthorizeUri(redirectUri, csrfToken);
                            break;
                    }

                    res.status(200).json({'redirect': redirection}).end();
                }
            );
    });

    // expected: /api/cloud/(cloudtype)/callback
    app.get('/:cloudtype/callback', function(req, res) {
        if( cloudtype.indexOf(req.params.cloudtype) == -1 ) {
            return res.status(400).send('Unknown cloud provider').end();
        }

        var oauthHandler;
        switch( req.params.cloudtype ) {
            case onedrive.type:
                oauthHandler = onedrive.oauthCallback(req.session, req.query);
                break;
            case dropbox.type:
                oauthHandler = dropbox.oauthCallback(req.session, req.query);
                break;
            case boxdotnet.type:
                oauthHandler = boxdotnet.oauthCallback(req.session, req.query);
                break;
        }

        var userid = req.session.uid;
        var db; // user's leveldb
        var isFinalized;
        var newCloudAccount;
        var cloudClount;

        // check if user's metafile allow to add cloud or not
        pool.query('SELECT meta_version, meta_lock FROM users WHERE userid = ? LIMIT 1', [userid])
            .then(
                function(result) {
                    var verionid = result.rows[0].meta_version;
                    var leveldbPath = config.USER_DATA + "/" + userid + "/" + verionid;
                    var locked = !( result.rows[0].meta_lock == null );

                    if( locked ) {
                        res.redirect(302, '/manage/clouds#add_error_metafile_locked');
                    }

                    db = level(leveldbPath, function(err) {
                        if( err ) {
                            db.close();

                            res.redirect(302, '/manage/clouds#add_error_leveldb');
                        }
                    });
                    LevelPromise(db);
                },
                function(error) {
                    res.redirect(302, '/manage/clouds#add_error_database');
                }
            )
            // obtain metafile is finalized or not
            .then(
                function() {
                    return db.get('metafile::finalized');
                }
            )
            .then(
                function(result) {
                    isFinalized = ( parseInt(result) > 0 );

                    if( isFinalized ) {
                        db.close();
                        res.redirect(302, '/manage/clouds#add_error_metafile_finalized');
                    }

                    return db.get('clouds::count');
                }
            )
            .then(
                function(result) {
                    cloudClount = parseInt(result);

                    console.log("clouds.api.js: callback: oauthHandler");
                    return oauthHandler;
                }
            )
            .then(
                function(result) {
                    console.log("clouds.api.js: callback: response");
                    newCloudAccount = result;

                    // load all cloud accounts in leveldb to check if any duplicated
                    return new Promise(function(resolve, reject) {
                        var data = {};
                        db.createReadStream({ 'gte': 'clouds::account::', 'lte': 'clouds::account::' + '\xFF' })
                            .on('data', function(read) {
                                console.log("clouds.api.js: callback: read stream");
                                data[read.key] = read.value;
                            })
                            .on('error', function(error) {
                                res.redirect(302, '/manage/clouds#add_error_leveldb');
                                return reject(error);
                            })
                            .on('close', function() {
                                console.log("clouds.api.js: callback: close stream");
                                return resolve(data);
                            })
                            .on('end', function() {
                                console.log("clouds.api.js: callback: end stream");
                                return resolve(data);
                            });
                    });
                },
                function(error) {
                    db.close();

                    // api rejected user's request
                    res.redirect(302, '/manage/clouds#add_error_rejected');
                }
            ).then(
                function(result) {
                    // parse clouds account
                    var clouds = {};
                    var writeRecord = true;

                    var regex = /^clouds::account::([0-9a-z\-]+)::([a-zA-Z]+)$/;
                    for( var k in result ){
                        var match = k.match(regex);
                        var cloudid = match[1];
                        var attr = match[2];
                        var value = result[k];

                        if( typeof clouds[cloudid] == "undefined" ) {
                            clouds[cloudid] = {};
                        }
                        clouds[cloudid][attr] = value;
                    }

                    for( var k in clouds ){
                        if( clouds[k]['type'] == newCloudAccount.type &&
                            clouds[k]['cloudIdentifier'] == newCloudAccount.cloudIdentifier ) {
                            writeRecord = false;

                            db.close(function() {
                                res.redirect(302, '/manage/clouds#add_error_duplicated');
                            });
                        }
                    }

                    if( writeRecord ) {
                        var cloudid = uuid.v4();

                        console.log("clouds.api.js: callback: before batch");
                        // add cloud record into leveldb
                        db.batch([
                            { type: 'put', key: 'clouds::account::' + cloudid + '::type', value: newCloudAccount.type },
                            { type: 'put', key: 'clouds::account::' + cloudid + '::accessToken', value: newCloudAccount.accessToken },
                            { type: 'put', key: 'clouds::account::' + cloudid + '::refreshToken', value: newCloudAccount.refreshToken },
                            { type: 'put', key: 'clouds::account::' + cloudid + '::cloudIdentifier', value: newCloudAccount.cloudIdentifier },
                            { type: 'put', key: 'clouds::account::' + cloudid + '::accountName', value: newCloudAccount.accountName },
                            { type: 'put', key: 'clouds::account::' + cloudid + '::folderId', value: newCloudAccount.folderId },
                            { type: 'put', key: 'clouds::count', value: cloudClount + 1 }
                        ], function(err) {
                            if( err ) {
                                res.redirect(302, '/manage/clouds#add_error_leveldb');
                            }
                        });
                        console.log("clouds.api.js: callback: after batch");

                        // redirect user back to manage page
                        db.close(function(err) {
                            if( err ) {
                                res.redirect(302, '/manage/clouds#add_error_leveldb');
                            }

                            console.log("clouds.api.js: callback: close leveldb");
                            res.redirect(302, '/manage/clouds#add_success');
                        });
                    }
                },
                function(error) {
                    db.close();

                    res.redirect(302, '/manage/clouds#add_error_leveldb');
                }
            );
    });

    return app;
};
