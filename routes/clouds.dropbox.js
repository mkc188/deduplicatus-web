var querystring = require('querystring'),
    Promise = require('promise'),
    rp = require('request-promise');

module.exports = function(config) {
    var dropbox = {};

    dropbox.type = 'dropbox';

    // return oauth path for redirection to user
    dropbox.oauthAuthorizeUri = function(redirectUri, csrfToken) {
        var query = {
            response_type: 'code',
            client_id: config.DROPBOX.KEY,
            redirect_uri: redirectUri,
            state: csrfToken
        }

        return 'https://www.dropbox.com/1/oauth2/authorize?' + querystring.stringify(query);        
    }

    // handle oauth code callback
    dropbox.oauthCallback = function(session, query) {
        if( session.oauthCSRF != query.state ) {
            return new Promise(function(resolve, reject) {
                return reject(null);
            });
        }

        if( typeof query.error != "undefined" ) {
            return new Promise(function(resolve, reject) {
                return reject({
                    error: query.error,
                    description: query.error_description,
                });
            });
        }

        var options = {
            uri: 'https://api.dropbox.com/1/oauth2/token',
            method: 'POST',
            body: querystring.stringify({
                code: query.code,
                grant_type: 'authorization_code',
                client_id: config.DROPBOX.KEY,
                client_secret: config.DROPBOX.SECRET,
                redirect_uri: session.redirectUri
            }),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        var metadata;
        return rp(options)
            .then(
                function(response) {
                    response = JSON.parse(response);

                    metadata = {
                        type: dropbox.type,
                        accessToken: response.access_token,
                        refreshToken: false,
                        cloudIdentifier: response.uid
                    }

                    // get account info
                    var options = {
                        uri: 'https://api.dropbox.com/1/account/info',
                        method: 'GET',
                        headers: {
                          'Authorization': 'Bearer ' + metadata.accessToken
                        }
                    };

                    return rp(options);
                },
                function(error) {
                    return null;
                }
            )
            .then(
                function(response) {
                    response = JSON.parse(response);
                    metadata.accountName = response.display_name;

                    // find .deduplicatus folder if exists.
                    // otherwise will create the folder
                    var options = {
                        uri: 'https://api.dropbox.com/1/metadata/auto/',
                        method: 'GET',
                        headers: {
                          'Authorization': 'Bearer ' + metadata.accessToken
                        }
                    };

                    return rp(options);
                },
                function(error) {
                    return null;
                }
            )
            .then(
                function(response) {
                    response = JSON.parse(response);

                    for( var i = 0; i < response['contents'].length; i++ ) {
                        var item = response['contents'][i];

                        if( item['is_dir'] && item['path'] == "/" + config.CHUNKS_FOLDER ) {
                            metadata.folderId = "/" + config.CHUNKS_FOLDER;
                            return new Promise(function(resolve, reject) {
                                resolve(null);
                            });
                        }
                    }

                    // folder not found, create an new one and return it's id
                    var options = {
                        uri: 'https://api.dropbox.com/1/fileops/create_folder',
                        method: 'POST',
                        body: querystring.stringify({
                            root: 'auto',
                            path: "/" + config.CHUNKS_FOLDER
                        }),
                        headers: {
                            'Authorization': 'Bearer ' + metadata.accessToken,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    };

                    return rp(options);
                },
                function(error) {
                    return null;
                }
            )
            .then(
                function(response) {
                    response = JSON.parse(response);

                    if( typeof metadata.folderId == 'undefined' ) {
                        if( response['is_dir'] && response['path'] == "/" + config.CHUNKS_FOLDER ) {
                            metadata.folderId = "/" + config.CHUNKS_FOLDER;
                        } else {
                            return null;
                        }
                    }

                    return metadata;
                },
                function(error) {
                    return null;
                }
            );
    }

    // handle oauth refresh token request
    // caution: dropbox api do not implement refresh token mechanism
    dropbox.refreshToken = function(oldRefreshToken) {
        return new Promise(function(resolve, reject) {
            return resolve(null);
        });
    }

    return dropbox;
};
