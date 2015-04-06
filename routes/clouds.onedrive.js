var querystring = require('querystring'),
    Promise = require('promise'),
    rp = require('request-promise');

module.exports = function(config) {
    var onedrive = {};

    onedrive.type = 'onedrive';

    // return oauth path for redirection to user
    onedrive.oauthAuthorizeUri = function(redirectUri, csrfToken) {
        var query = {
            response_type: 'code',
            client_id: config.MSAPI.KEY,
            redirect_uri: redirectUri,
            scope: 'wl.signin wl.offline_access onedrive.readwrite'
        }

        return 'https://login.live.com/oauth20_authorize.srf?' + querystring.stringify(query);        
    }

    // handle oauth code callback
    onedrive.oauthCallback = function(session, query) {
        if( typeof query.error != "undefined" ) {
            return new Promise(function(resolve, reject) {
                return reject({
                    error: query.error,
                    description: query.error_description,
                });
            });
        }

        var options = {
            uri: 'https://login.live.com/oauth20_token.srf',
            method: 'POST',
            body: querystring.stringify({
                code: query.code,
                grant_type: 'authorization_code',
                client_id: config.MSAPI.KEY,
                client_secret: config.MSAPI.SECRET,
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
                        type: onedrive.type,
                        accessToken: response.access_token,
                        refreshToken: response.refresh_token,
                        cloudIdentifier: response.user_id
                    }

                    // get account info
                    var options = {
                        uri: 'https://api.onedrive.com/v1.0/drive/',
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
                    metadata.accountName = response.owner.user.displayName;

                    // find .deduplicatus folder's id if exists.
                    // otherwise will create a folder and return it's id.
                    var options = {
                        uri: 'https://api.onedrive.com/v1.0/drive/root/children',
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

                    for( var i = 0; i < response['value'].length; i++ ) {
                        var item = response['value'][i];

                        if( typeof item['folder'] != 'undefined' && item['name'] == config.CHUNKS_FOLDER ) {
                            metadata.folderId = item['id'];
                            return new Promise(function(resolve, reject) {
                                resolve(null);
                            });
                        }
                    }

                    // folder not found, create an new one and return it's id
                    var options = {
                        uri: 'https://api.onedrive.com/v1.0/drive/root/children',
                        method: 'POST',
                        body: JSON.stringify({
                            name: config.CHUNKS_FOLDER,
                            folder: {},
                            '@name.conflictBehavior': 'fail'
                        }),
                        headers: {
                            'Authorization': 'Bearer ' + metadata.accessToken,
                            'Content-Type': 'application/json'
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
                        if( typeof response['id'] != 'undefined' ) {
                            metadata.folderId = response['id'];
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

    return onedrive;
};
